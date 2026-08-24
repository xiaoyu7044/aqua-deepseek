/* ============================================================
 * 梁文峰 & 梁文谷 — DeepSeek 价格时段浮窗 (mc.mcgg.cc 全站)
 * 高峰时段(梁文峰): 北京 9:00-12:00, 14:00-18:00 (仅周一至周五)
 * 空闲时段(梁文谷): 其余时间, 价格 = 高峰一半; 周六/周日全天为梁文谷
 * 2026-08-23: 周末全天半价
 * 2026-08-24: 陪伴式改造(方案C) — 桌面端=像素鱼缸：鱼只在水里游(自由
 *   游动/冒泡)，水位=谷时段剩余时间(谷开始水满、谷结束水干、峰时段水干
 *   鱼死翻白肚沉底，切换冒泡提醒)；水=主题蓝 + 呼吸波浪/流动光带动画；
 *   移动端=原胶囊样式回退；不做声音；面板定位视口内 clamp 防超出屏幕；
 *   保留拖动/关闭(sessionStorage 优先 + localStorage 时间戳兜底)
 * ============================================================ */
(function () {
  if (window.__DS_PRICE_WIDGET__) return;
  window.__DS_PRICE_WIDGET__ = true;

  // ---- 配置 ----
  var MODELS = {
    flash: {
      name: 'DeepSeek-V4-Flash',
      ver: '0731',
      cacheHit:  { peak: 0.10, off: 0.05 },
      cacheMiss: { peak: 3.00, off: 1.50 },
      output:    { peak: 9.00, off: 4.50 }
    },
    pro: {
      name: 'DeepSeek-V4-Pro',
      ver: '0813',
      cacheHit:  { peak: 0.30, off: 0.15 },
      cacheMiss: { peak: 9.00, off: 4.50 },
      output:    { peak: 27.00, off: 13.50 }
    }
  };
  var PEAK_SEGMENTS = [[9, 12], [14, 18]]; // 默认高峰时段 (北京)
  var WEEKEND_OFF = true; // 周末(周六/周日)全天半价——官网 2026-08-23 起生效，后端配置可覆盖
  var CLOSE_KEY = '__ds_price_closed__';
  var CLOSE_TTL = 6 * 3600 * 1000; // localStorage 兜底关闭有效期: 6 小时内不复活
  var CONFIG_KEY = '__ds_price_config__';
  var configUrl = '/api/ds-price-config'; // 后端配置接口

  // 应用后端配置：时段 / 周末规则 / 模型价格，全部可被官网自动更新覆盖
  function applyConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') return;
    if (cfg.segments && Array.isArray(cfg.segments) && cfg.segments.length) {
      PEAK_SEGMENTS = cfg.segments;
    }
    if (typeof cfg.weekendOff === 'boolean') {
      WEEKEND_OFF = cfg.weekendOff;
    }
    if (cfg.models && typeof cfg.models === 'object') {
      var ok = true;
      for (var k in cfg.models) {
        var m = cfg.models[k];
        if (!m || !m.cacheHit || !m.cacheMiss || !m.output) { ok = false; break; }
      }
      if (ok) MODELS = cfg.models;
    }
  }
  // 尝试从后端获取配置（官网价格/时段自动同步，前端有内置默认兜底）
  function fetchConfig() {
    try {
      var cached = localStorage.getItem(CONFIG_KEY);
      if (cached) {
        var cfg = JSON.parse(cached);
        if (cfg.ts && Date.now() - cfg.ts < 3600000) { // 1小时缓存
          applyConfig(cfg);
        }
      }
    } catch (e) {}
    fetch(configUrl).then(function(r) { return r.json(); }).then(function(cfg) {
      applyConfig(cfg);
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify({
          segments: PEAK_SEGMENTS, weekendOff: WEEKEND_OFF, models: MODELS, ts: Date.now()
        }));
      } catch (e) {}
    }).catch(function() {});
  }
  fetchConfig();

  // ---- 工具 ----
  function isWeekendDay(d) {
    var w = d.getDay();
    return w === 0 || w === 6; // 周日 / 周六
  }
  function nowParts() {
    var d = new Date();
    return { d: d, h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), dow: d.getDay(), ts: d.getTime() };
  }
  function isPeak(h, m, dow) {
    if (WEEKEND_OFF && (dow === 0 || dow === 6)) return false; // 周六/周日全天半价
    var t = h * 60 + m;
    for (var i = 0; i < PEAK_SEGMENTS.length; i++) {
      var s = PEAK_SEGMENTS[i][0] * 60, e = PEAK_SEGMENTS[i][1] * 60;
      if (t >= s && t < e) return true;
    }
    return false;
  }
  function fmt(x) { return x.toFixed(2).replace(/\.00$/, ''); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  // 距离下一时段切换的秒数（周末全天半价 → 下一边界必在下个工作日）
  function nextSwitchSec(d) {
    var cur = d.getTime();
    var day = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    for (var i = 0; i < 8; i++) { // 最多扫 8 天，必遇工作日边界
      if (!isWeekendDay(day)) {
        var boundaries = [];
        PEAK_SEGMENTS.forEach(function (seg) {
          boundaries.push(seg[0] * 60); // 高峰开始
          boundaries.push(seg[1] * 60); // 高峰结束
        });
        boundaries.sort(function (a, b) { return a - b; });
        for (var j = 0; j < boundaries.length; j++) {
          var b = day.getTime() + boundaries[j] * 60000;
          if (b > cur) return Math.round((b - cur) / 1000);
        }
      }
      day.setDate(day.getDate() + 1);
    }
    return 0;
  }

  // ---- 主题色（跟随主站 CSS 变量） ----
  function themeColor(varName, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      if (v && /^#/.test(v)) return v;
    } catch (e) {}
    return fallback;
  }
  function hexToRgb(hex) {
    var h = (hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    if (isNaN(n)) return '110,118,129';
    return (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }
  // 当前谷时段剩余比例 [0,1]：谷开始=1(水满)，谷结束=0(水干)；峰时段=0
  // 谷时段 = 一天中不在 PEAK_SEGMENTS 的区间；周末(WEEKEND_OFF)全天为谷
  function waterLevelFor(p) {
    if (WEEKEND_OFF && (p.dow === 0 || p.dow === 6)) {
      var t1 = p.h * 60 + p.m + p.s / 60;
      return Math.max(0, Math.min(1, (1440 - t1) / 1440));
    }
    var t = p.h * 60 + p.m + p.s / 60;
    var bounds = [0, 24 * 60];
    PEAK_SEGMENTS.forEach(function (seg) { bounds.push(seg[0] * 60, seg[1] * 60); });
    bounds.sort(function (a, b) { return a - b; });
    // 谷段 = 相邻边界中的偶数区间 [bounds[i], bounds[i+1]] (i 偶数)
    for (var i = 0; i + 1 < bounds.length; i += 2) {
      var s = bounds[i], e = bounds[i + 1];
      if (t >= s && t < e) {
        var total = Math.max(1, e - s);
        return Math.max(0, Math.min(1, (e - t) / total));
      }
    }
    return 0;
  }

  // ---- 构造 UI ----
  var host = document.createElement('div');
  host.id = 'ds-price-widget-host';
  var shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = '\
<style>\
:host{position:fixed;right:14px;bottom:14px;z-index:999999;font-size:12px;line-height:1.5;color:var(--text,#e6edf3)}\
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}\
.wrap{position:fixed;right:14px;bottom:14px;z-index:999999;user-select:none;cursor:grab}\
.wrap.dragging{cursor:grabbing}\
/* ===== 桌面鱼缸 (陪伴式) ===== */\
.aqua{position:relative;width:150px;height:118px;border-radius:12px;overflow:hidden;\
border:1px solid var(--border,#30363d);background:linear-gradient(180deg,var(--card,#161b22),var(--card2,rgba(13,17,23,.88)));\
box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer;\
transition:border-color .3s,box-shadow .3s}\
.aqua.peak{border-color:var(--warn,#f0883e);box-shadow:0 6px 18px rgba(240,136,62,.22)}\
.aqua.off{border-color:var(--accent,#58a6ff);box-shadow:0 6px 18px rgba(88,166,255,.20)}\
.aqua canvas{display:block;width:150px;height:92px;pointer-events:none}\
.aq-x{position:absolute;top:3px;right:3px;width:18px;height:18px;line-height:16px;text-align:center;\
font-size:11px;color:var(--text-tertiary,#6e7681);border-radius:4px;cursor:pointer;z-index:5;\
background:var(--shadow,rgba(0,0,0,.25));font-family:monospace}\
.aq-x:hover{color:#f85149;background:rgba(248,81,73,.2)}\
.aq-bar{position:absolute;left:0;right:0;bottom:0;height:26px;display:flex;align-items:center;justify-content:space-between;\
padding:0 7px;background:var(--card2,rgba(13,17,23,.82));border-top:1px solid var(--border2,#21262d);color:var(--text,#e6edf3);\
font-size:9px;z-index:4;font-variant-numeric:tabular-nums;cursor:pointer;transition:background .2s}\
.aq-bar:hover{background:var(--shadow,rgba(255,255,255,.08))}\
.aq-bar .caret{font-size:9px;color:var(--text-tertiary,#6e7681);margin-left:5px;display:inline-block;transition:transform .2s}\
.aqua.open .aq-bar .caret{transform:rotate(180deg)}\
.aq-bar .nm{font-weight:700;font-size:9px;white-space:nowrap;flex-shrink:0}\
.aq-bar .nm.peak{color:var(--warn,#f0883e)}\
.aq-bar .nm.off{color:var(--accent,#58a6ff)}\
.aq-bar .pr{color:var(--text2,#8b949e);white-space:nowrap;flex-shrink:0;overflow:hidden;text-overflow:ellipsis}\
.aq-next{position:absolute;top:3px;left:5px;font-size:9px;color:var(--text-tertiary,#8b949e);z-index:5;\
background:var(--shadow,rgba(0,0,0,.22));padding:1px 4px;border-radius:3px;font-variant-numeric:tabular-nums}\
/* ===== 移动胶囊 (回退) ===== */\
.pill{display:none;align-items:center;gap:6px;background:var(--card,#161b22);border:1px solid var(--border,#30363d);border-radius:999px;\
padding:7px 13px;color:var(--text,#e6edf3);font-size:12px;box-shadow:0 4px 14px var(--shadow,rgba(0,0,0,.25));\
transition:border-color .3s,box-shadow .3s}\
.pill.peak{border-color:var(--warn,#f0883e);box-shadow:0 4px 14px rgba(240,136,62,.18)}\
.pill.off{border-color:var(--accent2,#3fb950);box-shadow:0 4px 14px rgba(63,185,80,.14)}\
.icon{width:12px;height:12px;flex:none;display:block}\
.pill.peak .icon{color:var(--warn,#f0883e);animation:dsblink 1.6s ease-in-out infinite}\
.pill.off .icon{color:var(--accent2,#3fb950)}\
@keyframes dsblink{0%,100%{opacity:1}50%{opacity:.35}}\
.toast{position:absolute;right:0;bottom:calc(100% + 10px);background:var(--card,#161b22);border:1px solid var(--border,#30363d);border-radius:999px;\
padding:5px 11px;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.4);opacity:0;pointer-events:none;\
transition:opacity .3s,transform .3s;transform:translateY(4px);z-index:10}\
.toast.show{opacity:1;transform:translateY(0)}\
.motto{font-size:11px;color:var(--text-secondary,#8b949e);padding:7px 14px 0;font-style:italic}\
.motto.peak{color:var(--warn,#f0883e)}\
.motto.off{color:var(--accent2,#3fb950)}\
.pill .label{font-weight:600}\
.pill .price{color:var(--text2,#8b949e);font-variant-numeric:tabular-nums}\
.pill .x{color:var(--text-tertiary,#6e7681);font-size:13px;line-height:1;padding:4px 6px;border-radius:4px;margin-left:2px;cursor:pointer}\
.pill .x:hover{color:#f85149;background:rgba(248,81,73,.12)}\
.pill .x:active{color:#f85149;background:rgba(248,81,73,.22)}\
.panel{position:fixed;right:14px;width:330px;max-height:calc(100vh - 90px);overflow-y:auto;\
background:var(--card,#161b22);border:1px solid var(--border,#30363d);border-radius:12px;color:var(--text,#e6edf3);font-size:12px;\
box-shadow:0 12px 40px rgba(0,0,0,.35);display:none;z-index:999999}\
.panel.open{display:block}\
.panel::-webkit-scrollbar{width:6px}\
.panel::-webkit-scrollbar-thumb{background:var(--border,#30363d);border-radius:3px}\
.phead{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px;border-bottom:1px solid var(--border2,#21262d)}\
.phead .t{font-weight:700;font-size:13px}\
.phead .t small{color:var(--text-tertiary,#8b949e);font-weight:400;margin-left:6px}\
.status{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:600}\
.status.peak{background:rgba(240,136,62,.14);color:var(--warn,#f0883e)}\
.status.off{background:rgba(63,185,80,.13);color:var(--accent2,#3fb950)}\
.tabs{display:flex;gap:6px;padding:10px 14px 0}\
.tab{flex:1;text-align:center;padding:7px 0;border-radius:8px;border:1px solid var(--border,#30363d);cursor:pointer;font-size:12px;color:var(--text-secondary,#8b949e);transition:all .2s}\
.tab.active{color:var(--text,#e6edf3);border-color:var(--accent,#58a6ff);background:rgba(88,166,255,.08)}\
.price-box{padding:10px 14px 6px}\
.prow{display:flex;justify-content:space-between;align-items:center;padding:7px 2px;border-bottom:1px dashed var(--border2,#21262d)}\
.prow:last-child{border-bottom:none}\
.prow .k{color:var(--text-secondary,#8b949e)}\
.prow .v{font-variant-numeric:tabular-nums;font-weight:600}\
.prow .v.peak{color:var(--warn,#f0883e)}\
.prow .v.off{color:var(--accent2,#3fb950)}\
.prow .tag{font-size:10px;color:var(--text-tertiary,#6e7681);margin-left:4px}\
.timeline{padding:8px 14px 12px}\
.tl-title{color:var(--text-secondary,#8b949e);font-size:11px;margin-bottom:6px}\
.tl{display:flex;height:18px;border-radius:5px;overflow:hidden;border:1px solid var(--border2,#21262d)}\
.tl .seg{display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:600}\
.tl .seg.peak{background:var(--warn,#f0883e)}\
.tl .seg.off{background:#238636}\
.tl-legend{display:flex;gap:14px;margin-top:6px;font-size:10px;color:var(--text-secondary,#8b949e)}\
.tl-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}\
.foot{display:flex;justify-content:space-between;align-items:center;padding:8px 14px 12px;color:var(--text-tertiary,#6e7681);font-size:10px}\
.foot .next{font-variant-numeric:tabular-nums}\
.remind{display:flex;align-items:center;gap:6px;color:var(--text-secondary,#8b949e);font-size:11px}\
.switch{width:28px;height:15px;border-radius:999px;background:var(--border,#30363d);position:relative;cursor:pointer;transition:background .25s}\
.switch.on{background:var(--accent2,#3fb950)}\
.switch::after{content:"";position:absolute;top:2px;left:2px;width:11px;height:11px;border-radius:50%;background:#fff;transition:left .25s}\
.switch.on::after{left:15px}\
/* ===== 响应式：桌面鱼缸 / 移动胶囊 ===== */\
@media (min-width:769px){\
.pill{display:none}\
.aqua{display:block}\
.panel{bottom:140px}\
}\
@media (max-width:768px){\
.aqua{display:none}\
.pill{display:flex}\
.panel{bottom:58px}\
}\
</style>\
<div class="wrap" id="wrap">\
  <div class="toast" id="toast"></div>\
  <div class="aqua" id="aqua">\
    <canvas id="aqCanvas" width="150" height="92"></canvas>\
    <span class="aq-x" id="aqClose" title="关闭">✕</span>\
    <span class="aq-next" id="aqNext"></span>\
    <div class="aq-bar" id="aqBar">\
      <span class="nm" id="aqName">—</span>\
      <span class="pr" id="aqPrice"></span><span class="caret" id="aqCaret">▸</span>\
    </div>\
  </div>\
  <div class="pill" id="pill">\
    <span class="icon" id="pillIcon"></span><span class="label" id="pillLabel">—</span>\
    <span class="price" id="pillPrice"></span><span class="x" id="closeBtn">✕</span>\
  </div>\
</div>\
<div class="panel" id="panel">\
  <div class="phead">\
    <div class="t">峰哥 &amp; 谷哥 值班表<small id="ver"></small></div>\
    <span class="status" id="status">—</span>\
  </div>\
  <div class="motto" id="motto"></div>\
  <div class="tabs">\
    <div class="tab active" data-m="flash">Flash-0731</div>\
    <div class="tab" data-m="pro">Pro-0813</div>\
  </div>\
  <div class="price-box">\
    <div class="prow"><span class="k">输入 · 缓存命中</span><span><span class="v" id="pCh"></span><span class="tag">元/百万tokens</span></span></div>\
    <div class="prow"><span class="k">输入 · 缓存未命中</span><span><span class="v" id="pCm"></span><span class="tag">元/百万tokens</span></span></div>\
    <div class="prow"><span class="k">输出</span><span><span class="v" id="pOut"></span><span class="tag">元/百万tokens</span></span></div>\
  </div>\
  <div class="timeline">\
    <div class="tl-title">时段 (北京时间)</div>\
    <div class="tl" id="tl"></div>\
    <div class="tl-legend"><span><i style="background:var(--warn,#f0883e)"></i>峰哥 9-12/14-18</span><span><i style="background:#238636"></i>谷哥 半价</span></div>\
  </div>\
  <div class="foot">\
    <span class="remind"><span class="switch" id="remindSw"></span>切换变色提醒</span>\
    <span class="next" id="nextSwitch"></span>\
  </div>\
</div>';

  document.body.appendChild(host);
  var $ = function (id) { return shadow.getElementById(id); };
  var wrap = $('wrap'), pill = $('pill'), panel = $('panel'), closeBtn = $('closeBtn');
  var aqua = $('aqua'), aqCanvas = $('aqCanvas'), aqClose = $('aqClose'), aqNext = $('aqNext'), aqBar = $('aqBar');
  var aqName = $('aqName'), aqPrice = $('aqPrice');
  var pillLabel = $('pillLabel'), pillPrice = $('pillPrice'), pillIcon = $('pillIcon');
  var statusEl = $('status'), verEl = $('ver'), tlEl = $('tl'), mottoEl = $('motto'), toastEl = $('toast');
  var pCh = $('pCh'), pCm = $('pCm'), pOut = $('pOut');
  var nextEl = $('nextSwitch'), remindSw = $('remindSw');

  var currentModel = 'flash';
  var remindOn = true;
  try { remindOn = localStorage.getItem('__ds_remind__') !== '0'; } catch (e) {}

  // ---- 调侃文案 ----
  var PEAK_MOTTOS = ['峰哥上班，钱包打烊', '人挤人，峰哥笑纳', '现在调用，都是峰哥价', '错峰一时爽，一直错峰一直爽', '高峰路上，峰哥收过路费'];
  var OFF_MOTTOS = ['谷哥营业，半价捡漏', '谷底风景好，谷哥请客', '趁谷哥在，多囤点 token', '夜猫子福利，谷哥买单', '低谷抄底，谷哥陪你'];
  var ICON_PEAK = '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M2 20 L8 8 L12 14 L16 5 L22 20 Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>';
  var ICON_OFF = '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M2 6 L8 18 L12 11 L16 17 L22 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>';
  var lastMottoIdx = -1, lastMottoPeak = null, toastTimer = null;
  function pickMotto(arr) {
    var i;
    do { i = Math.floor(Math.random() * arr.length); } while (i === lastMottoIdx && arr.length > 1);
    lastMottoIdx = i;
    return arr[i];
  }
  function showToast(msg, color) {
    toastEl.textContent = msg;
    toastEl.style.borderColor = color;
    toastEl.style.color = color;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3000);
  }

  // ---- 像素鱼缸动画（桌面陪伴式 · 主题系统 + 全效果） ----
  var AQ_W = 150, AQ_H = 92;
  var aqCtx = aqCanvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  aqCanvas.width = AQ_W * dpr;
  aqCanvas.height = AQ_H * dpr;
  aqCanvas.style.width = AQ_W + 'px';
  aqCanvas.style.height = AQ_H + 'px';
  aqCtx.scale(dpr, dpr);

  // 主题系统
  var AQUA_THEMES = {
    'default': { fishColor: null, deadColor: null, waterRGB: null, decorations: [], fishBelly: null, fishFin: null, fishStripe: null, fishEye: null },
    'winter':  { fishColor: '#dce4ec', fishBelly: '#c3d5e3', fishFin: '#a8c4da', fishStripe: '#eef4f9', fishEye: '#3a4a5a', deadColor: '#6e7681', waterRGB: '140,180,220', decorations: ['snow'] },
    'autumn':  { fishColor: '#f0d68a', fishBelly: '#e4bc6c', fishFin: '#b8864a', fishStripe: '#c08848', fishEye: '#5a4020', deadColor: '#8b7355', waterRGB: '180,140,80', decorations: ['leaves'] },
    'spring':  { fishColor: null, deadColor: null, waterRGB: '180,200,240', decorations: ['petals'], fishBelly: null, fishFin: null, fishStripe: null, fishEye: null }
  };
  var activeTheme = AQUA_THEMES['default'];
  var decoParticles = []; // 装饰粒子

  // 鱼状态（含性格+过渡+悬停反应）
  var fish = {
    x: 40, y: 50, tx: 40, ty: 50, dir: 1, speed: 0.7, tail: 0,
    dead: false, color: '#e6edf3', belly: '#a8b4c0', fin: '#8b949e', stripe: null, eyeColor: '#000', deadColor: '#6e7681',
    state: 'swim', stateTimer: 0, mouthPhase: 0, pecPhase: 0,
    flipProgress: 0, dartCd: 0, prevDir: 1, celebrate: 0, eyeOx: 0, eyeOy: 0, eaten: false
  };
  var waterNow = 0.5, waterTarget = 0.5, waterRGB = '88,166,255';
  var lastFishPeak = null, aqRaf = null;

  // ---- 彩蛋系统 ----（开久了偶尔触发：捕食者吃鱼 / 多条同伴鱼 / 鱼跃出水）
  var eggFrame = 0, eggCooldown = 300;
  var predator = null, extraFish = [], jumping = false, jumpPhase = 0, jumpBaseY = 0;
  var EGG_COLORS = ['#f0b429', '#5aa9e6', '#f2a6c2', '#9be564', '#c89bf0'];

  function spawnPredator() {
    var fromLeft = Math.random() < 0.5;
    predator = {
      x: fromLeft ? -18 : AQ_W + 18, y: 28 + Math.random() * 42,
      tx: fish.x, ty: fish.y, dir: fromLeft ? 1 : -1,
      speed: 2.6 + Math.random() * 0.5, color: fromLeft ? '#4a5a6a' : '#6a5a4a',
      victim: false
    };
  }
  function spawnCompanions() {
    var n = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (var i = 0; i < n; i++) {
      var fromLeft = Math.random() < 0.5;
      extraFish.push({
        x: fromLeft ? -8 : AQ_W + 8, y: 24 + Math.random() * 48,
        tx: 16 + Math.random() * (AQ_W - 32), ty: 22 + Math.random() * 52,
        dir: fromLeft ? 1 : -1, speed: 0.45 + Math.random() * 0.35,
        tail: Math.random() * 3, age: 0, life: 800 + Math.floor(Math.random() * 500),
        color: EGG_COLORS[Math.floor(Math.random() * EGG_COLORS.length)]
      });
    }
  }
  function startJump() { if (!fish.dead) { jumping = true; jumpPhase = 0; jumpBaseY = fish.y; } }

  function drawPredator(ctx, pd) {
    ctx.save(); ctx.translate(Math.round(pd.x), Math.round(pd.y)); ctx.scale(pd.dir, 1); ctx.scale(2.4, 2.4);
    ctx.fillStyle = pd.color;
    ctx.fillRect(-10, -2, 20, 6); ctx.fillRect(-8, -3, 12, 8); ctx.fillRect(-5, -6, 9, 11);
    ctx.fillRect(-13, -2, 3, 3); ctx.fillRect(-13, 0, 3, 3);
    // 张开的大嘴
    ctx.fillStyle = '#111'; ctx.fillRect(9, -4, 4, 4); ctx.fillRect(9, 0, 4, 4);
    // 尖牙
    ctx.fillStyle = '#fff'; ctx.fillRect(8, -3, 1, 1); ctx.fillRect(8, 2, 1, 1); ctx.fillRect(10, -3, 1, 1); ctx.fillRect(10, 2, 1, 1);
    // 眼
    ctx.fillStyle = '#000'; ctx.fillRect(4, -3, 2, 2); ctx.fillStyle = '#fff'; ctx.fillRect(4, -3, 1, 1);
    ctx.restore();
  }
  function drawExtraFish(ctx, ef) {
    ctx.save(); ctx.translate(Math.round(ef.x), Math.round(ef.y)); ctx.scale(ef.dir, 1); ctx.scale(0.7, 0.7);
    ctx.fillStyle = ef.color;
    ctx.fillRect(-8, -2, 12, 5); ctx.fillRect(-6, -3, 9, 7); ctx.fillRect(-4, -4, 6, 8);
    ctx.fillRect(-11, -1, 3, 3); ctx.fillRect(-11, 1, 3, 3);
    ctx.fillRect(-1, -6, 3, 2); ctx.fillRect(2, 3, 2, 2);
    ctx.fillStyle = '#111'; ctx.fillRect(4, -3, 2, 2); ctx.fillStyle = '#fff'; ctx.fillRect(4, -3, 1, 1);
    ctx.restore();
  }

  // ---- 彩蛋：特效实体（fx）+ 场景标志 ----
  var fx = [];
  var scene = { light: 0, current: 0, drip: 0, dust: 0 };
  var fishFx = { golden: 0, spin: 0 };

  function spawnFx(type, opts) {
    var f = { type: type, age: 0, life: 600, x: 0, y: 0, vx: 0, vy: 0, dir: 1 };
    if (opts) for (var k in opts) f[k] = opts[k];
    fx.push(f); return f;
  }
  function spawnHeart() {
    for (var i = 0; i < 2; i++) spawnFx('heart', {
      x: fish.x + (i ? 7 : -4), y: fish.y - 4, vx: (Math.random() - 0.5) * 0.25, vy: -(0.5 + Math.random() * 0.3),
      life: 90 + Math.random() * 40, color: i ? '#ff8ab0' : '#ff5c8a', s: 1 + Math.random()
    });
  }
  function spawnBubRain() {
    for (var i = 0; i < 14; i++) bubbles.push({
      x: 4 + Math.random() * (AQ_W - 8), y: AQ_H - 3, r: 1 + Math.random() * 2.5,
      vy: -(0.5 + Math.random() * 0.6), wobble: Math.random() * 6, alpha: 0.7
    });
  }
  function spawnJelly() { var l = Math.random() < 0.5; spawnFx('jelly', { x: l ? -10 : AQ_W + 10, y: 28 + Math.random() * 30, vx: l ? 0.4 : -0.4, dir: l ? 1 : -1, life: 900 }); }
  function spawnCrab() { var l = Math.random() < 0.5; spawnFx('crab', { x: l ? -8 : AQ_W + 8, y: AQ_H - 6, vx: l ? 0.35 : -0.35, dir: l ? 1 : -1, life: 900 }); }
  function spawnStarfish() { spawnFx('star', { x: 12 + Math.random() * (AQ_W - 24), y: AQ_H - 5, life: 500 }); }
  function spawnTurtle() { var l = Math.random() < 0.5; spawnFx('turtle', { x: l ? -14 : AQ_W + 14, y: 36 + Math.random() * 22, vx: l ? 0.32 : -0.32, dir: l ? 1 : -1, life: 1000 }); }
  function spawnShadow() { var l = Math.random() < 0.5; spawnFx('shadow', { x: l ? -36 : AQ_W + 36, y: 18 + Math.random() * 40, vx: l ? 0.8 : -0.8, dir: l ? 1 : -1, life: 700 }); }
  function spawnSquid() { var l = Math.random() < 0.5; spawnFx('squid', { x: l ? -12 : AQ_W + 12, y: 24 + Math.random() * 30, vx: l ? 0.5 : -0.5, dir: l ? 1 : -1, life: 800 }); }
  function spawnRainbow() {
    var cols = ['#ff5f57', '#ffbd2e', '#28c840', '#45a1ff', '#b45cff', '#ff7ad1'];
    for (var i = 0; i < 6; i++) bubbles.push({
      x: fish.x + fish.dir * 8, y: fish.y - 2, r: 1.5 + Math.random(), vy: -(0.5 + Math.random() * 0.2),
      wobble: i * 1.1, alpha: 0.9, color: cols[i]
    });
  }

  function drawHeart(ctx, f) {
    ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y));
    ctx.globalAlpha = Math.min(1, f.age / 12); ctx.fillStyle = f.color;
    ctx.fillRect(-2, -1, 4, 2); ctx.fillRect(-1, -3, 2, 2);
    ctx.fillRect(-3, 0, 6, 2); ctx.fillRect(-1, 2, 2, 1);
    ctx.restore();
  }
  function drawJelly(ctx, f, t) {
    ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y)); ctx.globalAlpha = 0.65;
    ctx.fillStyle = 'rgba(200,225,255,0.6)'; ctx.fillRect(-5, -5, 10, 4); ctx.fillRect(-7, -3, 14, 3);
    ctx.fillStyle = 'rgba(200,225,255,0.35)';
    for (var i = 0; i < 3; i++) ctx.fillRect(-3 + i * 3, 2 + Math.sin(t * 2 + i) * 1.5, 2, 6);
    ctx.restore();
  }
  function drawCrab(ctx, f, t) {
    ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y)); ctx.scale(f.dir, 1);
    ctx.fillStyle = '#d8642a'; ctx.fillRect(-4, -2, 8, 4);
    ctx.fillRect(-5, -4, 2, 3); ctx.fillRect(3, -4, 2, 3);
    ctx.fillStyle = '#000'; ctx.fillRect(-3, -2, 2, 2); ctx.fillRect(1, -2, 2, 2);
    ctx.restore();
  }
  function drawStarfish(ctx, f) {
    ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y));
    ctx.fillStyle = '#e89b6a';
    ctx.fillRect(-1, -3, 2, 2); ctx.fillRect(-3, -1, 2, 2); ctx.fillRect(1, -1, 2, 2);
    ctx.fillRect(-1, 1, 2, 2); ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  function drawTurtle(ctx, f, t) {
    ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y)); ctx.scale(f.dir, 1);
    ctx.fillStyle = '#4f8f3a'; ctx.fillRect(-4, -4, 8, 6);
    ctx.fillStyle = '#6fae57'; ctx.fillRect(-2, -3, 4, 4);
    ctx.fillStyle = '#3a6f2c'; ctx.fillRect(-5, 2, 3, 2); ctx.fillRect(2, 2, 3, 2);
    ctx.fillStyle = '#b0d888'; ctx.fillRect(4, -3, 3, 4);
    ctx.fillStyle = '#000'; ctx.fillRect(5, -3, 2, 2);
    ctx.restore();
  }
  function drawShadow(ctx, f) {
    ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y)); ctx.scale(f.dir, 1); ctx.scale(3, 3);
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#0a0f14';
    ctx.fillRect(-8, -2, 14, 4); ctx.fillRect(-6, -3, 9, 6);
    ctx.fillRect(-12, -3, 4, 3); ctx.fillRect(-12, 1, 4, 3);
    ctx.fillRect(6, -2, 3, 2);
    ctx.restore();
  }
  function drawSquid(ctx, f, t) {
    ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y)); ctx.scale(f.dir, 1);
    ctx.fillStyle = '#b46ad8'; ctx.fillRect(-4, -4, 8, 6); ctx.fillRect(4, -3, 3, 4);
    ctx.fillStyle = 'rgba(180,106,216,0.5)';
    for (var i = 0; i < 4; i++) ctx.fillRect(-3 + i * 2, 2 + Math.sin(t * 2 + i) * 1.5, 2, 6);
    ctx.restore();
  }
  function drawBubFx(ctx, f) { drawBubble(ctx, f.x, f.y, f.r, f.alpha); }

  function updateFx(t, waterTop) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i]; f.age++;
      f.x += f.vx; f.y += f.vy;
      if (f.type === 'heart') { f.x += Math.sin(t + f.age * 0.1) * 0.2; }
      if (f.age > f.life || f.x < -40 || f.x > AQ_W + 40) fx.splice(i, 1);
    }
    if (fishFx.golden > 0) fishFx.golden--;
    if (fishFx.spin > 0) fishFx.spin--;
    if (scene.light > 0) scene.light--;
    if (scene.current > 0) scene.current--;
    if (scene.drip > 0) scene.drip--;
    if (scene.dust > 0) scene.dust--;
  }

  // 手动/自动共用的彩蛋触发器：随机抽一个彩蛋执行
  function triggerEgg() {
    var r = Math.random();
    if (r < 0.07 && !fish.dead) spawnPredator();                 // 1 大鱼吃鱼
    else if (r < 0.14 && !fish.dead && extraFish.length === 0) spawnCompanions(); // 2 同伴鱼
    else if (r < 0.20 && !fish.dead && !jumping) startJump();    // 3 跳跃
    else if (r < 0.26 && !fish.dead) spawnHeart();               // 4 冒爱心
    else if (r < 0.32 && !fish.dead) spawnRainbow();             // 5 彩虹泡泡
    else if (r < 0.38) spawnJelly();                             // 6 水母
    else if (r < 0.44) spawnCrab();                              // 7 螃蟹
    else if (r < 0.50) spawnStarfish();                          // 8 海星
    else if (r < 0.56) spawnTurtle();                            // 9 海龟
    else if (r < 0.62) spawnShadow();                            // 10 鲨鱼剪影
    else if (r < 0.68) spawnSquid();                             // 11 乌贼
    else if (r < 0.74) spawnBubRain();                           // 12 泡泡雨
    else if (r < 0.78 && !fish.dead) fishFx.golden = 150;        // 13 变金闪光
    else if (r < 0.82 && !fish.dead) { fishFx.spin = 60; addRipple(fish.x, fish.y); } // 14 转圈
    else if (r < 0.86) scene.light = 220;                        // 15 光线增强
    else if (r < 0.90) scene.current = 220;                      // 16 洋流水草加速
    else if (r < 0.94) scene.drip = 240;                         // 17 玻璃水珠滑落
    else if (r < 0.98) scene.dust = 200;                         // 18 尘埃风暴
    else if (!fish.dead) spawnHeart();                           // 兜底
  }

  function updateEggs(t, waterTop) {
    // 触发：约12s后活跃，开越久频率越高（v3.3.2 启动砍半+概率调大；点鱼缸5次可手动触发）
    eggFrame++;
    if (eggCooldown > 0) eggCooldown--;
    if (eggFrame > 750 && eggCooldown <= 0 && !predator) {
      var p = 0.0025 + Math.min(0.011, (eggFrame - 750) / 30000);
      if (Math.random() < p) {
        eggCooldown = 450 + Math.floor(Math.random() * 900); // ~7~22s 冷却（再缩短）
        triggerEgg();
      }
    }
    // 捕食者
    if (predator) {
      var pdx = predator.tx - predator.x, pdy = predator.ty - predator.y;
      var pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pdist > 1) { predator.x += pdx / pdist * predator.speed; predator.y += pdy / pdist * predator.speed; }
      predator.dir = pdx > 0 ? 1 : -1;
      // 近身 → 吞掉主角
      if (!fish.dead && !fish.eaten && pdist < 11) {
        fish.eaten = true; fish.x = -30; fish.y = -30;
        burstBubbles(); addRipple(predator.x, predator.y);
        predator.victim = true;
        predator.tx = Math.random() < 0.5 ? -32 : AQ_W + 32;
        predator.ty = 20 + Math.random() * 60;
      }
      // 捕食者离场 → 主角重生
      if (predator.victim && (predator.x < -28 || predator.x > AQ_W + 28)) {
        fish.eaten = false;
        fish.x = AQ_W / 2; fish.y = Math.max(waterTop + 8, AQ_H / 2);
        fish.tx = fish.x; fish.ty = fish.y; fish.state = 'swim'; fish.stateTimer = 0;
        fish.celebrate = 30; fish.dartCd = 90;
        burstBubbles(); addRipple(fish.x, fish.y);
        predator = null;
      } else if (predator.x < -32 || predator.x > AQ_W + 32) {
        predator = null;
      }
    }
    // 同伴鱼
    for (var ei = extraFish.length - 1; ei >= 0; ei--) {
      var ef = extraFish[ei];
      ef.age++;
      var edx = ef.tx - ef.x, edy = ef.ty - ef.y;
      var edist = Math.sqrt(edx * edx + edy * edy);
      if (edist > 2) { ef.x += edx / edist * ef.speed; ef.y += edy / edist * ef.speed; ef.dir = edx > 0 ? 1 : -1; }
      else { ef.tx = 14 + Math.random() * (AQ_W - 28); ef.ty = 24 + Math.random() * 50; }
      if (ef.y < waterTop + 4) ef.y = waterTop + 4;
      ef.x = Math.max(6, Math.min(AQ_W - 6, ef.x));
      if (ef.age > ef.life) { ef.tx = ef.x < AQ_W / 2 ? -30 : AQ_W + 30; if (ef.x < -20 || ef.x > AQ_W + 20) extraFish.splice(ei, 1); }
    }
    // 跳跃
    if (jumping) {
      jumpPhase++;
      if (jumpPhase < 60) {
        var k = jumpPhase / 60;
        fish.y = jumpBaseY - Math.sin(k * Math.PI) * 22;
        if (jumpPhase % 12 === 0) addRipple(fish.x, waterTop + 4);
      } else { jumping = false; fish.y = jumpBaseY; }
    }
    // 特效实体
    updateFx(t, waterTop);
  }

  // 鼠标悬停追踪
  var cursorX = -1, cursorY = -1, cursorInTank = false;
  aqCanvas.addEventListener('mousemove', function (e) {
    var rect = aqCanvas.getBoundingClientRect();
    cursorX = (e.clientX - rect.left) * (AQ_W / rect.width);
    cursorY = (e.clientY - rect.top) * (AQ_H / rect.height);
    cursorInTank = cursorX >= 0 && cursorX <= AQ_W && cursorY >= 0 && cursorY <= AQ_H;
  });
  aqCanvas.addEventListener('mouseleave', function () { cursorInTank = false; cursorX = -1; cursorY = -1; });

  // 水体系统
  var waves = [
    { ph: 0, amp: 1.0, freq: 0.16, spd: 14, dy: 0 },
    { ph: 1.7, amp: 1.5, freq: 0.22, spd: 16, dy: 3 },
    { ph: 3.4, amp: 2.0, freq: 0.28, spd: 12, dy: 5 },
    { ph: 0.8, amp: 0.8, freq: 0.34, spd: 18, dy: 7 },
    { ph: 2.5, amp: 1.2, freq: 0.20, spd: 15, dy: 2 }
  ];
  var caustics = [{ x: 30, ph: 0, spd: 0.3 }, { x: 80, ph: 2, spd: 0.4 }, { x: 120, ph: 4, spd: 0.25 }];
  var ripples = [], gravel = [], plants = [];
  var PLANT_COL = ['#1f5c3a', '#2a6e46', '#1b4d31', '#2f7f52', '#174234'];
  (function () {
    var spots = [10, 26, 44, 62, 84, 104, 122, 140];
    for (var i = 0; i < spots.length; i++) {
      plants.push({
        x: spots[i] + (Math.random() * 4 - 2),
        stems: 1 + (i % 2),                       // 1~2 茎，克制不抢戏
        h: 12 + Math.floor(Math.random() * 12),   // 12~24 矮，背景化
        ph: Math.random() * 6.28,
        col: PLANT_COL[Math.floor(Math.random() * PLANT_COL.length)]
      });
    }
  })();
  var glassDrops = [{ x: 8, y: 15 }, { x: 142, y: 25 }, { x: 5, y: 60 }, { x: 135, y: 70 }, { x: 145, y: 10 }];
  (function () {
    for (var i = 0; i < 22; i++) gravel.push({
      x: 5 + Math.random() * (AQ_W - 10), y: AQ_H - 3 - Math.random() * 3,
      sz: 1 + Math.floor(Math.random() * 2), sh: Math.random() * 0.3
    });
  })();

  // 尘埃粒子（水中悬浮物）
  var dust = [];
  (function () {
    for (var i = 0; i < 25; i++) dust.push({
      x: Math.random() * AQ_W, y: Math.random() * AQ_H,
      vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.06,
      sz: Math.random() < 0.5 ? 1 : 2, alpha: 0.12 + Math.random() * 0.12
    });
  })();

  var bubbles = [], burst = [], food = [];

  // ---- 鱼食系统 ----
  function addFood(x, y) {
    var n = 3 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      food.push({
        x: x + (Math.random() * 10 - 5), y: y + (Math.random() * 6 - 3),
        r: 1.2 + Math.random() * 0.8, vy: 0.12 + Math.random() * 0.2,
        age: 0, wobble: Math.random() * 6
      });
    }
  }
  function findNearestFood() {
    var best = null, bestDist = 1e9;
    for (var i = 0; i < food.length; i++) {
      var fdd = (food[i].x - fish.x) * (food[i].x - fish.x) + (food[i].y - fish.y) * (food[i].y - fish.y);
      if (fdd < bestDist) { bestDist = fdd; best = food[i]; }
    }
    return best;
  }
  function removeFood(f) {
    var idx = food.indexOf(f);
    if (idx >= 0) food.splice(idx, 1);
  }

  function addRipple(x, y) { ripples.push({ x: x, y: y, r: 1, maxR: 8 + Math.random() * 6, alpha: 0.5 }); }
  function burstBubbles() {
    for (var i = 0; i < 12; i++) burst.push({
      x: fish.x + (Math.random() * 30 - 15), y: fish.y + (Math.random() * 12 - 6),
      r: 1 + Math.random() * 2.5, vy: -(0.7 + Math.random()), wobble: Math.random() * 6, alpha: 0.9
    });
  }
  function spawnMouthBubbles(n) {
    for (var i = 0; i < n; i++) bubbles.push({
      x: fish.x + fish.dir * (6 + Math.random() * 3), y: fish.y - 2 + Math.random() * 2,
      r: 1 + Math.random() * 1.5, vy: -(0.3 + Math.random() * 0.3), wobble: Math.random() * 6, alpha: 0.7
    });
  }

  // ---- 绘制函数 ----（主角鱼：明确鱼形+丑萌——流线身体+分叉尾鳍+背鳍+尖头，大眼+腮红）
  function drawPixelFish(ctx, x, y, dir, color, eyeColor, tailSwing, pecSwing, mouthOpen, eyeOx, eyeOy) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(dir, 1);
    ctx.fillStyle = color;
    // 尾柄（细，连接身体）
    ctx.fillRect(-12, -2, 3, 4);
    // 流线身体（中部宽高，往尾收窄，往头变尖）
    ctx.fillRect(-10, -3, 5, 6);
    ctx.fillRect(-6, -5, 9, 10);
    ctx.fillRect(-4, -6, 8, 3);   // 背部隆起
    ctx.fillRect(3, -4, 4, 8);    // 头
    ctx.fillRect(7, -3, 3, 6);    // 头尖
    ctx.fillRect(9, -2, 2, 4);    // 最前端（嘴）
    // 背鳍（顶部小三角）
    ctx.fillRect(-3, -9, 5, 2); ctx.fillRect(-5, -8, 3, 1);
    // 尾鳍（分叉扇形，随尾摆）
    ctx.fillRect(-15, -5, 4, 3);
    ctx.fillRect(-15, 2, 4, 3);
    ctx.fillRect(-13, -2 + Math.round(tailSwing), 3, 4);
    // 胸鳍/腹鳍
    ctx.fillRect(2, 4 + Math.round(pecSwing * 1.2), 3, 2);
    ctx.fillRect(-2, 5, 3, 1);
    // 高光鳞片（淡银点缀）
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(-3, -3, 2, 2); ctx.fillRect(1, -2, 2, 2);
    // 腮红（萌）
    ctx.fillStyle = 'rgba(255,150,160,0.5)';
    ctx.fillRect(1, -1, 3, 2);
    // 眼睛（大眼白+黑瞳+高光，头部近嘴，呆萌追踪光标）
    var ex = 6 + Math.round(eyeOx), ey = -4 + Math.round(eyeOy);
    ctx.fillStyle = '#fff'; ctx.fillRect(ex, ey, 3, 3);
    ctx.fillStyle = eyeColor; ctx.fillRect(ex + 1, ey + 1, 2, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(ex + 1, ey, 1, 1);
    // 嘟嘴（头部最前端）
    ctx.fillStyle = '#222';
    if (mouthOpen) ctx.fillRect(11, -2, 2, 2); else ctx.fillRect(11, -1, 2, 1);
    ctx.restore();
  }
  function drawDeadFish(ctx, x, y, color, flip) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(1, 1 - flip * 2);
    ctx.globalAlpha = flip < 0.5 ? 0.6 + flip * 0.8 : 1;
    ctx.fillStyle = color;
    ctx.fillRect(-8, -2, 12, 5); ctx.fillRect(-6, -3, 10, 7);
    ctx.fillRect(-4, -4, 7, 8); ctx.fillRect(-10, -1, 3, 3);
    ctx.fillStyle = '#000'; ctx.fillRect(3, -2, 2, 2); ctx.fillRect(5, 0, 2, 2);
    ctx.globalAlpha = 1; ctx.restore();
  }
  function drawBubble(ctx, x, y, r, alpha, color) {
    var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    if (color) {
      grad.addColorStop(0, 'rgba(255,255,255,' + (alpha * 0.25) + ')');
      grad.addColorStop(0.7, color);
      grad.addColorStop(1, 'rgba(255,255,255,0.1)');
    } else {
      grad.addColorStop(0, 'rgba(255,255,255,' + (alpha * 0.15) + ')');
      grad.addColorStop(0.7, 'rgba(200,230,255,' + (alpha * 0.4) + ')');
      grad.addColorStop(1, 'rgba(180,220,255,' + (alpha * 0.1) + ')');
    }
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function drawSeaweed(ctx, plant, waterTop, t, surge) {
    // 背景化：暗绿 + 低透明度 + 微摆 + 矮，不抢主角鱼视线
    if (!surge) surge = 1;
    ctx.globalAlpha = 0.5;
    for (var s = 0; s < plant.stems; s++) {
      var bx = plant.x + s * 3 - 1, py = AQ_H - 1;
      var len = plant.h * (1 - s * 0.2);
      if (len < 7) len = 7;
      for (var seg = 0; seg < len; seg += 3) {
        if (py - 3 < waterTop + 3) break;   // 只在水下生长
        var sway = Math.sin(t * 0.5 + plant.ph + seg * 0.1 + s) * 1.8 * surge; // 微摆，scene.current 时加速
        ctx.fillStyle = (seg % 4 < 2) ? plant.col : '#143629';
        ctx.fillRect(Math.round(bx + sway), py, 3, 3);
        py -= 2;
      }
      ctx.fillStyle = plant.col;
      ctx.fillRect(Math.round(bx + Math.sin(t * 0.5 + plant.ph + s) * 1.8 * surge) - 1, py, 4, 2); // 顶叶
    }
    ctx.globalAlpha = 1;
  }

  // 装饰粒子绘制器
  function drawDecoSnow(ctx, p) {
    ctx.fillStyle = 'rgba(255,255,255,' + p.alpha + ')';
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }
  function drawDecoLeaf(ctx, p) {
    ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y));
    ctx.rotate(p.rot || 0);
    ctx.fillStyle = p.alpha > 0.3 ? 'rgba(200,120,40,' + p.alpha + ')' : 'rgba(160,100,30,' + p.alpha + ')';
    ctx.fillRect(-2, -1, 4, 2); ctx.fillRect(-1, -2, 2, 4);
    ctx.restore();
  }
  function drawDecoPetal(ctx, p) {
    ctx.fillStyle = 'rgba(255,180,200,' + p.alpha + ')';
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    ctx.fillRect(Math.round(p.x) + 1, Math.round(p.y) - 1, 1, 1);
  }

  // ---- 主动画循环 ----
  function aqTick() {
    if (document.visibilityState === 'hidden') { aqRaf = requestAnimationFrame(aqTick); return; }
    var t = Date.now() / 500;
    var waterTop = AQ_H - AQ_H * waterNow;

    // === 1. 鱼状态机 ===
    fish.stateTimer++; fish.mouthPhase += 0.15; fish.pecPhase += 0.12;
    fish.dartCd = Math.max(0, fish.dartCd - 1);
    if (fish.celebrate > 0) fish.celebrate--;

    if (!fish.dead && fish.state !== 'reviving' && !fish.eaten) {
      // 鱼眼追踪光标（瞳孔偏向光标方向）
      if (cursorInTank) {
        fish.eyeOx = Math.max(-1, Math.min(1, (cursorX - fish.x) / 30));
        fish.eyeOy = Math.max(-1, Math.min(1, (cursorY - fish.y) / 30));
      } else { fish.eyeOx *= 0.85; fish.eyeOy *= 0.85; }

      // 觅食：有食物且非受惊/挣扎 → 去
      var foodTarget = (fish.state !== 'dart' && fish.state !== 'hesitate' && fish.state !== 'struggle' && fish.state !== 'dying') ? findNearestFood() : null;
      if (foodTarget) fish.state = 'seekFood';

      // 悬停反应：鱼好奇地朝鼠标靠近（加强）
      if (cursorInTank && (fish.state === 'swim' || fish.state === 'idle' || fish.state === 'seekFood')) {
        var cdx = cursorX - fish.x, cdy = cursorY - fish.y;
        var cdist = Math.sqrt(cdx * cdx + cdy * cdy);
        if (cdist < 55 && cdist > 6 && !foodTarget) {
          // 靠近（好奇），比原来明显
          fish.tx += (cursorX - fish.tx) * 0.05;
          fish.ty += (cursorY - fish.ty) * 0.05;
        }
        // 突然移入 → 受惊
        if (cdist < 14 && fish.state === 'swim' && fish.dartCd <= 0) {
          fish.state = 'dart'; fish.stateTimer = 0;
          fish.dir = fish.x < AQ_W / 2 ? -1 : 1; // 逃向远离鼠标方向
          fish.dartCd = 60;
          addRipple(fish.x, fish.y);
        }
      }

      if (fish.state === 'seekFood') {
        if (foodTarget) {
          var fdx = foodTarget.x - fish.x, fdy = foodTarget.y - fish.y;
          var fdist = Math.sqrt(fdx * fdx + fdy * fdy);
          if (fdist > 7) {
            fish.x += fdx / fdist * fish.speed * 1.4;
            fish.y += fdy / fdist * fish.speed * 1.4;
            fish.dir = fdx > 0 ? 1 : -1;
          } else {
            removeFood(foodTarget); // 吃掉
            fish.mouthPhase = 3; fish.pecPhase = 3;
            spawnMouthBubbles(1);
            fish.celebrate = Math.max(fish.celebrate, 6);
            foodTarget = findNearestFood();
            if (!foodTarget) { fish.state = 'swim'; fish.stateTimer = 0; }
          }
        } else { fish.state = 'swim'; fish.stateTimer = 0; }
      } else if (fish.state === 'swim') {
        if (Math.random() < 0.012 || (Math.abs(fish.x - fish.tx) < 5 && Math.abs(fish.y - fish.ty) < 5)) {
          fish.tx = 14 + Math.random() * (AQ_W - 28);
          var minY = Math.max(waterTop + 8, 14);
          fish.ty = minY + Math.random() * Math.max(6, (AQ_H - 10) - minY);
          if (Math.random() < 0.25) { fish.state = 'idle'; fish.stateTimer = 0; }
          if (fish.dartCd <= 0 && Math.random() < 0.12) {
            fish.state = 'dart'; fish.stateTimer = 0;
            fish.dartCd = 180 + Math.floor(Math.random() * 120);
            addRipple(fish.x, fish.y);
          }
        }
        if (fish.x < 18 || fish.x > AQ_W - 18) { fish.state = 'hesitate'; fish.stateTimer = 0; }
        var dx = fish.tx - fish.x, dy = fish.ty - fish.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          var step = fish.speed;
          fish.x += dx / dist * step; fish.y += dy / dist * step;
          if (Math.abs(dx) > 1) {
            if (fish.dir !== (dx > 0 ? 1 : -1)) addRipple(fish.x, fish.y);
            fish.dir = dx > 0 ? 1 : -1;
          }
        }
      } else if (fish.state === 'idle') {
        if (fish.stateTimer > 60 + Math.floor(Math.random() * 120)) {
          fish.state = 'swim';
          if (Math.random() < 0.5) spawnMouthBubbles(1);
        }
        fish.y += Math.sin(t * 1.5) * 0.15;
      } else if (fish.state === 'dart') {
        fish.x += fish.dir * fish.speed * 3.5; fish.tail += 0.5;
        if (fish.stateTimer > 30 || fish.x < 14 || fish.x > AQ_W - 14) {
          fish.state = 'swim'; fish.stateTimer = 0;
          fish.dir = -fish.dir; addRipple(fish.x, fish.y);
          fish.tx = fish.x; fish.ty = fish.y;
        }
      } else if (fish.state === 'hesitate') {
        fish.speed = Math.max(0.2, fish.speed * 0.92);
        if (fish.stateTimer > 20) {
          fish.dir = -fish.dir; fish.state = 'swim'; fish.stateTimer = 0;
          fish.tx = AQ_W / 2 + (Math.random() - 0.5) * 60;
        }
      } else if (fish.state === 'struggle') {
        fish.speed = 0.3 + Math.random() * 1.5;
        fish.x += (Math.random() - 0.5) * 3; fish.y += (Math.random() - 0.5) * 2;
        fish.dir = Math.random() < 0.5 ? -1 : 1;
        if (fish.stateTimer > 100) { fish.state = 'dying'; fish.stateTimer = 0; }
      } else if (fish.state === 'dying') {
        if (fish.stateTimer <= 6) spawnMouthBubbles(1); // 最后的呼吸
        fish.flipProgress = Math.min(1, fish.stateTimer / 90);
        fish.y += 0.3;
        if (fish.flipProgress >= 1) { fish.dead = true; fish.state = 'dead'; fish.flipProgress = 1; }
      }
      if (fish.y < waterTop + 4) fish.y = waterTop + 4;
      if (fish.y > AQ_H - 8) fish.y = AQ_H - 8;
      fish.x = Math.max(12, Math.min(AQ_W - 12, fish.x));
      fish.tail += 0.12 * fish.speed * 8;
    }
    // 复活过渡
    if (fish.state === 'reviving') {
      fish.flipProgress = Math.max(0, 1 - fish.stateTimer / 90);
      if (fish.stateTimer <= 30) {
        fish.mouthPhase = 3; // 嘴巴大张
        if (fish.stateTimer === 1) burstBubbles(); // 气泡爆发
        if (fish.stateTimer % 6 < 3) fish.x += (Math.random() - 0.5) * 3; // 剧烈抖动
      }
      if (fish.flipProgress <= 0) {
        fish.state = 'swim'; fish.stateTimer = 0; fish.dead = false; fish.flipProgress = 0;
        fish.celebrate = 40; // 庆祝冲刺
        fish.dir = Math.random() < 0.5 ? 1 : -1;
        addRipple(fish.x, fish.y);
      }
    }
    // 庆祝冲刺
    if (fish.celebrate > 0 && !fish.dead) {
      fish.x += fish.dir * 1.8;
      if (fish.x < 14 || fish.x > AQ_W - 14) fish.dir = -fish.dir;
      fish.x = Math.max(12, Math.min(AQ_W - 12, fish.x));
    }
    if (!fish.dead && fish.state === 'swim' && fish.celebrate <= 0) {
      fish.speed = 0.35 + waterNow * 0.7;
    }

    // === 1.5 彩蛋 ===
    updateEggs(t, waterTop);

    // === 2. 气泡 ===
    if (!fish.dead && Math.random() < 0.025) {
      var br = 1 + Math.random() * 3;
      bubbles.push({
        x: fish.x - fish.dir * 6 + (Math.random() * 10 - 5), y: fish.y + 3,
        r: br, vy: -(0.2 + br * 0.12), wobble: Math.random() * 6, alpha: 0.6
      });
    }
    for (var bi = bubbles.length - 1; bi >= 0; bi--) {
      var b = bubbles[bi]; b.y += b.vy; b.x += Math.sin(t * 2 + b.wobble) * 0.3; b.alpha -= 0.003;
      if (b.y < 2 || b.alpha <= 0) bubbles.splice(bi, 1);
    }
    for (var bj = burst.length - 1; bj >= 0; bj--) {
      var bb = burst[bj]; bb.y += bb.vy; bb.x += Math.sin(t * 2 + bb.wobble) * 0.2; bb.alpha -= 0.018;
      if (bb.y < 0 || bb.alpha <= 0) burst.splice(bj, 1);
    }

    // === 2b. 鱼食（下沉 + 消融） ===
    var foodFloor = AQ_H - 10; // 停在鱼能游到的位置（鱼 clamp 到 AQ_H-8，留 2px 余量够到）
    for (var fi = food.length - 1; fi >= 0; fi--) {
      var fd = food[fi];
      fd.age++; fd.y += fd.vy; fd.x += Math.sin(t * 2 + fd.wobble) * 0.15;
      if (fd.y > foodFloor) { fd.y = foodFloor; fd.vy = 0; }
      if (fd.age > 450) food.splice(fi, 1); // ~7.5秒未吃自动消融，避免残留
    }

    // === 3. 涟漪 ===
    for (var ri = ripples.length - 1; ri >= 0; ri--) {
      var rp = ripples[ri]; rp.r += 0.3; rp.alpha -= 0.02;
      if (rp.alpha <= 0) ripples.splice(ri, 1);
    }

    // === 4. 尘埃粒子 ===
    for (var di = 0; di < dust.length; di++) {
      var d = dust[di];
      d.x += d.vx + Math.sin(t * 0.3 + di) * 0.02;
      d.y += d.vy + Math.cos(t * 0.2 + di * 1.3) * 0.015;
      if (d.x < 2) d.x = AQ_W - 2; if (d.x > AQ_W - 2) d.x = 2;
      if (d.y < waterTop + 2) d.vy = Math.abs(d.vy);
      if (d.y > AQ_H - 2) d.vy = -Math.abs(d.vy);
    }

    // === 5. 装饰粒子（主题） ===
    var decoType = activeTheme.decorations.length > 0 ? activeTheme.decorations[0] : null;
    if (decoType && waterNow > 0.1) {
      if (decoParticles.length < 18 && Math.random() < 0.06) {
        var np = { x: Math.random() * AQ_W, y: -4, vx: 0, vy: 0, alpha: 0.6 + Math.random() * 0.3, rot: 0, type: decoType };
        if (decoType === 'snow') { np.vy = 0.15 + Math.random() * 0.1; np.vx = (Math.random() - 0.5) * 0.05; }
        else if (decoType === 'leaves') { np.vy = 0.12 + Math.random() * 0.08; np.vx = 0.08 + Math.random() * 0.06; np.rot = Math.random() * 3; }
        else if (decoType === 'petals') { np.vy = 0.08 + Math.random() * 0.06; np.vx = (Math.random() - 0.5) * 0.04; }
        decoParticles.push(np);
      }
      for (var dk = decoParticles.length - 1; dk >= 0; dk--) {
        var dp = decoParticles[dk];
        dp.y += dp.vy; dp.x += dp.vx + Math.sin(t + dk) * 0.02;
        if (decoType === 'leaves') dp.rot += 0.02;
        dp.alpha -= 0.001;
        if (dp.y > waterTop - 2 || dp.alpha <= 0) { decoParticles.splice(dk, 1); }
      }
    } else { decoParticles = []; }

    // === 6. 水位缓动 ===
    waterNow += (waterTarget - waterNow) * 0.04;

    // === 7. 绘制 ===
    aqCtx.clearRect(0, 0, AQ_W, AQ_H);

    // 碎石
    aqCtx.globalAlpha = 0.5;
    for (var gi = 0; gi < gravel.length; gi++) {
      var gp = gravel[gi]; var gs = Math.floor(60 + gp.sh * 30);
      aqCtx.fillStyle = 'rgb(' + gs + ',' + (gs + 10) + ',' + (gs + 25) + ')';
      aqCtx.fillRect(Math.round(gp.x), Math.round(gp.y), gp.sz, gp.sz);
    }
    aqCtx.globalAlpha = 1;

    var wh = AQ_H * waterNow;
    if (wh > 1) {
      // 光束（对角，非常淡）
      var beamX = 20 + Math.sin(t * 0.15) * 10;
      var beamAlpha = 0.025 + Math.sin(t * 0.4) * 0.008 + (scene.light > 0 ? 0.055 : 0);
      aqCtx.fillStyle = 'rgba(255,255,255,' + beamAlpha + ')';
      aqCtx.beginPath();
      aqCtx.moveTo(beamX, AQ_H - wh); aqCtx.lineTo(beamX + 8, AQ_H - wh);
      aqCtx.lineTo(beamX + 35, AQ_H); aqCtx.lineTo(beamX + 25, AQ_H);
      aqCtx.closePath(); aqCtx.fill();
      aqCtx.fillStyle = 'rgba(255,255,255,' + (beamAlpha * 0.7) + ')';
      aqCtx.beginPath();
      aqCtx.moveTo(beamX + 60, AQ_H - wh); aqCtx.lineTo(beamX + 66, AQ_H - wh);
      aqCtx.lineTo(beamX + 85, AQ_H); aqCtx.lineTo(beamX + 77, AQ_H);
      aqCtx.closePath(); aqCtx.fill();

      // 水体渐变
      var grad = aqCtx.createLinearGradient(0, AQ_H - wh, 0, AQ_H);
      grad.addColorStop(0, 'rgba(' + waterRGB + ',0.52)');
      grad.addColorStop(1, 'rgba(' + waterRGB + ',0.18)');
      aqCtx.fillStyle = grad; aqCtx.fillRect(0, AQ_H - wh, AQ_W, wh);

      // caustics
      for (var ci = 0; ci < caustics.length; ci++) {
        var cs = caustics[ci];
        aqCtx.fillStyle = 'rgba(255,255,255,0.06)';
        aqCtx.beginPath();
        aqCtx.ellipse(cs.x + Math.sin(t * cs.spd + cs.ph) * 15, AQ_H - 4 + Math.cos(t * cs.spd * 0.7 + cs.ph) * 2, 6, 3, Math.sin(t * 0.3 + cs.ph) * 0.5, 0, Math.PI * 2);
        aqCtx.fill();
      }

      // 5 层波浪
      for (var wi = 0; wi < waves.length; wi++) {
        var w = waves[wi], baseY = AQ_H - wh + w.dy;
        aqCtx.strokeStyle = 'rgba(' + waterRGB + ',' + (0.22 + wi * 0.08) + ')';
        aqCtx.lineWidth = 1; aqCtx.beginPath();
        for (var wx = 0; wx <= AQ_W; wx += 3) {
          var wy = baseY + Math.sin((wx + t * w.spd) * w.freq + w.ph) * w.amp;
          if (wx === 0) aqCtx.moveTo(wx, wy); else aqCtx.lineTo(wx, wy);
        }
        aqCtx.stroke();
      }

      // 流动光带
      var shift = (t * 26) % (AQ_W + 80) - 40;
      aqCtx.fillStyle = 'rgba(255,255,255,0.04)';
      aqCtx.beginPath();
      aqCtx.moveTo(shift - 14, AQ_H - wh); aqCtx.lineTo(shift + 10, AQ_H - wh);
      aqCtx.lineTo(shift + 30, AQ_H); aqCtx.lineTo(shift + 6, AQ_H);
      aqCtx.closePath(); aqCtx.fill();

      // 高光点
      for (var si = 0; si < 3; si++) {
        aqCtx.fillStyle = 'rgba(255,255,255,0.10)';
        aqCtx.fillRect(Math.round(((t * 22 + si * 55) % (AQ_W + 20)) - 10), Math.round(AQ_H - wh + 2 + Math.sin(t * 2 + si * 2.1) * 2), 3, 2);
      }

      // 水面张力（meniscus）
      aqCtx.fillStyle = 'rgba(' + waterRGB + ',0.4)';
      aqCtx.fillRect(0, AQ_H - wh - 2, 3, 3);
      aqCtx.fillRect(0, AQ_H - wh - 1, 2, 2);
      aqCtx.fillRect(AQ_W - 3, AQ_H - wh - 2, 3, 3);
      aqCtx.fillRect(AQ_W - 2, AQ_H - wh - 1, 2, 2);

      // 涟漪
      for (var rj = 0; rj < ripples.length; rj++) {
        var rr = ripples[rj];
        aqCtx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, rr.alpha) + ')';
        aqCtx.lineWidth = 1; aqCtx.beginPath(); aqCtx.arc(rr.x, rr.y, rr.r, 0, Math.PI * 2); aqCtx.stroke();
      }

      // 水草
      for (var pi = 0; pi < plants.length; pi++) drawSeaweed(aqCtx, plants[pi], waterTop, t, (scene.current > 0 ? 2.2 : 1));
    }

    // 尘埃粒子（有水时；scene.dust>0 用加速版，模拟被扰动）
    if (waterNow > 0.1) {
      for (var dd = 0; dd < dust.length; dd++) {
        var dp2 = dust[dd];
        if (scene.dust > 0) {
          dp2.x += dp2.vx * 2 + Math.sin(t * 0.8 + dd) * 0.25;
          dp2.y += dp2.vy * 2 + Math.cos(t * 0.6 + dd * 1.3) * 0.2;
        }
        aqCtx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, dp2.alpha + (scene.dust > 0 ? 0.25 : 0)) + ')';
        aqCtx.fillRect(Math.round(dp2.x), Math.round(dp2.y), dp2.sz, dp2.sz > 1 ? 1 : dp2.sz);
      }
    }

    // 装饰粒子
    for (var dm = 0; dm < decoParticles.length; dm++) {
      var dpp = decoParticles[dm];
      if (dpp.type === 'snow') drawDecoSnow(aqCtx, dpp);
      else if (dpp.type === 'leaves') drawDecoLeaf(aqCtx, dpp);
      else if (dpp.type === 'petals') drawDecoPetal(aqCtx, dpp);
    }

    // 气泡
    for (var bk = 0; bk < bubbles.length; bk++) drawBubble(aqCtx, bubbles[bk].x, bubbles[bk].y, bubbles[bk].r, Math.max(0, bubbles[bk].alpha), bubbles[bk].color);
    for (var bl = 0; bl < burst.length; bl++) drawBubble(aqCtx, burst[bl].x, burst[bl].y, burst[bl].r, Math.max(0, burst[bl].alpha));

    // 鱼食
    for (var fo = 0; fo < food.length; fo++) {
      var fdp = food[fo];
      aqCtx.fillStyle = 'rgba(230,150,80,0.85)';
      aqCtx.fillRect(Math.round(fdp.x), Math.round(fdp.y), 2, 2);
    }

    // 背景生物 fx（画在主角前，作为背景层）
    for (var fxi = 0; fxi < fx.length; fxi++) {
      var fxe = fx[fxi];
      if (fxe.type === 'jelly') drawJelly(aqCtx, fxe, t);
      else if (fxe.type === 'crab') drawCrab(aqCtx, fxe, t);
      else if (fxe.type === 'star') drawStarfish(aqCtx, fxe);
      else if (fxe.type === 'turtle') drawTurtle(aqCtx, fxe, t);
      else if (fxe.type === 'shadow') drawShadow(aqCtx, fxe);
      else if (fxe.type === 'squid') drawSquid(aqCtx, fxe, t);
    }
    // 鱼（应用彩蛋 flags：金色 / 转圈）
    var drawColor = fish.color, drawDir = fish.dir;
    if (fishFx.golden > 0) drawColor = '#f6c945';
    if (fishFx.spin > 0) drawDir = (Math.floor(t * 6) % 2 === 0) ? fish.dir : -fish.dir;
    if (fish.dead || fish.state === 'dying') {
      drawDeadFish(aqCtx, fish.x, AQ_H - 8, fish.deadColor, fish.flipProgress);
    } else if (fish.state === 'reviving') {
      drawDeadFish(aqCtx, fish.x, AQ_H - 8 - fish.flipProgress * 20, fish.deadColor, fish.flipProgress);
    } else if (!fish.eaten) {
      drawPixelFish(aqCtx, fish.x, fish.y, drawDir, drawColor, fish.eyeColor,
        Math.sin(fish.tail) * 1.5, Math.sin(fish.pecPhase) * 1.5, Math.sin(fish.mouthPhase) > 0.7, fish.eyeOx, fish.eyeOy);
    }
    // 前景 fx（爱心等，画在主角之上）
    for (var fxi2 = 0; fxi2 < fx.length; fxi2++) {
      var fxe2 = fx[fxi2];
      if (fxe2.type === 'heart') drawHeart(aqCtx, fxe2);
    }

    // 玻璃效果
    aqCtx.fillStyle = 'rgba(255,255,255,0.08)';
    aqCtx.fillRect(2, 2, 8, 1); aqCtx.fillRect(2, 2, 1, 6);
    aqCtx.fillRect(AQ_W - 10, AQ_H - 3, 8, 1); aqCtx.fillRect(AQ_W - 3, AQ_H - 9, 1, 7);
    aqCtx.fillStyle = 'rgba(255,255,255,0.07)';
    for (var dgi = 0; dgi < glassDrops.length; dgi++) aqCtx.fillRect(glassDrops[dgi].x, glassDrops[dgi].y, 2, 2);
    if (scene.drip > 0) {
      aqCtx.fillStyle = 'rgba(255,255,255,0.18)';
      for (var dri = 0; dri < 4; dri++) {
        var dxp = 12 + dri * 34;
        var dyp = (t * 1.2 + dri * 11) % AQ_H;
        aqCtx.fillRect(Math.round(dxp), Math.round(dyp), 2, 3);
      }
    }
    var vg1 = aqCtx.createLinearGradient(0, 0, 0, AQ_H);
    vg1.addColorStop(0, 'rgba(0,0,0,0.06)'); vg1.addColorStop(0.08, 'rgba(0,0,0,0)');
    vg1.addColorStop(0.92, 'rgba(0,0,0,0)'); vg1.addColorStop(1, 'rgba(0,0,0,0.06)');
    aqCtx.fillStyle = vg1; aqCtx.fillRect(0, 0, AQ_W, AQ_H);
    var vg2 = aqCtx.createLinearGradient(0, 0, AQ_W, 0);
    vg2.addColorStop(0, 'rgba(0,0,0,0.05)'); vg2.addColorStop(0.06, 'rgba(0,0,0,0)');
    vg2.addColorStop(0.94, 'rgba(0,0,0,0)'); vg2.addColorStop(1, 'rgba(0,0,0,0.05)');
    aqCtx.fillStyle = vg2; aqCtx.fillRect(0, 0, AQ_W, AQ_H);

    aqRaf = requestAnimationFrame(aqTick);
  }

  // ---- 拖动 ----
  var dragging = false, dragMoved = false, wasDragged = false;
  var dragOffX = 0, dragOffY = 0, dragStartX = 0, dragStartY = 0;
  wrap.addEventListener('mousedown', function (e) {
    if (e.target === closeBtn || closeBtn.contains(e.target)) return;
    if (e.target === aqClose || aqClose.contains(e.target)) return;
    dragging = true; dragMoved = false;
    // 记录鼠标相对 wrap 左上角的偏移（不是绝对坐标！）
    var rect = wrap.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
    dragStartX = e.clientX; dragStartY = e.clientY;
    wrap.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
    if (dragMoved) {
      var nx = e.clientX - dragOffX, ny = e.clientY - dragOffY;
      // 浮窗本体 clamp 在视口内（不能拖出窗口）
      var wr0 = wrap.getBoundingClientRect();
      var ww = wr0.width, whh = wr0.height;
      var vw0 = window.innerWidth, vh0 = window.innerHeight;
      if (nx < 8) nx = 8;
      if (nx + ww > vw0 - 8) nx = vw0 - 8 - ww;
      if (ny < 8) ny = 8;
      if (ny + whh > vh0 - 8) ny = vh0 - 8 - whh;
      wrap.style.left = nx + 'px';
      wrap.style.top = ny + 'px';
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
      // 面板跟随（拖动中实时重算位置，视口内 clamp）
      if (open) positionPanel();
    }
  });
  window.addEventListener('mouseup', function () {
    if (dragging) {
      wrap.classList.remove('dragging');
      dragging = false;
      if (dragMoved) {
        wasDragged = true;
        wrap.setAttribute('data-dragged', '1');
        setTimeout(function () {
          wrap.removeAttribute('data-dragged');
          wasDragged = false; dragMoved = false;
        }, 300);
      }
    }
  });

  // ---- 状态 ----
  var lastPeak = null, lastBlink = 0;

  function render() {
    var p = nowParts();
    var peak = isPeak(p.h, p.m, p.dow);
    var m = MODELS[currentModel];
    var price = peak ? m.cacheMiss.peak : m.cacheMiss.off;
    var priceOut = peak ? m.output.peak : m.output.off;

    // 桌面鱼缸状态
    aqName.textContent = peak ? '峰哥' : '谷哥';
    aqName.className = 'nm ' + (peak ? 'peak' : 'off');
    aqua.className = 'aqua ' + (peak ? 'peak' : 'off');
    aqPrice.textContent = '输入 ¥' + fmt(price) + ' / 输出 ¥' + fmt(priceOut);
    // 鱼缸倒计时（简短）
    var ns = nextSwitchSec(p.d);
    var hh = Math.floor(ns / 3600), mm = Math.floor((ns % 3600) / 60), ss = ns % 60;
    var toName = peak ? '谷哥' : '峰哥';
    aqNext.textContent = ns >= 3600
      ? hh + ':' + pad2(mm) + ':' + pad2(ss) + ' 后转' + toName
      : pad2(mm) + ':' + pad2(ss) + ' 后转' + toName;
    // 主题色（跟随主站 CSS 变量，不用硬编码）
    fish.color = themeColor('--text', '#e6edf3');
    fish.belly = themeColor('--text-secondary', '#8b949e');
    fish.fin = themeColor('--text-tertiary', '#6e7681');
    fish.eyeColor = '#000';
    fish.deadColor = themeColor('--text-tertiary', '#6e7681');

    // 主题系统解析
    var _themeName = window.__AQUA_THEME__ || 'default';
    activeTheme = AQUA_THEMES[_themeName] || (window.AQUA_THEMES && window.AQUA_THEMES[_themeName]) || AQUA_THEMES['default'];
    if (activeTheme.fishColor) fish.color = activeTheme.fishColor;
    if (activeTheme.fishBelly) fish.belly = activeTheme.fishBelly;
    if (activeTheme.fishFin) fish.fin = activeTheme.fishFin;
    if (activeTheme.fishStripe) fish.stripe = activeTheme.fishStripe;
    if (activeTheme.fishEye) fish.eyeColor = activeTheme.fishEye;
    if (activeTheme.deadColor) fish.deadColor = activeTheme.deadColor;
    if (activeTheme.waterRGB) waterRGB = activeTheme.waterRGB;
    else waterRGB = hexToRgb(themeColor('--accent', '#58a6ff')); // 修 bug：主题无水色才回退 accent
    // 水位 = 当前谷时段剩余比例（谷开始满水，谷结束水干）；峰=0 水干
    waterTarget = peak ? 0 : waterLevelFor(p);
    // 鱼状态：谷=活鱼游动，峰=水干鱼死（翻白肚沉底）；切换瞬间冒泡爆发
    if (lastFishPeak !== peak) {
      lastFishPeak = peak;
      fish.dead = peak;
      if (peak) {
        fish.y = AQ_H - 10; fish.tx = fish.x; fish.ty = fish.y;
      } else {
        fish.y = Math.max(AQ_H - AQ_H * Math.max(waterLevelFor(p), 0.2) - 12, 14);
        fish.tx = fish.x; fish.ty = fish.y;
      }
      burstBubbles();
    }
    // 活鱼游速随水位：水满游得快，水快干游得慢（挣扎）
    if (!fish.dead) {
      fish.speed = 0.35 + waterNow * 0.7;
    }

    // 移动胶囊（回退样式）
    pill.className = 'pill ' + (peak ? 'peak' : 'off');
    pillIcon.innerHTML = peak ? ICON_PEAK : ICON_OFF;
    pillLabel.textContent = peak ? '梁文峰' : '梁文谷';
    pillPrice.textContent = '输入 ¥' + fmt(price) + ' / 输出 ¥' + fmt(priceOut);

    // 面板状态
    statusEl.className = 'status ' + (peak ? 'peak' : 'off');
    statusEl.textContent = peak ? '⛰ 梁文峰 · 高峰时段' : '🌙 梁文谷 · 空闲时段 (半价)';
    verEl.textContent = m.name + '-' + m.ver;
    var ch = peak ? m.cacheHit.peak : m.cacheHit.off;
    var cm = peak ? m.cacheMiss.peak : m.cacheMiss.off;
    var out = peak ? m.output.peak : m.output.off;
    pCh.textContent = '¥' + fmt(ch);
    pCh.className = 'v ' + (peak ? 'peak' : 'off');
    pCm.textContent = '¥' + fmt(cm);
    pCm.className = 'v ' + (peak ? 'peak' : 'off');
    pOut.textContent = '¥' + fmt(out);
    pOut.className = 'v ' + (peak ? 'peak' : 'off');

    // 调侃 motto（只在首次渲染/时段切换时换，避免每秒闪烁）
    if (lastMottoPeak !== peak || !mottoEl.textContent) {
      mottoEl.textContent = pickMotto(peak ? PEAK_MOTTOS : OFF_MOTTOS);
      mottoEl.className = 'motto ' + (peak ? 'peak' : 'off');
      lastMottoPeak = peak;
    }

    // 倒计时（面板）
    nextEl.textContent = ns < 60
      ? (peak ? '谷哥 ' + ss + ' 秒后接棒，半价开抢！' : '峰哥 ' + ss + ' 秒后上班，钱包快跑！')
      : ns < 3600
        ? (peak ? '谷哥再陪 ' + pad2(mm) + ':' + pad2(ss) : '峰哥再榨 ' + pad2(mm) + ':' + pad2(ss))
        : (peak ? hh + ':' + pad2(mm) + ':' + pad2(ss) + ' 后转空闲' : hh + ':' + pad2(mm) + ':' + pad2(ss) + ' 后转高峰');

    // 更新时间轴刻度线位置
    updateTimelineCursor();

    // 时段切换 → 变色/闪烁提醒
    if (lastPeak !== null && lastPeak !== peak) {
      blinkPanel(peak);
    }
    lastPeak = peak;
  }

  function blinkPanel(peak) {
    if (!remindOn) return;
    var now = Date.now();
    if (now - lastBlink < 4000) return;
    lastBlink = now;
    var c = peak ? '#f0883e' : '#3fb950';
    showToast(peak ? '⛰ 峰哥上班了！' : '🌙 谷哥接棒，半价开抢！', c);
    panel.style.transition = 'box-shadow .2s, border-color .2s';
    panel.style.borderColor = c;
    panel.style.boxShadow = '0 0 0 3px ' + c + '55, 0 12px 40px rgba(0,0,0,.5)';
    setTimeout(function () {
      panel.style.borderColor = '#30363d';
      panel.style.boxShadow = '0 12px 40px rgba(0,0,0,.5)';
    }, 1800);
  }

  // ---- 时间轴 ----
  var tlCursor = null;
  function buildTimeline() {
    var isWk = isWeekendDay(new Date());
    var segs = [
      { s: 0, e: 9, type: 'off' },
      { s: 9, e: 12, type: isWk ? 'off' : 'peak' },
      { s: 12, e: 14, type: 'off' },
      { s: 14, e: 18, type: isWk ? 'off' : 'peak' },
      { s: 18, e: 24, type: 'off' }
    ];
    tlEl.innerHTML = '';
    segs.forEach(function (seg) {
      var el = document.createElement('div');
      el.className = 'seg ' + seg.type;
      el.style.width = ((seg.e - seg.s) / 24 * 100) + '%';
      el.style.position = 'relative';
      tlEl.appendChild(el);
    });
    // 当前时间指示线（竖线+三角标记）
    tlCursor = document.createElement('div');
    tlCursor.style.cssText = 'position:absolute;top:-3px;bottom:-3px;width:2px;background:#fff;z-index:10;pointer-events:none;transition:left .3s ease;box-shadow:0 0 4px rgba(255,255,255,.6)';
    var tri = document.createElement('div');
    tri.style.cssText = 'position:absolute;top:-5px;left:-4px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #fff';
    tlCursor.appendChild(tri);
    tlEl.style.position = 'relative';
    tlEl.appendChild(tlCursor);
    updateTimelineCursor();
  }
  function updateTimelineCursor() {
    if (!tlCursor) return;
    var p = nowParts();
    var pct = (p.h * 3600 + p.m * 60 + p.s) / 86400 * 100;
    tlCursor.style.left = pct + '%';
  }

  // ---- 交互 ----
  var open = false;
  // 面板定位：优先浮窗上方，空间不足翻下方；任何情况都不与浮窗重叠、
  // 不超出视口（高度按可用空间限制，内容可滚动）
  function positionPanel() {
    var wr = wrap.getBoundingClientRect();
    var vh = window.innerHeight, vw = window.innerWidth;
    var gap = 8, margin = 8;
    var ph = panel.offsetHeight || 300;
    var pw = panel.offsetWidth || 330;
    var left = wr.left;
    if (left + pw > vw - margin) left = vw - margin - pw;
    if (left < margin) left = margin;
    // 浮窗上方/下方可用高度（扣除边距，保证不重叠）
    var above = wr.top - gap - margin;
    var below = vh - wr.bottom - gap - margin;
    var top, maxH;
    if (above >= ph || above >= below) {
      // 上方空间足够，或比下方更充裕 → 放上方，高度限制到浮窗顶部为止
      top = Math.max(margin, wr.top - ph - gap);
      maxH = Math.max(120, Math.min(ph, above));
      if (top + maxH > vh - margin) maxH = vh - margin - top;
    } else {
      // 下方空间更充裕 → 放浮窗下方
      top = wr.bottom + gap;
      maxH = Math.max(120, Math.min(ph, below));
    }
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.maxHeight = Math.max(120, maxH) + 'px';
  }
  function togglePanel() {
    open = !open;
    panel.classList.toggle('open', open);
    aqua.classList.toggle('open', open);
    if (open) {
      positionPanel();
      buildTimeline(); render();
    }
  }
  pill.addEventListener('click', function (e) {
    if (e.target === closeBtn || closeBtn.contains(e.target)) { closeWidget(); return; }
    if (wrap.getAttribute('data-dragged') === '1' || wasDragged) return;
    togglePanel();
  });
  // 点鱼缸5次 → 手动触发一次彩蛋（连击计数）
  var tapCount = 0, tapLastT = 0;
  // 鱼缸交互：数据条开面板；点鱼身受惊；点水体投喂
  aqua.addEventListener('click', function (e) {
    if (e.target === aqClose || aqClose.contains(e.target)) return;
    if (wrap.getAttribute('data-dragged') === '1' || wasDragged) return;
    // 点数据条 → 展开/收起面板
    if (e.target === aqBar || aqBar.contains(e.target)) { togglePanel(); return; }
    // 映射点击坐标到画布坐标系
    var rect = aqCanvas.getBoundingClientRect();
    if (rect.width === 0) return;
    var cx = (e.clientX - rect.left) * (AQ_W / rect.width);
    var cy = (e.clientY - rect.top) * (AQ_H / rect.height);
    // 点鱼缸5次（2秒内）→ 手动触发一次彩蛋
    var now = Date.now();
    if (now - tapLastT > 2000) tapCount = 0;
    tapLastT = now; tapCount++;
    if (tapCount >= 5) {
      tapCount = 0;
      triggerEgg();
      burstBubbles(); addRipple(fish.x, fish.y);
      addFood(cx, cy);
    }
    var fdx = cx - fish.x, fdy = cy - fish.y;
    var fdist = Math.sqrt(fdx * fdx + fdy * fdy);
    if (fdist < 12 && !fish.dead && fish.state !== 'dying' && fish.state !== 'reviving') {
      // 点鱼身 → 敲缸受惊（急逃）
      fish.state = 'dart'; fish.stateTimer = 0;
      fish.dir = cx > AQ_W / 2 ? -1 : 1;
      fish.dartCd = 70;
      addRipple(cx, cy);
    } else {
      // 点水体 → 投喂
      addFood(cx, cy);
      addRipple(cx, cy);
    }
  });
  // 关闭浮窗：sessionStorage 优先（重开浏览器=新会话=恢复显示），
  // sessionStorage 不可用时 localStorage 时间戳兜底（6小时内不复活）
  function closeWidget() {
    var ssOk = true;
    try { sessionStorage.setItem(CLOSE_KEY, '1'); } catch (e) { ssOk = false; }
    if (!ssOk) {
      try { localStorage.setItem(CLOSE_KEY, String(Date.now())); } catch (e) {}
    }
    host.style.display = 'none';
  }
  closeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    closeWidget();
  });
  aqClose.addEventListener('click', function (e) {
    e.stopPropagation();
    closeWidget();
  });
  // 模型切换
  shadow.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      shadow.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      currentModel = t.getAttribute('data-m');
      render();
    });
  });
  // 提醒开关
  remindSw.addEventListener('click', function () {
    remindOn = !remindOn;
    remindSw.classList.toggle('on', remindOn);
    try { localStorage.setItem('__ds_remind__', remindOn ? '1' : '0'); } catch (e) {}
  });
  remindSw.classList.toggle('on', remindOn);

  // ---- 启动 ----
  // 1) sessionStorage 有关闭标记 → 本次会话不再显示（重开浏览器=新会话=恢复）
  try {
    if (sessionStorage.getItem(CLOSE_KEY) === '1') {
      host.style.display = 'none';
      return;
    }
  } catch (e) {}
  // 2) sessionStorage 无标记但 localStorage 有 6 小时内的兜底关闭时间戳
  //    （覆盖 sessionStorage 不可用/被清空的浏览器环境，避免刷新后浮窗复活）
  try {
    var closeTs = parseInt(localStorage.getItem(CLOSE_KEY) || '', 10);
    if (closeTs && Date.now() - closeTs < CLOSE_TTL) {
      host.style.display = 'none';
      return;
    }
  } catch (e) {}
  render();
  buildTimeline();
  setInterval(render, 1000);
  aqRaf = requestAnimationFrame(aqTick); // 启动像素鱼动画
})();
