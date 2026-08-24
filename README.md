# 🐟 Aqua DeepSeek — 像素鱼缸 DeepSeek 价格浮窗

一条住在像素鱼缸里的自由游动的鱼，实时显示 [DeepSeek API](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) 的峰谷价格。

> **灵感来自** [silicon-fish-clock](https://github.com/Gayaya999/silicon-fish-clock) —
> 一款住在透明像素鱼缸里的桌面任务计时器。Aqua DeepSeek 把"像素鱼缸陪伴式"的理念搬到了网页端，用于实时监控 DeepSeek API 的峰谷时段价格。

---

[English](#english) · [中文](#中文)

## 中文

### 效果预览

| 状态 | 鱼缸 | 说明 |
|---|---|---|
| **谷哥时段**（空闲/半价） | 🔵 蓝水满缸 + 白鱼欢快游 | 水位随谷时段剩余时间逐渐下降，水快干时鱼游得慢 |
| **峰哥时段**（高峰） | ⚫ 水干鱼翻白肚 | 灰色死鱼沉在缸底，等谷哥回来水涨满鱼复活 |

- 像素风：黑白 1-bit 鱼 + 主题蓝水 + 呼吸波浪/流动光带/高光闪动
- 跟随主站主题色（CSS 变量），支持明暗主题
- 桌面端（>768px）= 鱼缸陪伴模式；移动端（≤768px）= 胶囊模式自动回退
- 可拖动，浮窗/面板均不超出窗口，面板不与浮窗重叠
- 关闭后本次会话不再显示，重开浏览器恢复（sessionStorage + localStorage 兜底）

### 快速开始

**一行引入，零后端依赖，开箱即用：**

```html
<script src="deepseek-price-widget.js"></script>
```

在任意网页的 `<head>` 或 `<body>` 中加上这一行，右下角就会出现鱼缸浮窗。
价格使用内置默认值，不需要任何后端服务。

### 自动更新价格（可选）

如果希望价格跟 DeepSeek 官网自动同步：

```bash
# 1. 抓取官网最新价格
python3 scripts/fetch_pricing.py --out ds_price_config.json

# 2. 用任意后端服务在 /api/ds-price-config 路径返回这个 JSON
#    或者用提供的示例后端
python3 examples/server.py
```

没有后端也能用——内置默认价格永远兜底。后端只是"锦上添花"地覆盖最新价格。

### 项目结构

```
aqua-deepseek/
├── deepseek-price-widget.js       # 前端浮窗（自包含，Shadow DOM 隔离）
├── scripts/
│   └── fetch_pricing.py           # DeepSeek 官网价格自动抓取脚本
├── examples/
│   ├── index.html                 # 演示页面（浏览器直接打开）
│   ├── server.py                  # 简易后端（提供价格配置接口）
│   └── ds_price_config.example.json  # 配置示例
├── LICENSE                        # MIT
└── README.md
```

### 配置说明

浮窗内置了 Flash 和 Pro 两个模型的默认价格和峰谷时段（9-12/14-18 工作日高峰）。
通过后端接口 `/api/ds-price-config` 可以覆盖：

| 字段 | 说明 |
|---|---|
| `models` | 模型价格（flash/pro，含 cacheHit/cacheMiss/output × peak/off） |
| `segments` | 高峰时段，如 `[[9,12],[14,18]]` |
| `weekendOff` | 周末是否全天半价（`true`=周六周日全天谷哥） |

### 技术栈

- 纯 JavaScript（ES5 兼容），零依赖
- Canvas 2D 像素鱼 + 水位动画
- Shadow DOM 样式隔离
- CSS 变量跟随主站主题

### 许可

[MIT License](LICENSE) · © 2026 LiJiaChuan

---

<a id="english"></a>

## English

A pixel-fish aquarium that lives in your webpage's corner, showing real-time
[DeepSeek API](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) pricing
with peak/off-peak visual feedback.

> **Inspired by** [silicon-fish-clock](https://github.com/Gayaya999/silicon-fish-clock) —
> a desktop task timer that lives inside a transparent pixel fish aquarium.
> Aqua DeepSeek brings the "pixel aquarium companion" concept to the web,
> repurposed for monitoring DeepSeek API pricing in real time.

### Quick start

```html
<script src="deepseek-price-widget.js"></script>
```

Drop this single line into any HTML page. A fish aquarium appears in the
bottom-right corner with builtin pricing defaults — no backend required.

### Optional: auto-update pricing

```bash
python3 scripts/fetch_pricing.py --out ds_price_config.json
# Serve the JSON at /api/ds-price-config with any backend
```

### Features

- Pixel fish swims freely in blue water; water level = remaining off-peak time
- Peak hours: water drains, fish dies (belly-up, gray); fish revives when off-peak returns
- Desktop (>768px) = aquarium mode; mobile (≤768px) = pill capsule fallback
- Draggable, clamped to viewport, panel never overlaps the widget
- Follows host page theme via CSS custom properties
- Session-close with localStorage fallback (resets on new browser session)

### License

[MIT](LICENSE) · © 2026 LiJiaChuan
