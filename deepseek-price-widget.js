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
:host{all:initial}\
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}\
.wrap{position:fixed;right:14px;bottom:14px;z-index:999999;user-select:none;cursor:grab}\
.wrap.dragging{cursor:grabbing}\
/* ===== 桌面鱼缸 (陪伴式) ===== */\
.aqua{position:relative;width:150px;height:118px;border-radius:12px;overflow:hidden;\
border:1px solid var(--border,#30363d);background:linear-gradient(180deg,var(--card,#161b22),rgba(13,17,23,.88));\
box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer;\
transition:border-color .3s,box-shadow .3s}\
.aqua.peak{border-color:var(--warn,#f0883e);box-shadow:0 6px 18px rgba(240,136,62,.22)}\
.aqua.off{border-color:var(--accent,#58a6ff);box-shadow:0 6px 18px rgba(88,166,255,.20)}\
.aqua canvas{display:block;width:150px;height:92px;pointer-events:none}\
.aq-x{position:absolute;top:3px;right:3px;width:18px;height:18px;line-height:16px;text-align:center;\
font-size:11px;color:var(--text-tertiary,#6e7681);border-radius:4px;cursor:pointer;z-index:5;\
background:rgba(0,0,0,.25);font-family:monospace}\
.aq-x:hover{color:#f85149;background:rgba(248,81,73,.2)}\
.aq-bar{position:absolute;left:0;right:0;bottom:0;height:26px;display:flex;align-items:center;justify-content:space-between;\
padding:0 7px;background:rgba(13,17,23,.82);border-top:1px solid var(--border2,#21262d);color:var(--text,#e6edf3);\
font-size:10px;z-index:4;font-variant-numeric:tabular-nums}\
.aq-bar .nm{font-weight:700;font-size:11px}\
.aq-bar .nm.peak{color:var(--warn,#f0883e)}\
.aq-bar .nm.off{color:var(--accent,#58a6ff)}\
.aq-bar .pr{color:var(--text2,#8b949e);white-space:nowrap}\
.aq-next{position:absolute;top:3px;left:5px;font-size:9px;color:var(--text-tertiary,#8b949e);z-index:5;\
background:rgba(0,0,0,.22);padding:1px 4px;border-radius:3px;font-variant-numeric:tabular-nums}\
/* ===== 移动胶囊 (回退) ===== */\
.pill{display:none;align-items:center;gap:6px;background:var(--card,#161b22);border:1px solid var(--border,#30363d);border-radius:999px;\
padding:7px 13px;color:var(--text,#e6edf3);font-size:12px;box-shadow:0 4px 14px rgba(0,0,0,.25);\
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
    <div class="aq-bar">\
      <span class="nm" id="aqName">—</span>\
      <span class="pr" id="aqPrice"></span>\
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
  var aqua = $('aqua'), aqCanvas = $('aqCanvas'), aqClose = $('aqClose'), aqNext = $('aqNext');
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

  // ---- 像素鱼缸动画（桌面陪伴式） ----
  var AQ_W = 150, AQ_H = 92; // canvas 逻辑尺寸
  var aqCtx = aqCanvas.getContext('2d');
  // 鱼状态：活=主题文字色(白)，死=灰色(--text-tertiary)；
  // 谷时段水满鱼游，峰时段水干鱼死（翻白肚沉底）
  var fish = { x: 40, y: 50, tx: 40, ty: 50, dir: 1, speed: 0.7, tail: 0, dead: false, color: '#e6edf3', deadColor: '#6e7681' };
  var bubbles = [];       // 常驻气泡 {x,y,r,vy,alpha}
  var burst = [];         // 切换爆发气泡
  var waterNow = 0.5;     // 当前水位（缓动到目标）
  var waterTarget = 0.5;  // 目标水位：谷=谷时段剩余比例，峰=0(水干)
  var waterRGB = '88,166,255'; // 谷水颜色（主题 --accent 蓝，render 时刷新）
  var lastFishPeak = null;
  var aqRaf = null;

  function burstBubbles() {
    for (var i = 0; i < 10; i++) {
      burst.push({
        x: fish.x + (Math.random() * 26 - 13),
        y: fish.y + (Math.random() * 10 - 5),
        r: 1 + Math.random() * 2,
        vy: -(0.6 + Math.random() * 0.9),
        alpha: 0.9
      });
    }
  }
  function drawPixelFish(ctx, x, y, dir, color, tail) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(dir, 1);
    ctx.fillStyle = color;
    // 尾巴（摆动）
    ctx.fillRect(-10, -2 + Math.round(tail), 3, 4);
    ctx.fillRect(-8, -1 + Math.round(tail * 1.6), 2, 2);
    // 身体（像素块堆叠）
    ctx.fillRect(-7, -3, 12, 6);
    ctx.fillRect(-5, -4, 9, 8);
    ctx.fillRect(-3, -5, 6, 10);
    ctx.fillRect(-1, -4, 4, 8);
    // 背鳍
    ctx.fillRect(-1, -6, 4, 2);
    ctx.fillRect(1, -5, 2, 1);
    // 眼睛
    ctx.fillStyle = '#000000';
    ctx.fillRect(4, -2, 2, 2);
    ctx.restore();
  }
  // 死鱼：肚皮朝上（上下翻转），灰色，X 眼，沉在缸底不动
  function drawDeadFish(ctx, x, y, color) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(1, -1);
    ctx.fillStyle = color;
    ctx.fillRect(-7, -2, 12, 5);
    ctx.fillRect(-5, -3, 9, 7);
    ctx.fillRect(-3, -4, 6, 8);
    ctx.fillRect(-9, -1, 3, 3);
    // X 眼
    ctx.fillStyle = '#000000';
    ctx.fillRect(3, -2, 2, 2);
    ctx.fillRect(5, 0, 2, 2);
    ctx.restore();
  }
  function aqTick() {
    var waterTop = AQ_H - AQ_H * waterNow; // 当前水面 y（水位缓动中）
    if (!fish.dead) {
      // 自由游动：随机目标点，到达后换目标；y 目标限制在水面以下（鱼只在水里游）
      var minY = Math.max(waterTop + 6, 10);
      if (Math.random() < 0.012 ||
          (Math.abs(fish.x - fish.tx) < 4 && Math.abs(fish.y - fish.ty) < 4)) {
        fish.tx = 16 + Math.random() * (AQ_W - 32);
        fish.ty = minY + Math.random() * Math.max(8, (AQ_H - 8) - minY);
      }
      var dx = fish.tx - fish.x, dy = fish.ty - fish.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        var step = fish.speed;
        fish.x += dx / dist * step;
        fish.y += dy / dist * step;
        if (Math.abs(dx) > 1) fish.dir = dx > 0 ? 1 : -1;
      }
      // 硬性约束：鱼不能游出水面或缸底
      if (fish.y < waterTop + 4) fish.y = waterTop + 4;
      if (fish.y > AQ_H - 8) fish.y = AQ_H - 8;
      fish.x = Math.max(12, Math.min(AQ_W - 12, fish.x));
      fish.tail += 0.12 * fish.speed * 8;
      // 常驻气泡：从鱼尾附近缓缓升起
      if (Math.random() < 0.03) {
        bubbles.push({
          x: fish.x - fish.dir * 8 + (Math.random() * 8 - 4),
          y: fish.y + 4,
          r: 1 + Math.random() * 1.4,
          vy: -(0.25 + Math.random() * 0.4),
          alpha: 0.7
        });
      }
    }
    // 水位缓动（峰=干，谷=剩余比例；0.04 让切换时水快速退去/涨回）
    waterNow += (waterTarget - waterNow) * 0.04;
    // 绘制
    aqCtx.clearRect(0, 0, AQ_W, AQ_H);
    // 水（主题蓝，随水位；带呼吸波浪 + 流动光带动画）
    var wh = AQ_H * waterNow;
    if (wh > 1) {
      // 水体渐变（上浅下深，模拟光从水面透入）
      var grad = aqCtx.createLinearGradient(0, AQ_H - wh, 0, AQ_H);
      grad.addColorStop(0, 'rgba(' + waterRGB + ',0.52)');
      grad.addColorStop(1, 'rgba(' + waterRGB + ',0.18)');
      aqCtx.fillStyle = grad;
      aqCtx.fillRect(0, AQ_H - wh, AQ_W, wh);
      // 多层波浪线（水面呼吸感，相位错开）
      var t = Date.now() / 500;
      for (var layer = 0; layer < 3; layer++) {
        var amp = 1.0 + layer * 0.6;
        var freq = 0.16 + layer * 0.07;
        var baseY = AQ_H - wh + layer * 3;
        aqCtx.strokeStyle = 'rgba(' + waterRGB + ',' + (0.28 + layer * 0.14) + ')';
        aqCtx.lineWidth = 1;
        aqCtx.beginPath();
        for (var wx = 0; wx <= AQ_W; wx += 3) {
          var wy = baseY + Math.sin((wx + t * 14) * freq + layer * 1.7) * amp;
          if (wx === 0) aqCtx.moveTo(wx, wy); else aqCtx.lineTo(wx, wy);
        }
        aqCtx.stroke();
      }
      // 斜向流动光带（从左下往右上缓慢游走）
      var shift = (t * 26) % (AQ_W + 80) - 40;
      aqCtx.fillStyle = 'rgba(255,255,255,0.05)';
      aqCtx.beginPath();
      aqCtx.moveTo(shift - 14, AQ_H - wh);
      aqCtx.lineTo(shift + 10, AQ_H - wh);
      aqCtx.lineTo(shift + 30, AQ_H);
      aqCtx.lineTo(shift + 6, AQ_H);
      aqCtx.closePath();
      aqCtx.fill();
      // 高光点（随波闪动的小亮斑）
      for (var s = 0; s < 3; s++) {
        var sx = ((t * 22 + s * 55) % (AQ_W + 20)) - 10;
        var sy = AQ_H - wh + 2 + Math.sin(t * 2 + s * 2.1) * 2;
        aqCtx.fillStyle = 'rgba(255,255,255,0.10)';
        aqCtx.fillRect(Math.round(sx), Math.round(sy), 3, 2);
      }
    }
    // 气泡
    for (var i = bubbles.length - 1; i >= 0; i--) {
      var b = bubbles[i];
      b.y += b.vy; b.alpha -= 0.004;
      if (b.y < 2 || b.alpha <= 0) { bubbles.splice(i, 1); continue; }
      aqCtx.fillStyle = 'rgba(230,237,243,' + Math.max(0, b.alpha) + ')';
      aqCtx.fillRect(Math.round(b.x), Math.round(b.y), Math.round(b.r * 2), Math.round(b.r * 2));
    }
    // 爆发气泡（时段切换）
    for (var j = burst.length - 1; j >= 0; j--) {
      var bb = burst[j];
      bb.y += bb.vy; bb.x += Math.sin(Date.now() / 200 + bb.y) * 0.15; bb.alpha -= 0.02;
      if (bb.y < 0 || bb.alpha <= 0) { burst.splice(j, 1); continue; }
      aqCtx.fillStyle = 'rgba(230,237,243,' + Math.max(0, bb.alpha) + ')';
      aqCtx.fillRect(Math.round(bb.x), Math.round(bb.y), Math.round(bb.r * 2), Math.round(bb.r * 2));
    }
    // 鱼（死鱼翻白肚沉底 / 活鱼在水里游）
    if (fish.dead) {
      drawDeadFish(aqCtx, fish.x, AQ_H - 8, fish.deadColor);
    } else {
      drawPixelFish(aqCtx, fish.x, fish.y, fish.dir, fish.color, Math.sin(fish.tail) * 1.5);
    }
    // 玻璃高光
    aqCtx.fillStyle = 'rgba(255,255,255,0.06)';
    aqCtx.fillRect(3, 2, 5, AQ_H - 4);
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
    fish.deadColor = themeColor('--text-tertiary', '#6e7681');
    waterRGB = hexToRgb(themeColor('--accent', '#58a6ff'));
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
  // 鱼缸点击展开/收起（✕ 除外）
  aqua.addEventListener('click', function (e) {
    if (e.target === aqClose || aqClose.contains(e.target)) return;
    if (wrap.getAttribute('data-dragged') === '1' || wasDragged) return;
    togglePanel();
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
