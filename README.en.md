# 🐟 Aqua DeepSeek — Real-time DeepSeek API Price Aquarium

A free-swimming pixel fish living in a pixel aquarium, showing real-time
[DeepSeek API](https://api-docs.deepseek.com/en-us/quick_start/pricing/)
peak/off-peak pricing. **Install into [DeepSeek Harness](https://deepseek.com)
with one command**, or embed standalone in any webpage.

> Inspired by [silicon-fish-clock](https://github.com/Gayaya999/silicon-fish-clock).

## Quick start (standalone)

```html
<script src="deepseek-price-widget.js"></script>
```

Add it to the bottom of `<body>`. Zero backend dependency — works out of the box
with built-in default pricing.

## Install into DeepSeek Harness

```bash
dsh plugin --profile web add aqua-deepseek
dsh plugin --profile headless add aqua-deepseek
systemctl --user restart dsh-web
```

## Features

- Fish swims freely; water level = remaining off-peak time
- **Peak**: water drains, fish dies (belly-up); **off-peak**: water rises, fish revives
- Desktop = aquarium; mobile (≤768px) = pill capsule
- Draggable, viewport-clamped, panel never overlaps widget
- Auto-detects page theme (dark/light) via CSS custom properties, mapped to the host site's real variables
- **Full config interface** — every color / behavior / label is overridable via `window.AQUA_DEEPSEEK_CONFIG`
- **Overfeeding easter egg** — eating ≥50 food pellets within 4s makes the fish flip belly-up (frozen while flipped)
- Food pellets vanish on hitting the tank floor
- **20+ easter eggs**: big fish eats fish / companion fish / hearts / jellyfish / crab / turtle / turn gold / spin / bubble rain… (off-peak); tumbleweed / cactus / vulture / lightning / lizard / rattlesnake / dead tree / dunes… (peak drought)

## Theme system

4 built-in themes, switchable via the page or backend:

```javascript
window.__AQUA_THEME__ = 'winter';
```

| Theme | Effect | Fish | Water | Decorations |
|:---:|:---:|:---:|:---:|:---:|
| `default` | default | white (follows `--text`) | blue (follows `--accent`) | none |
| `winter` | winter | ice-white | ice-blue | ❄️ snow |
| `autumn` | autumn | warm-yellow | amber | 🍂 leaves |
| `spring` | spring | pink-white | light-blue | 🌸 petals |
| `harness` | DeepSeek Harness plugin | dark | blue | none |

## Configuration

See **[CONFIG_GUIDE.md](CONFIG_GUIDE.md)** for the full field-by-field guide
and a copy-paste template (`aqua-config-template.json`). Every value — pricing,
peak segments, colors, physics, labels — is overridable:

```html
<script>
window.AQUA_DEEPSEEK_CONFIG = {
  models: { flash: { output: { off: 4.50, peak: 9.00 } } },
  physics: { overflowFeedCount: 80 }
};
</script>
<script src="deepseek-price-widget.js"></script>
```

## Project structure

```
aqua-deepseek/
├── deepseek-price-widget.js       # Frontend widget (self-contained, Shadow DOM isolated)
├── index.ts                       # DeepSeek Harness plugin entry (Cordis)
├── cordis.patch.yml               # DeepSeek Harness bundle plugin registration
├── package.json                   # npm package (with dsh bundle metadata)
├── scripts/
│   └── fetch_pricing.py           # DeepSeek official pricing auto-fetch
├── examples/
│   ├── index.html                 # demo page
│   ├── server.py                  # minimal backend
│   └── ds_price_config.example.json
├── docs/                          # preview screenshots (crystal preview images)
├── CONFIG_GUIDE.md                # full config reference (zh)
├── aqua-config-template.json      # copy-paste config template
├── LICENSE                        # MIT
└── README.md / README.en.md
```

## License

[MIT License](LICENSE) · © 2026 LiJiaChuan · Inspired by
[silicon-fish-clock](https://github.com/Gayaya999/silicon-fish-clock)
