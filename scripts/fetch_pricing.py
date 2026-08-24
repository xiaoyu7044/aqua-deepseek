#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DeepSeek 官网价格/时段自动抓取 → ds_price_config.json
官网: https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
每次抓取: 解析价格表 + 高峰时段 + 周末规则, 校验通过才覆盖旧配置(原子写).
用法: python3 fetch_ds_pricing.py [--out /path/ds_price_config.json] [--print]
服务器部署位置: /home/mc_mcgg_backend/scripts/fetch_ds_pricing.py (cron 每天 08:00 CST, mcgg 用户)
"""
import json
import os
import re
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone, timedelta

URL = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
CN_TZ = timezone(timedelta(hours=8))

# 官网表格列顺序（多年稳定）: flash / pro / vision-exp
MODEL_KEYS = ["flash", "pro", "vision"]
MODEL_NAMES = {
    "flash": "DeepSeek-V4-Flash",
    "pro": "DeepSeek-V4-Pro",
    "vision": "DeepSeek-V4-Flash-Vision-Exp",
}

# 价格行顺序（按表格行出现）: 类别名 → (key)
ROW_ORDER = [
    ("cacheHit", "off"),   # 输入缓存命中 空闲
    ("cacheHit", "peak"),  # 输入缓存命中 高峰
    ("cacheMiss", "off"),  # 输入缓存未命中 空闲
    ("cacheMiss", "peak"), # 输入缓存未命中 高峰
    ("output", "off"),     # 输出 空闲
    ("output", "peak"),    # 输出 高峰
]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_prices(html):
    """解析价格表: 返回 {flash:{cacheHit:{off,peak},...}, pro:{...}, vision:{...}} 或 None"""
    rows = html.split("<tr")
    price_rows = []
    for row in rows:
        if "空闲时段" in row or "高峰时段" in row:
            values = [float(v) for v in re.findall(r"([\d.]+)元", row)]
            if len(values) == 3:
                price_rows.append(values)
    if len(price_rows) != 6:
        return None
    models = {}
    for i, key in enumerate(MODEL_KEYS):
        m = {}
        for (cat, sub), values in zip(ROW_ORDER, price_rows):
            m.setdefault(cat, {})[sub] = values[i]
        models[key] = {
            "name": MODEL_NAMES[key],
            "cacheHit": m["cacheHit"],
            "cacheMiss": m["cacheMiss"],
            "output": m["output"],
        }
    return models


def parse_segments(html):
    """解析高峰时段: '高峰时段为北京时间 9:00 - 12:00、14:00 - 18:00' → [[9,12],[14,18]]"""
    m = re.search(r"高峰时段为北京时间\s*(\d{1,2})(?::\d{2})?\s*-\s*(\d{1,2})(?::\d{2})?\s*[、,，]\s*(\d{1,2})(?::\d{2})?\s*-\s*(\d{1,2})(?::\d{2})?", html)
    if not m:
        return None
    segs = [[int(m.group(1)), int(m.group(2))], [int(m.group(3)), int(m.group(4))]]
    for s, e in segs:
        if not (0 <= s < e <= 24):
            return None
    return segs


def parse_weekend(html):
    """检测周末规则: 官网 2026-08-23 起周末全天低谷. 返回 (weekendOff: bool, note: str)"""
    has_weekend = "周末" in html
    if not has_weekend:
        return None, None  # 无周末字样 → 保留旧值
    if "不再区分" in html and ("低谷" in html or "空闲" in html):
        return True, "官网公告: 周末全天不区分峰谷, 统一低谷价"
    if "不再区分" in html:
        return True, "官网公告: 周末全天不区分峰谷"
    # 若明确说恢复周末区分 → False
    if ("区分" in html and "恢复" in html) or ("周末" in html and "峰谷" in html and "不再" not in html):
        return False, "官网公告: 周末恢复峰谷区分"
    return None, "官网出现'周末'字样但语义未识别: " + html[html.find("周末") - 50: html.find("周末") + 120]


def parse_model_vers(html):
    """从模型版本行提取 ver: DeepSeek-V4-Flash-0731 → {'flash':'0731'}"""
    vers = {}
    for key in MODEL_KEYS:
        m = re.search(MODEL_NAMES[key] + r"(?:-(\d{4}))?", html)
        if m and m.group(1):
            vers[key] = m.group(1)
    return vers


def validate(models, segments):
    """校验解析结果, 返回 (ok, errmsg). 高峰必须=2×空闲(官网规则: 空闲=高峰一半)"""
    if not models or not segments:
        return False, "解析不完整"
    for key in MODEL_KEYS:
        m = models[key]
        for cat in ("cacheHit", "cacheMiss", "output"):
            for sub in ("peak", "off"):
                v = m[cat][sub]
                if not isinstance(v, (int, float)) or v <= 0:
                    return False, f"{key}.{cat}.{sub} 非法: {v}"
        # 空闲×2≈高峰 (允许 1% 误差)
        for cat in ("cacheHit", "cacheMiss", "output"):
            off, peak = m[cat]["off"], m[cat]["peak"]
            if abs(peak - off * 2) / peak > 0.01:
                return False, f"{key}.{cat} 峰谷比异常: off={off} peak={peak}"
    return True, ""


def main():
    out = os.environ.get("DS_CONFIG_OUT", "/home/mc_mcgg_backend/ds_price_config.json")
    for i, a in enumerate(sys.argv):
        if a == "--out" and i + 1 < len(sys.argv):
            out = sys.argv[i + 1]
    do_print = "--print" in sys.argv

    html = fetch(URL)
    models = parse_prices(html)
    segments = parse_segments(html)
    ok, err = validate(models, segments)
    if not ok:
        print(f"[FAIL] 官网解析校验失败: {err} — 保留旧配置不动", flush=True)
        return 1

    weekend, note = parse_weekend(html)
    vers = parse_model_vers(html)
    for key, v in vers.items():
        if key in models:
            models[key]["ver"] = v

    # 周末规则: 解析不出来则保留旧 JSON 值; 无旧值默认 True
    weekend_off = True
    prev = None
    if os.path.exists(out):
        try:
            prev = json.load(open(out, encoding="utf-8"))
        except Exception:
            prev = None
    if weekend is not None:
        weekend_off = weekend
    elif prev and "weekendOff" in prev:
        weekend_off = prev["weekendOff"]

    payload = {
        "models": models,
        "segments": segments,
        "weekendOff": weekend_off,
        "updated": datetime.now(CN_TZ).isoformat(timespec="seconds"),
        "source": URL,
        "note": note or "官网无周末规则说明",
    }
    # 原子写
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(out) or ".", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    os.chmod(tmp, 0o644)  # 保证 Web 后端进程(mcgg)可读
    os.replace(tmp, out)
    print(f"[OK] 已写入 {out} | 时段={segments} | weekendOff={weekend_off} | note={note}", flush=True)
    if do_print:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
