# 梁文峰 & 梁文谷 — DeepSeek 价格浮窗完整配置指南

> **widget 文件**：`deepseek-price-widget.js`（当前版本 `v=20260825i1`）
> **覆盖入口**：在 `<script src="deepseek-price-widget.js">` **之前**执行 `window.AQUA_DEEPSEEK_CONFIG = {...}`
> **可直接复制的模板**：见同目录 `aqua-config-template.json`（完整默认值，JSON 格式）

---

## 目录
1. [三层覆盖优先级](#一层三层覆盖优先级)
2. [怎么用（3 种方式）](#二怎么用3种方式)
3. [完整配置模板](#三完整配置模板可复制)
4. [24 个配置块详解](#四24个配置块详解)
5. [常见改法速查](#五常见改法速查)
6. [主题自动跟随主站](#六主题自动跟随主站说明)
7. [硬编码现状（诚实结论）](#七硬编码现状)

---

## 一、三层覆盖优先级

| 层 | 来源 | 说明 |
|---|---|---|
| **最高** | `window.AQUA_DEEPSEEK_CONFIG` | 页面内联，深合并，可改任意字段 |
| 中 | `/api/ds-price-config` | 后端接口，官网自动同步时段/周末/价格 |
| 兜底 | `DEFAULT_CONFIG` | 文件内置默认值 |

> 合并是**深合并**：你只写 `physics: { overflowFeedCount: 80 }` 不会清空 physics 里的其它字段，只改这一个。

---

## 二、怎么用（3 种方式）

### 方式 1：页面内联（推荐，最灵活）
把这段放在任何一个 `<script src="...widget.js">` 之前：
```html
<script>
window.AQUA_DEEPSEEK_CONFIG = {
  defaultModel: 'pro',                    // 默认模型
  physics: { overflowFeedCount: 80 },      // 4秒吃80粒才翻白
  peakName: '梁文峰', offName: '梁文谷',
  models: {
    flash: { output: { off: 4.50, peak: 9.00 } }   // 只改 flash 价格
  }
};
</script>
<script src="deepseek-price-widget.js?v=20260825i1"></script>
```

### 方式 2：切季节主题
```html
<script>window.__AQUA_THEME__ = 'winter';</script>
```
内置主题：`default`(蓝) / `winter`(冰蓝+雪) / `autumn`(琥珀+落叶) / `spring`(浅粉+花瓣) / `harness`(深色)。

### 方式 3：注入自定义主题
```html
<script>
window.AQUA_THEMES = [{
  name: 'night', fishColor: '#2a3a55', waterRGB: '50,70,120', decorations: ['snow']
}];
window.__AQUA_THEME__ = 'night';
</script>
```

---

## 三、完整配置模板（可复制）

把下面整个对象粘到 `window.AQUA_DEEPSEEK_CONFIG` 里，**按需改值**，不想动的字段删除即可（深合并会回落到默认）：

```js
window.AQUA_DEEPSEEK_CONFIG = {

  /* ── 1. 价格与时段 ─────────────────────────────── */
  peakSegments: [[9, 12], [14, 18]],   // 高峰时段（北京，工作日）
  weekendOff: true,                     // 周末全天半价
  defaultModel: 'flash',                // 'flash' 或 'pro'
  models: {
    flash: {                            // 价格单位：元/百万tokens
      name: 'DeepSeek-V4-Flash', ver: '0731',
      cacheHit:  { off: 0.05,  peak: 0.10 },   // 输入·缓存命中
      cacheMiss: { off: 1.50,  peak: 3.00 },   // 输入·缓存未命中
      output:    { off: 4.50,  peak: 9.00 }    // 输出
    },
    pro: {
      name: 'DeepSeek-V4-Pro', ver: '0813',
      cacheHit:  { off: 0.15,  peak: 0.30 },
      cacheMiss: { off: 4.50,  peak: 9.00 },
      output:    { off: 13.50, peak: 27.00 }
    }
  },

  /* ── 2. 人格与文案 ─────────────────────────────── */
  peakName: '梁文峰',
  offName:  '梁文谷',
  peakMottos: ['梁文峰上班，钱包打蔫','人挤人，梁文峰笑纳','现在调用，都是梁文峰价','错峰一时爽，一直错峰一直爽','高峰路上，梁文峰收过路费'],
  offMottos:  ['梁文谷营业，半价捡漏','谷底风景好，梁文谷请客','趁梁文谷在，多囤点 token','夜猫子福利，梁文谷买单','低谷抄底，梁文谷陪你'],

  /* ── 3. 物理 / 行为参数 ────────────────────────── */
  physics: {
    waterDamp: 0.04,        // 水位变化速率（越小越慢）
    valleyMin: 0.35,        // 谷时段最低水位（保证鱼不死）
    aridThreshold: 0.08,    // 进入干旱的阈值
    aridFull: 0.5,          // 完全干旱
    fishSpeedBase: 0.35,    // 鱼基础速度
    fishSpeedScale: 0.7,    // 鱼速系数
    overflowFeedCount: 50,  // ★ 4秒内吃掉≥50粒鱼食才翻白
    overflowWindow: 4000,   // ★ 过食窗口（毫秒）
    overflowDuration: 720,  // 翻白持续（帧，720≈12秒）
    eggProbBase: 0.0025,    // 彩蛋基础概率
    eggProbMax: 0.011,      // 彩蛋概率上限
    eggWaterMin: 15         // 彩蛋所需最低水位(px)
  },

  /* ── 4. 季节主题 ───────────────────────────────── */
  activeTheme: 'default',   // default/winter/autumn/spring/harness
  themes: {
    default: { fishColor: null, deadColor: null, waterRGB: null },
    winter:  { fishColor:'#c8daf0', fishFin:'#a0b8d8', fishTail:'#a0b8d8', fishBelly:'#e8f0f8', deadColor:'#8899aa', waterRGB:'140,180,220', decorations:['snow'] },
    autumn:  { fishColor:'#d4a050', fishFin:'#8b6914', fishTail:'#8b6914', deadColor:'#8b7355', waterRGB:'200,150,60', decorations:['leaves'] },
    spring:  { fishColor:'#f0d0d8', fishFin:'#d0a0b0', fishTail:'#d0a0b0', fishBelly:'#f8e8ec', deadColor:'#b09098', waterRGB:'160,200,220', decorations:['petals'] },
    harness: { fishColor:'#1a1d21', deadColor:'#6e7681', waterRGB:'65,118,230' }
  },

  /* ── 5. 干旱主题颜色（峰段水干） ───────────────── */
  desert: {
    skyTop:[255,210,130], skyMid:[240,185,110], skyBot:[200,150,75],  skyAlpha:[0.7,0.65,0.75],
    // ★ 太阳三层圈：
    sunColor:[255,248,180], sunAlpha:1.0, sunRadius:6,               // 核心
    sunHalo:[255,240,150],  sunHaloAlpha:0.5, sunHaloRadius:14,      // 光晕
    sunMid:[255,235,120],   sunMidAlpha:0.35, sunMidRadius:20,       // 中层
    sunOuter:[255,220,80],  sunOuterAlpha:0.18, sunOuterRadius:28,   // 外层
    duneColor:[196,144,74], duneAlpha:0.4,
    sandColor:[[164,122,64,0.5],[132,94,48,0.6]],
    waveColor:[150,108,58], waveAlpha:0.4,
    cactusColor:[58,88,48], cactusAlpha:0.5,
    deadtreeColor:[92,66,40], deadtreeAlpha:0.5,
    crackColor:[76,52,26], crackAlpha:0.5,
    heatAlpha:0.03, windAlpha:0.4, scorchAlpha:0.06,
    fishDeadColor:'#7d7d7d'
  },

  /* ── 6. 水族环境 ───────────────────────────────── */
  aquatic: {
    dustColors:['#445566','#556677','#667788'], dustCount:25,
    beamAlpha:0.025, beamAlphaPulse:0.008,
    seaweedColors:[['#174234','#1b4d31'],['#2a6e46','#1f5c3a'],['#2f7f52','#3b8a5f']],
    seaweedTipColor:'#c8a95c', seaweedDarkColor:'#143629', seaweedBodyColor:'#8a6f3a'
  },

  /* ── 7. 鱼体绘制颜色 ───────────────────────────── */
  fish: {
    headColor:[40,30,20], headAlpha:0.85,
    bodyColor:[255,240,160], bodyAlphaYoung:0.9, bodyAlphaOld:0.4,
    bodyShimmerFreq:0.5, bodyShimmerBase:0.25, bodyShimmerAmp:0.12, bodyShimmerColor:[200,168,110],
    darkDetailColor:[90,60,30], darkDetailAlpha:0.7,
    finDarkColor:[120,180,220], finDarkAlpha:0.25, finDarkAlpha2:0.12,
    bellyHighlight:[255,255,255], bellyHighlightAlpha:0.06,
    eyeHighlightColor:[255,230,150], eyeHighlightYoung:0.28, eyeHighlightOld:0.1,
    eyeShadow:[60,40,20], eyeShadowAlpha:0.25,
    scaleDetailColor:[200,168,110], scaleDetailAlpha:0.2, scaleDetailAmp:0.1,
    scaleHighlightColor:[220,190,120], scaleHighlightAlpha:0.5,
    blushColor:[255,150,160], blushAlpha:0.5,
    mouthColor:[34,34,34], flopWhite:[255,255,255]
  },

  /* ── 8. 水族生物颜色 ───────────────────────────── */
  creatures: {
    jellyBody:[200,225,255], jellyBodyAlpha:0.6, jellyTentacleAlpha:0.35,
    squidBody:[180,106,216], squidBodyAlpha:1, squidTentacleAlpha:0.5,
    crabBody:[216,100,42], crabEye:[0,0,0], starBody:[232,155,106],
    turtleShell:[79,143,58], turtleShellLight:[111,174,87], turtleShellDark:[58,111,44], turtleBelly:[176,216,136],
    shadowColor:[10,15,20], shadowAlpha:0.35, boneColor:[224,216,200],
    snailBody:[176,138,82], snailShell:[122,98,56]
  },

  /* ── 9. 干旱生物 / 特效 ────────────────────────── */
  aridFx: {
    weedBody:[201,164,90], weedCenter:[138,111,58],
    cactusBody:[63,125,67], cactusTip:[90,162,90],
    vultureBody:[40,30,20], vultureAlpha:0.85,
    lightningStroke:[255,240,160], lightningYoung:0.9, lightningOld:0.4,
    sandColor:[200,168,110], sandAlphaBase:0.25, sandAlphaStep:0.12,
    drygrassColor:[200,176,96], crackLine:[90,60,30], crackAlpha:0.7,
    lizardBody:[154,127,62], snakeBody:[169,122,60], snakeEye:[0,0,0],
    deadTreeBody:[90,70,48], heatColor:[255,255,255], heatAlpha:0.06,
    mirageBody:[120,180,220], mirageAlpha:0.25, mirageAlpha2:0.12,
    sunFlashColor:[255,230,150], sunFlashBright:0.28, sunFlashDim:0.1,
    dshadowColor:[60,40,20], dshadowAlpha:0.25,
    duneColor:[150,110,58], duneAlphaBase:0.25, duneAlphaAmp:0.08,
    bubColor:[220,190,120], bubAlpha:0.5,
    dust2Color:[200,168,110], dust2AlphaBase:0.2, dust2AlphaStep:0.1
  },

  /* ── 10. 天气过场颜色 ──────────────────────────── */
  weather: {
    cloudColor:[60,68,82],
    flashScreenColor:[255,255,255], flashScreenAlpha:0.4,
    flashBoltColor:[255,244,190], flashBoltAlpha:0.9,
    rainColor:[190,215,245], rainAlpha:0.6,
    reviveBlush:[255,150,160], reviveBlushAlpha:0.5
  },

  /* ── 11. 水体效果 ──────────────────────────────── */
  effects: {
    bubbleGrad0:[255,255,255], bubbleGrad0Alpha:0.15,
    bubbleGrad1:[200,230,255], bubbleGrad1Alpha:0.4,
    bubbleGrad2:[180,220,255], bubbleGrad2Alpha:0.1,
    bubbleColorGrad0:[255,255,255], bubbleColorGrad0Alpha:0.25,
    bubbleColorGrad2:[255,255,255], bubbleColorGrad2Alpha:0.1,
    causticColor:[255,255,255], causticAlpha:0.06,
    lightBeamColor:[255,255,255],
    flowHighlightColor:[255,255,255], flowHighlightAlpha:0.04,
    surfaceHighlightColor:[255,255,255], surfaceHighlightAlpha:0.10,
    rippleColor:[255,255,255], dustColor:[255,255,255],
    foodColor:[200,120,40], foodColorDark:[160,100,30],
    heartColor:[255,180,200],
    vignetteColor:[0,0,0], vignetteAlpha:0.06,
    eggColors:['#f0b429','#5aa9e6','#f2a6c2','#9be564','#c89bf0'],
    dustParticleColors:['#4a5a6a','#6a5a4a'],
    heartColors:['#ff8ab0','#ff5c8a'],
    burstColors:['#ff5f57','#ffbd2e','#28c840','#45a1ff','#b45cff','#ff7ad1'],
    goldenColor:'#f6c945',
    windLineColor:[210,175,115], windLineAlpha:0.4,
    toastOverlay:[0,0,0], toastOverlayAlpha:0.5
  },

  /* ── 12. 面板 CSS（通常不用改，自动跟随主站） ──── */
  panelCss: {
    darkBg:[22,27,34], darkBgAlpha:0.88,
    darkPanelBg:[13,17,23], darkPanelBgAlpha:0.88,
    darkPanelBg2:[13,17,23], darkPanelBg2Alpha:0.82,
    darkOverlay:[0,0,0], darkOverlayAlpha:0.35,
    darkOverlayLight:[0,0,0], darkOverlayLightAlpha:0.25,
    darkOverlayLighter:[0,0,0], darkOverlayLighterAlpha:0.22,
    darkOverlaySubtle:[0,0,0], darkOverlaySubtleAlpha:0.08,
    darkDivider:[255,255,255], darkDividerAlpha:0.08,
    lightBg:[255,255,255], lightBgAlpha:0.92,
    lightOverlay:[0,0,0], lightOverlayAlpha:0.08,
    lightOverlay2:[0,0,0], lightOverlay2Alpha:0.06,
    accentWarn:[240,136,62], accentWarnAlpha:0.22,
    accentWarnLight:[240,136,62], accentWarnLightAlpha:0.18,
    accentWarnLighter:[240,136,62], accentWarnLighterAlpha:0.14,
    accentBlue:[88,166,255], accentBlueAlpha:0.20,
    accentBlueLight:[88,166,255], accentBlueLightAlpha:0.08,
    accentGreen:[63,185,80], accentGreenAlpha:0.14,
    accentGreenLight:[63,185,80], accentGreenLightAlpha:0.13,
    accentRed:[248,81,73], accentRedAlpha:0.2,
    accentRedLight:[248,81,73], accentRedLightAlpha:0.12,
    darkShadow:[0,0,0], darkShadowAlpha:0.4
  },

  /* ── 13. UI 主色 ───────────────────────────────── */
  ui: {
    barBg:'rgba(22,27,34,.82)', barBorder:'#21262d',
    panelBg:'#161b22', panelBorder:'#30363d',
    toastBg:'#161b22', toastBorder:'#30363d',
    warnColor:'#f0883e',          // 高峰（峰）· 橙
    accentColor:'#58a6ff',        // 空闲（谷）· 蓝 · 也作水色回退
    accent2Color:'#3fb950',       // 半价/谷 · 绿
    textColor:'#e6edf3', textSecondary:'#8b949e', textTertiary:'#6e7681',
    lightPanelBg:'#fffdf9', lightBorder:'#d0d7de', lightBg:'#f7f3ea',
    lightText:'#1f2328', lightTextSecondary:'#656d76', lightTextTertiary:'#8c959f',
    lightAccent:'#0969da', lightAccent2:'#1a7f37', lightWarn:'#cf222e'
  },

  /* ── 14. i18n 全部 UI 文案 ─────────────────────── */
  i18n: {
    closeLabel:'关闭', scheduleLabel:'值班表', halfPriceLabel:' 半价',
    inputLabel:'输入', outputLabel:'输出', cacheHit:'缓存命中', cacheMiss:'缓存未命中',
    unitLabel:'元/百万tokens',
    peakPeriodLabel:' · 高峰时段', offPeriodLabel:' · 空闲时段 (半价)',
    switchToSuffix:' 后转',
    countdownOffMsg:' 秒后接棒，半价开抢！', countdownPeakMsg:' 秒后上班，钱包快跑！',
    companionPrefixOff:'再陪 ', companionPrefixPeak:'再榨 ',
    toOffSuffix:' 后转空闲', toPeakSuffix:' 后转高峰',
    switchAlertPeak:'上班了！', switchAlertOff:'接棒，半价开抢！',
    timeLabel:'时段 (北京时间)', remindLabel:'切换变色提醒'
  },

  /* ── 15. 可插拔扩展 ────────────────────────────── */
  eggs: [],
  desertMaterials: [],
  aquaticMaterials: []
};
```

> ⚠️ 建议直接复制同目录 `aqua-config-template.json`（JSON 格式，去掉了注释，可直接加载）。

---

## 四、24 个配置块详解

| # | 块名 | 作用 | 关键子字段 |
|---|---|---|---|
| 1 | `peakSegments` | 高峰时段 | `[[9,12],[14,18]]` 每日高峰 |
| 2 | `weekendOff` | 周末是否全天半价 | `true/false` |
| 3 | `models` | 模型与价格 | `flash`/`pro`，各含 `cacheHit/cacheMiss/output`（off/peak 双价） |
| 4 | `defaultModel` | 默认模型 | `'flash'`/`'pro'` |
| 5 | `peakName`/`offName` | 双人格名 | 梁文峰/梁文谷 |
| 6 | `peakMottos`/`offMottos` | 切换调侃文案 | 字符串数组 |
| 7 | `physics` | 物理/行为 | 水位、鱼速、过食、彩蛋频率 |
| 8 | `themes` | 内置季节主题 | 鱼色/水色/装饰 |
| 9 | `activeTheme` | 当前主题 | 主题名 |
| 10 | `desert` | 干旱特效 | 天空/太阳三圈/沙丘/仙人掌 |
| 11 | `aquatic` | 水族环境 | 尘埃/光束/水草 |
| 12 | `fish` | 鱼体像素画配色 | 16 项颜色 |
| 13 | `creatures` | 水族生物 | 水母/海龟/螃蟹等 |
| 14 | `aridFx` | 干旱生物特效 | 风滚草/秃鹫/闪电/蜥蜴 |
| 15 | `weather` | 天气过场 | 乌云/闪电/雨 |
| 16 | `effects` | 水体效果 | 气泡/焦散/涟漪/鱼食 |
| 17 | `panelCss` | 面板 CSS 颜色 | 深/亮色面板 + accent |
| 18 | `ui` | UI 主色 | 峰/谷/半价主色 |
| 19 | `i18n` | 全部文案 | 22 个文案键 |
| 20 | `eggs` | 彩蛋注册 | 自定义彩蛋数组 |
| 21 | `desertMaterials` | 干旱可绘制材质 | 可插拔 |
| 22 | `aquaticMaterials` | 水族可绘制材质 | 可插拔 |

---

## 五、常见改法速查

| 想改什么 | 怎么写 |
|---|---|
| **过食翻白更敏感/更迟钝** | `physics: { overflowFeedCount: 80 }`（更大=更难翻白） |
| 过食窗口变长 | `physics: { overflowWindow: 6000 }` |
| 只改 flash 价格 | `models: { flash: { output: { off: 5, peak: 10 } } }` |
| 换高峰时段 | `peakSegments: [[10,12],[15,19]]` |
| 周末不休 | `weekendOff: false` |
| 换默认模型 | `defaultModel: 'pro'` |
| 改姓名/文案 | `peakName: 'xx', offMottos: ['...']` |
| 换 UI 主色 | `ui: { warnColor: '#ff6b35', accentColor: '#00b4d8' }` |
| 强制某主题 | `activeTheme: 'winter'`（或 `window.__AQUA_THEME__`） |
| 太阳三圈调大小 | `desert: { sunRadius: 8, sunMidRadius: 24, sunHaloRadius: 16, sunOuterRadius: 34 }` |

---

## 六、主题自动跟随主站（说明）

浮窗内部变量已通过 `_THEME_VAR_SRC` 映射到 **mc.mcgg.cc 主站真实 CSS 变量**，明暗主题自动跟随：

| 浮窗内部变量 | → 主站变量 | 说明 |
|---|---|---|
| `--card` | `--card` | 面板底 |
| `--card2` | `--bg-secondary` | 次级底 |
| `--accent` | `--accent-primary` | 主色（蓝） |
| `--accent2` | `--accent-cta` | 强调色（琥珀） |
| `--warn` | `--accent-cta` | 警告色 |
| `--border` | `--border` | 边框 |
| `--border2` | `--border-light` | 边框浅 |
| `--shadow` | `--shadow-lg` | 阴影 |
| `--text` | `--text` | 正文 |
| `--text-secondary` | `--text2` | 次级 |
| `--text-tertiary` | `--text3` | 三级 |

**主站深色**：bg `#0d2b45`、accent-blue `#7fc8ff`、amber `#ffb547`（深蓝海军风）
**主站亮色**：bg `#f7f3ea`、accent-blue `#1d6bb8`、amber `#a8842f`

> 因此 `panelCss`/`ui` 一般**不用手改**——浮窗会自动读主站配色。想强制就覆盖 `window.__AQUA_THEME__`。

---

## 七、配置化程度

| 位置 | 数量 | 性质 | 是否需改 |
|---|---|---|---|
| **运行时代码** | **0** | 全部走 `CFG.*` | ✅ 无需 |
| CSS 模板 `var(--x,fallback)` | 18 | 兜底默认值，运行时被 `_syncThemeVars` 覆盖 | ⚠️ 保留兜底 |
| HTML 模板中文 | 5 | 运行时被 `CFG.i18n` 覆盖 | ⚠️ 保留兜底 |
| `_THEME_DEFS.light` hex | 8 | 主站 CSS 变量默认值 | ✅ 非 widget 配置 |

> 模板内的 fallback 值是「兜底默认色」，在暗/亮主题下由 `_syncThemeVars` 运行时注入覆盖。所有能改的配置都通过 `window.AQUA_DEEPSEEK_CONFIG` 注入，**无需修改源码**。
