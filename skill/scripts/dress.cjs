// node dress.cjs <project> <guide>
// Turns the clean cut (out/<guide>.silent.mp4) into the styled video, using look.json and scripts/<guide>/pins.json:
// pinned marks, the cursor and click ripples on the capture; then zoom on the click; then the frame (background,
// corners, shadow, browser bar); then captions on top. Writes out/<guide>.dressed.mp4. cut.py runs it, and so does
// `cut.py --redress`, so a new look needs no new filming.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { playwright } = require('./lib.cjs');
const O = require('./overlay.cjs');

const project = path.resolve(process.argv[2]);
const guide = process.argv[3];
const out = path.join(project, 'out');
const work = path.join(out, 'dress', guide);
const silent = path.join(out, `${guide}.silent.mp4`);
const plan = JSON.parse(fs.readFileSync(path.join(out, `${guide}.overlay.json`), 'utf8'));
const size = plan.size;
const [W, H] = size;
const FPS = 25;

const captions = Object.fromEntries(
  execFileSync('python3', ['-I', path.join(__dirname, 'lines.py'), path.join(project, 'scripts', guide, 'script.md')], { encoding: 'utf8' })
    .trim().split('\n').map((l) => l.split('\t'))
);
const { look } = O.readLook(project, guide);
const pins = O.readPins(project, guide);
const box = O.frameBox(look, size);
const framed = look.frame.style !== 'full';

// Each caption stays up until the next line starts; the last one until just before the end.
const windows = plan.lines.map((l, i) => ({ id: l.id, a: l.t, b: i + 1 < plan.lines.length ? plan.lines[i + 1].t : Math.max(l.t + l.len, plan.duration - 0.3) }));

// Cursor and ripple positions as ffmpeg commands, at most one per frame.
function commands() {
  const rows = [];
  let shown = false;
  let last = -1;
  const hide = -200;
  for (const c of plan.cursor) {
    const t = c.t.toFixed(3);
    if (c.k === 'hide') {
      rows.push(`${t} overlay@cur x ${hide}, overlay@cur y ${hide};`);
      shown = false;
      continue;
    }
    if (c.k === 'move' && shown && c.t - last < 1 / 30) continue;
    rows.push(`${t} overlay@cur x ${c.x - 24}, overlay@cur y ${c.y - 24};`);
    shown = true;
    last = c.t;
    if (c.k === 'down' && look.cursor.click === 'ripple') {
      rows.push(`${t} overlay@rip x ${c.x - 32}, overlay@rip y ${c.y - 32};`);
      rows.push(`${(c.t + 0.35).toFixed(3)} overlay@rip x ${hide}, overlay@rip y ${hide};`);
    }
  }
  // sendcmd wants its times in order.
  return rows.map((r) => [parseFloat(r), r]).sort((x, y) => x[0] - y[0]).map((r) => r[1]).join('\n') + '\n';
}

(async () => {
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const browser = await playwright(project).chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const shot = async (html, file, w = W, h = H) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<style>html,body{margin:0;background:transparent}${O.css()}</style><div class="g-layer" style="width:${w}px;height:${h}px;--g-color:${look.cursor.color}">${html}</div>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, omitBackground: true });
    return file;
  };

  // Inputs after the clean cut, in order: marks per line, ripple, cursor, [background, mask], captions per line.
  const inputs = [];
  const marked = [];
  for (const w of windows) {
    const html = O.pinsHtml(pins.filter((p) => p.line === w.id), plan.targets.filter((t) => t.line === w.id));
    if (html) marked.push({ ...w, i: inputs.push(['img', await shot(html, path.join(work, `${w.id}-marks.png`))]) });
  }
  const rip = inputs.push(['img', await shot(`<div class="g-ripple-box" style="left:0;top:0">${O.rippleHtml()}</div>`, path.join(work, 'ripple.png'), 64, 64)]);
  const cur = inputs.push(['img', await shot(`<div class="g-cursor-box" style="left:0;top:0">${O.cursorHtml(look)}</div>`, path.join(work, 'cursor.png'), 48, 48)]);
  let bg, mask;
  if (framed) {
    bg = inputs.push(['loop', await shot(O.frameHtml(look, size, plan.address || ''), path.join(work, 'frame.png'))]);
    mask = inputs.push(['loop', await shot(O.maskHtml(look, size), path.join(work, 'mask.png'), box.w, box.h)]);
  }
  const caps = [];
  for (const w of windows) {
    const html = O.captionHtml(look, captions[w.id]);
    if (html) caps.push({ ...w, i: inputs.push(['img', await shot(html, path.join(work, `${w.id}-caption.png`))]) });
  }
  await browser.close();

  fs.writeFileSync(path.join(work, 'cmds.txt'), commands());
  const args = ['-loglevel', 'error', '-y', '-i', silent];
  for (const [kind, f] of inputs) args.push(...(kind === 'loop' ? ['-loop', '1', '-framerate', String(FPS), '-t', String(plan.duration), '-i', f] : ['-i', f]));

  const steps = [];
  let v = '0:v';
  let n = 0;
  const next = () => `v${++n}`;
  const add = (inputsLabel, filter) => { const o = next(); steps.push(`${inputsLabel}${filter}[${o}]`); v = o; };
  const between = (w) => `enable='between(t,${w.a.toFixed(3)},${w.b.toFixed(3)})'`;

  add(`[${v}]`, `sendcmd=f='${path.join(work, 'cmds.txt').replace(/'/g, "\\'")}'`);
  for (const m of marked) add(`[${v}][${m.i}:v]`, `overlay=0:0:${between(m)}`);
  add(`[${v}][${rip}:v]`, 'overlay@rip=x=-200:y=-200');
  add(`[${v}][${cur}:v]`, 'overlay@cur=x=-200:y=-200');
  const zoom = O.zoomExpr(O.zoomWindows(look, plan.lines, plan.targets), size);
  if (zoom) add(`[${v}]`, `zoompan=z='${zoom.z}':x='${zoom.x}':y='${zoom.y}':d=1:s=${W}x${H}:fps=${FPS}`);
  if (framed) {
    add(`[${v}]`, `scale=${box.w}:${box.h},format=rgba`);
    const capture = v;
    add(`[${mask}:v]`, 'format=gray');
    add(`[${capture}][${v}]`, 'alphamerge');
    add(`[${bg}:v][${v}]`, `overlay=${box.x}:${box.y}:shortest=1`);
  }
  for (const c of caps) add(`[${v}][${c.i}:v]`, `overlay=0:0:${between(c)}`);
  add(`[${v}]`, 'format=yuv420p');

  execFileSync('ffmpeg', [...args, '-filter_complex', steps.join(';'), '-map', `[${v}]`, '-an', '-c:v', 'libx264', '-crf', '20', '-r', String(FPS), path.join(out, `${guide}.dressed.mp4`)], { stdio: 'inherit' });
  console.log('DRESSED', path.join(out, `${guide}.dressed.mp4`), `${look.frame.style}${zoom ? ' + zoom' : ''}, ${windows.length} lines, ${pins.length} pinned marks`);
})().catch((e) => { console.error(e.message); process.exit(1); });
