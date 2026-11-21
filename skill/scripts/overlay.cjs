// The look of a video and the marks pinned to its lines, turned into HTML that overlay.css styles.
// dress.cjs screenshots this HTML onto the video; How-to Studio shows the same HTML as its preview.
const fs = require('fs');
const path = require('path');

const DEFAULT_LOOK = {
  caption: { font: 'sans', size: 'm', box: 'bar', place: 'bottom' },
  cursor: { shape: 'arrow', color: '#111111', click: 'ripple' },
  frame: { style: 'full', background: 'sand', padding: 'm', corners: 's', shadow: 'on', zoom: 'off' },
};
const CHOICES = {
  caption: { font: ['serif', 'sans', 'rounded'], size: ['s', 'm', 'l'], box: ['bar', 'dark', 'light', 'none'], place: ['bottom', 'top'] },
  cursor: { shape: ['ring', 'arrow', 'dot'], click: ['ripple', 'none'] },
  frame: { style: ['full', 'framed', 'browser'], background: ['sand', 'sky', 'mist', 'graphite'], padding: ['s', 'm', 'l'], corners: ['none', 's', 'l'], shadow: ['on', 'off'], zoom: ['off', 'on'] },
};
const BACKGROUNDS = {
  sand: 'linear-gradient(135deg, #F3E7D3, #E2C29F)',
  sky: 'linear-gradient(135deg, #E3EEFB, #B7CFEE)',
  mist: '#ECECEF',
  graphite: 'linear-gradient(135deg, #24252B, #111214)',
};
const PIN_KINDS = ['ring', 'label', 'arrow'];
const PAD = { s: 0.04, m: 0.07, l: 0.1 };
const RADIUS = { none: 0, s: 10, l: 20 };
const BAR = 40;
const ZOOM = { scale: 1.4, ramp: 0.5, before: 1.2, after: 0.8 };

const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const lookFiles = (project, guide) => ({ app: path.join(project, 'look.json'), video: path.join(project, 'scripts', guide, 'look.json') });

// Unknown or missing values fall back to the default, so a hand-edited file can't break a render.
function cleanLook(look) {
  const out = JSON.parse(JSON.stringify(DEFAULT_LOOK));
  for (const part of Object.keys(CHOICES)) {
    for (const [k, v] of Object.entries((look && look[part]) || {})) {
      if (CHOICES[part][k] ? CHOICES[part][k].includes(v) : part === 'cursor' && k === 'color' && /^#[0-9a-f]{6}$/i.test(v)) out[part][k] = v;
    }
  }
  return out;
}

// A video's own look.json wins over the app's.
function readLook(project, guide) {
  const f = lookFiles(project, guide);
  const video = readJson(f.video);
  return { look: cleanLook(video || readJson(f.app)), scope: video ? 'video' : 'app' };
}

function cleanPins(pins) {
  return (Array.isArray(pins) ? pins : [])
    .filter((p) => p && /^L\d+$/.test(p.line) && PIN_KINDS.includes(p.kind))
    .map((p) => ({ line: p.line, kind: p.kind, target: Number.isInteger(p.target) && p.target >= 0 ? p.target : 0, text: String(p.text || '').slice(0, 60) }));
}
const readPins = (project, guide) => cleanPins(readJson(path.join(project, 'scripts', guide, 'pins.json')));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ARROW_DOWN = '<svg viewBox="0 0 30 40"><path d="M15 38 L3 24 H10 V2 H20 V24 H27 Z" fill="var(--g-color)" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
const POINTER = '<svg viewBox="0 0 20 26"><path d="M1 1 V22 L6.5 16.5 L10.5 25 L14 23.5 L10 15 H17.5 Z" fill="var(--g-color)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';

// ---- The frame: where the capture sits in the video ----

// The capture's box in the video, keeping its shape. Full bleed fills the video.
function frameBox(look, [W, H]) {
  const f = look.frame;
  if (f.style === 'full') return { x: 0, y: 0, w: W, h: H, bar: 0, radius: 0 };
  const pad = Math.round(W * PAD[f.padding]);
  const bar = f.style === 'browser' ? BAR : 0;
  const scale = Math.min((W - 2 * pad) / W, (H - 2 * pad - bar) / H);
  const w = Math.round(W * scale / 2) * 2, h = Math.round(H * scale / 2) * 2;
  return { x: Math.round((W - w) / 2), y: Math.round((H - h + bar) / 2), w, h, bar, radius: RADIUS[f.corners] };
}

// Everything behind and around the capture: background, shadow, browser bar. The capture area itself is left
// empty (transparent) for dress.cjs, or holds `inner` for the studio preview.
function frameHtml(look, size, address = '', inner = '') {
  const [W, H] = size;
  const b = frameBox(look, size);
  if (look.frame.style === 'full') return `<div class="g-capture" style="left:0;top:0;width:${W}px;height:${H}px">${inner}</div>`;
  const shadow = look.frame.shadow === 'on' ? ' g-shadow' : '';
  const bar = b.bar
    ? `<div class="g-bar" style="height:${b.bar}px"><i style="background:#FF5F57"></i><i style="background:#FEBC2E"></i><i style="background:#28C840"></i><span class="g-address">${esc(shortAddress(address))}</span></div>`
    : '';
  return `<div class="g-bg" style="background:${BACKGROUNDS[look.frame.background]}"></div>`
    + `<div class="g-window${shadow}" style="left:${b.x}px;top:${b.y - b.bar}px;width:${b.w}px;height:${b.h + b.bar}px;border-radius:${b.radius}px">${bar}`
    + `<div class="g-capture" style="left:0;top:${b.bar}px;width:${b.w}px;height:${b.h}px">${inner}</div></div>`;
}

// The capture's corners as a white shape on black, for ffmpeg to cut the capture with.
function maskHtml(look, size) {
  const b = frameBox(look, size);
  const r = b.radius;
  const radius = b.bar ? `0 0 ${r}px ${r}px` : `${r}px`;
  return `<div style="position:absolute;inset:0;background:#000"></div><div style="position:absolute;left:0;top:0;width:${b.w}px;height:${b.h}px;background:#fff;border-radius:${radius}"></div>`;
}

// Host plus the readable part of the path. Tokens and ids stop it with "…", so a private link never shows in a video.
function shortAddress(url) {
  try {
    const u = new URL(url);
    const kept = [];
    for (const part of u.pathname.split('/').filter(Boolean)) {
      if (!/^[a-z][a-z-]{0,23}$/i.test(part)) { kept.push('…'); break; }
      kept.push(part);
    }
    return u.host + (kept.length ? `/${kept.join('/')}` : '');
  } catch { return ''; }
}

// ---- Zoom on the click ----

// A line that clicks something small zooms in on it as the cursor arrives, and out just after the click,
// because the click usually changes the page and the zoomed spot then shows the wrong thing. Big targets
// (a text box, a card) are readable already, so they don't zoom.
function zoomWindows(look, lines, targets, [W, H] = [1440, 900]) {
  if (look.frame.zoom !== 'on') return [];
  return lines.map((l, i) => {
    const t = targets.find((x) => x.line === l.id);
    if (!t || t.box.w > W * 0.3 || t.box.h > H * 0.2) return null;
    const end = i + 1 < lines.length ? lines[i + 1].t : l.t + l.len;
    const at = typeof t.t === 'number' ? t.t : l.t;
    const a = Math.max(l.t, at - ZOOM.before), b = Math.min(end, at + ZOOM.after);
    return b - a > ZOOM.ramp ? { a, b, cx: t.box.x + t.box.w / 2, cy: t.box.y + t.box.h / 2 } : null;
  }).filter(Boolean);
}

const ease = (e) => e * e * (3 - 2 * e);
// How far zoomed in, and the top-left of the zoomed view in capture pixels, at time t.
function zoomAt(windows, t, [W, H]) {
  const w = windows.find((x) => t >= x.a && t <= x.b);
  if (!w) return { z: 1, x: 0, y: 0 };
  const e = ease(Math.min(1, Math.max(0, (t - w.a) / ZOOM.ramp), Math.max(0, (w.b - t) / ZOOM.ramp)));
  const z = 1 + (ZOOM.scale - 1) * e;
  const clamp = (v, max) => Math.min(Math.max(v, 0), max);
  return { z, x: clamp(w.cx - W / z / 2, W - W / z), y: clamp(w.cy - H / z / 2, H - H / z) };
}

// The same zoom as ffmpeg zoompan expressions (`it` is the input time).
function zoomExpr(windows, [W, H]) {
  if (!windows.length) return null;
  const e = windows.map((w) => `(st(0,min(clip((it-${w.a.toFixed(3)})/${ZOOM.ramp},0,1),clip((${w.b.toFixed(3)}-it)/${ZOOM.ramp},0,1)));ld(0)*ld(0)*(3-2*ld(0)))`).join('+');
  const focus = (k, mid) => `${mid}` + windows.map((w) => `+between(it,${w.a.toFixed(3)},${w.b.toFixed(3)})*(${Math.round(w[k]) - mid})`).join('');
  return {
    z: `1+${ZOOM.scale - 1}*(${e})`,
    x: `clip((${focus('cx', W / 2)})-iw/zoom/2,0,iw-iw/zoom)`,
    y: `clip((${focus('cy', H / 2)})-ih/zoom/2,0,ih-ih/zoom)`,
  };
}

// ---- What sits on the capture, and the caption ----

// Marks pinned to what a line clicked. targets are the elements the line clicked, in order, in capture pixels.
function pinsHtml(pins = [], targets = []) {
  let html = '';
  for (const p of pins) {
    const t = targets[p.target];
    if (!t) continue;
    const { x, y, w, h } = t.box;
    const cx = x + w / 2;
    if (p.kind === 'ring') html += `<div class="g-ring" style="left:${x - 6}px;top:${y - 6}px;width:${w + 12}px;height:${h + 12}px"></div>`;
    if (p.kind === 'arrow') html += `<div class="g-arrow" style="left:${cx}px;top:${y - 8}px">${ARROW_DOWN}</div>`;
    // shortcut: marks always sit above the element, so one at the very top of the page is cut off; flip them if that shows up.
    if (p.kind === 'label') {
      const lift = pins.some((q) => q.kind === 'arrow' && q.target === p.target) ? 52 : 14;
      html += `<div class="g-label" style="left:${cx}px;top:${y - lift}px">${esc(p.text || t.name)}</div>`;
    }
  }
  return html;
}

// The caption sits on the whole video, outside any frame or zoom. The bar style also shows the step, "3 / 10",
// and lines up with the edges of the framed capture.
function captionHtml(look, caption, step, size) {
  const c = look.caption;
  if (!caption) return '';
  const bar = c.box === 'bar';
  const chip = bar && step ? `<span class="g-step">${step.n} / ${step.of}</span>` : '';
  const inset = bar && size ? Math.max(24, frameBox(look, size).x + 16) : 0;
  const style = inset ? ` style="left:${inset}px;right:${inset}px"` : '';
  return `<div class="g-cap font-${c.font} size-${c.size} box-${c.box} place-${c.place}"${style}>${chip}<span>${esc(caption)}</span></div>`;
}

// Kept for callers that draw everything on the capture at once: caption plus marks.
const layerHtml = (look, caption, pins = [], targets = []) => captionHtml(look, caption) + pinsHtml(pins, targets);

// The cursor in a 48px box whose centre is the click point.
const cursorHtml = (look) => `<div class="g-cursor shape-${look.cursor.shape}">${look.cursor.shape === 'arrow' ? POINTER : ''}</div>`;
const rippleHtml = () => '<div class="g-ripple"></div>';

// One still for How-to Studio: the frame, the capture (an image) zoomed as it is at time t, its marks and cursor,
// and the caption. size is the take's size; the result is that size too, for the page to scale.
function previewHtml({ look, size, address, src, caption, step, pins, targets, cursor, zoom }) {
  const [W, H] = size;
  const b = frameBox(look, size);
  const z = zoom || { z: 1, x: 0, y: 0 };
  const onCapture = `<img src="${esc(src)}" alt="" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px">${pinsHtml(pins, targets)}`
    + (cursor ? `<div class="g-cursor-box" style="left:${cursor.x - 24}px;top:${cursor.y - 24}px">${cursorHtml(look)}</div>` : '');
  const inner = `<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;transform:scale(${b.w / W}) scale(${z.z}) translate(${-z.x}px,${-z.y}px)">${onCapture}</div>`;
  return frameHtml(look, size, address, inner) + captionHtml(look, caption, step, size);
}

const css = () => fs.readFileSync(path.join(__dirname, 'overlay.css'), 'utf8');

module.exports = {
  DEFAULT_LOOK, CHOICES, BACKGROUNDS, PIN_KINDS, cleanLook, readLook, lookFiles, cleanPins, readPins,
  frameBox, frameHtml, shortAddress, maskHtml, zoomWindows, zoomAt, zoomExpr, pinsHtml, captionHtml, layerHtml, cursorHtml, rippleHtml, previewHtml, css,
};
