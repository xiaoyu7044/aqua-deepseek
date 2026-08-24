# 🐟 Aqua DeepSeek — DeepSeek API 实时价格像素鱼缸浮窗

一条住在像素鱼缸里的自由游动的鱼，实时显示 [DeepSeek API](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) 的峰谷价格。一行代码嵌入任何网页，零依赖。

> 灵感来自 [silicon-fish-clock](https://github.com/Gayaya999/silicon-fish-clock)。

<details>
<summary>🌐 English</summary>

A pixel-fish aquarium widget that lives in your webpage's corner, showing real-time
[DeepSeek API](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) pricing
with peak/off-peak visual feedback. One line of code, zero dependencies.

> **Inspired by** [silicon-fish-clock](https://github.com/Gayaya999/silicon-fish-clock).

### Quick start

```html
<script src="deepseek-price-widget.js"></script>
```

Drop this single line at the bottom of any HTML `<body>`. A fish aquarium
appears with builtin pricing defaults — no backend required.

### Features

- Fish swims freely; water level = remaining off-peak time
- Peak: water drains, fish dies (belly-up); off-peak: water rises, fish revives
- Desktop (>768px) = aquarium; mobile (≤768px) = pill capsule fallback
- Draggable, viewport-clamped, panel never overlaps widget
- Auto-detects page theme (dark/light) via CSS custom properties
- Mouse hover: fish approaches cursor (curiosity), startles on sudden entry
- Death: mouth bubbles (last breath); Revive: bubble burst + celebratory dart
- Dust particles, light beams, water surface tension effects

### Theme system

```javascript
window.__AQUA_THEME__ = 'winter'; // before loading widget
```

Built-in: `default`, `winter`, `autumn`, `spring`. Custom via `window.AQUA_THEMES`.

### Optional: auto-update pricing

```bash
python3 scripts/fetch_pricing.py --out ds_price_config.json
# Serve JSON at /api/ds-price-config with any backend
```

</details>

---

## 效果预览

| 谷哥时段（空闲/半价） | 峰哥时段（高峰） |
|:---:|:---:|
| ![谷哥](docs/preview-valley.png) | ![峰哥](docs/preview-peak.png) |
| 蓝水满缸，白鱼欢快游动 | 水干鱼翻白肚，沉底等谷哥回来 |

| 冬季主题 ❄️ | 秋季主题 🍂 |
|:---:|:---:|
| ![冬季](docs/preview-winter.png) | ![秋季](docs/preview-autumn.png) |
| 冰蓝水 + 雪花飘落 | 琥珀水 + 落叶飘零 |

| 面板展开 | 移动端 |
|:---:|:---:|
| ![面板](docs/preview-panel.png) | ![移动端](docs/preview-mobile.png) |
| 点击鱼缸展开价格面板 | 移动端自动回退为胶囊模式 |

---

## 快速开始

**一行引入，放 `<body>` 底部，零后端依赖，开箱即用：**

```html
<script src="deepseek-price-widget.js"></script>
```

右下角出现鱼缸浮窗，使用内置默认价格，不需要后端。

## 行为说明

| 状态 | 鱼缸 | 说明 |
|---|---|---|
| **谷哥时段**（空闲/半价） | 🔵 蓝水满缸 + 白鱼欢快游 | 水位随谷时段剩余时间逐渐下降；水快干时鱼游得慢 |
| **峰哥时段**（高峰） | ⚫ 水干鱼翻白肚 | 灰色死鱼沉在缸底；谷哥回来水涨满鱼复活 |

- **桌面端**（>768px）= 鱼缸陪伴模式；**移动端**（≤768px）= 胶囊模式自动回退
- 浮窗可拖动，**永远不超出窗口**，面板**不与浮窗重叠**
- 跟随主站主题色（CSS 变量），自动适配明暗主题
- 关闭后本次会话不再显示，重开浏览器恢复
- 鱼会好奇靠近鼠标，受惊时冲刺逃走
- 死亡时嘴里冒出最后的气泡，复活时气泡爆发 + 庆祝冲刺
- 水中有尘埃微粒漂浮、顶部光束斜射、水面贴壁微微上弯（张力）

## 主题系统

内置 4 个主题，可通过 JS 或后端切换：

```javascript
// 页面级设置（在加载 widget 之前）
window.__AQUA_THEME__ = 'winter';
```

| 主题 | 效果 | 鱼色 | 水色 | 装饰 |
|---|---|---|---|---|
| `default` | 默认 | 白色（跟随 --text） | 蓝色（跟随 --accent） | 无 |
| `winter` | 冬季 | 冰白 | 冰蓝 | ❄️ 雪花飘落 |
| `autumn` | 秋季 | 暖黄 | 琥珀 | 🍂 落叶飘零 |
| `spring` | 春季 | 白色 | 浅蓝 | 🌸 樱花瓣 |

后端配置也可指定主题：`ds_price_config.json` 中加 `"theme": "winter"` 字段。

自定义主题：通过 `window.AQUA_THEMES` 注入，支持 `fishColor`/`deadColor`/`waterRGB`/`decorations` 四个字段。`decorations` 数组支持 `'snow'`/`'leaves'`/`'petals'`。

## 自动更新价格（可选）

内置价格会过时，用抓取脚本自动同步官网：

```bash
python3 scripts/fetch_pricing.py --out ds_price_config.json
```

然后用任意后端在 `/api/ds-price-config` 返回这个 JSON。没有后端也能用——内置默认价格永远兜底。

## 项目结构

```
aqua-deepseek/
├── deepseek-price-widget.js       # 前端浮窗（自包含，Shadow DOM 隔离）
├── scripts/
│   └── fetch_pricing.py           # DeepSeek 官网价格自动抓取
├── examples/
│   ├── index.html                 # 演示页面
│   ├── server.py                  # 简易后端
│   └── ds_price_config.example.json
├── docs/                          # 预览截图
├── LICENSE                        # MIT
└── README.md
```

## DeepSeek Harness (HD) 用户

如果你想把鱼缸装进 [DeepSeek Harness](https://deepseek.com)，请使用 HD 专属插件：

```bash
dsh plugin --profile web add aqua-deepseek-hd
```

详见 [aqua-deepseek-hd](https://github.com/xiaoyu7044/aqua-deepseek-hd)。

## 配置

浮窗内置了 Flash 和 Pro 两个模型的默认价格，通过后端接口 `/api/ds-price-config` 可覆盖：

| 字段 | 说明 |
|---|---|
| `models` | 模型价格（flash/pro，含 cacheHit/cacheMiss/output × peak/off） |
| `segments` | 高峰时段，如 `[[9,12],[14,18]]` |
| `weekendOff` | 周末是否全天半价 |
| `theme` | 主题名（default/winter/autumn/spring） |

## 许可

[MIT License](LICENSE) · © 2026 LiJiaChuan · 受 [silicon-fish-clock](https://github.com/Gayaya999/silicon-fish-clock) 启发
