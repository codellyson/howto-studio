// GUIDE_PROFILE=<dir> node record.cjs <project> <guide> [--from Lnn]
// --from films from that line on: earlier lines run off camera, without their voice holds, so the app reaches the
// same state, and cut.py --from splices the new part onto the video already made.
// Runs guides[<guide>] from <project>/takes.cjs. See references/takes-template.cjs for the helpers it receives.
// Each script line holds for its audio length, so the screen follows the voice. Captions and cursor are added by dress.cjs.
// Writes out/raw/<guide>.webm and out/raw/<guide>.timing.json for cut.py.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { playwright, profileDir, prepare } = require('./lib.cjs');

const project = path.resolve(process.argv[2]);
const guide = process.argv[3];
const fromArg = process.argv.indexOf('--from');
const from = fromArg > 0 ? process.argv[fromArg + 1] : null;
const profile = profileDir();
// takes.cjs holds what the whole app needs (blocked hosts, faked data as `hooks`); a video's steps can live in
// scripts/<guide>/take.json instead of a function in takes.cjs.
const config = fs.existsSync(path.join(project, 'takes.cjs')) ? require(path.join(project, 'takes.cjs')) : {};
const steps = require('./steps.cjs');
// A smaller page filmed at high DPI: the app's text comes out larger and sharp. The video is S times the page.
const W = config.width || 1280, H = config.height || 800, S = config.scale || 1.5;
const GAP = 350;
const out = path.join(project, 'out');
const raw = path.join(out, 'raw');
fs.mkdirSync(raw, { recursive: true });

const lines = Object.fromEntries(
  execFileSync('python3', ['-I', path.join(__dirname, 'lines.py'), path.join(project, 'scripts', guide, 'script.md')], { encoding: 'utf8' })
    .trim().split('\n').map((l) => l.split('\t'))
);
const durations = JSON.parse(fs.readFileSync(path.join(project, 'audio', guide, 'durations.json'), 'utf8'));

// Captions, cursor and pinned marks are drawn later by dress.cjs, so the take films the page clean.
// The page reports where the mouse goes, so dress.cjs can draw the cursor in any style.
const decorate = (css) => {
  const add = () => {
    if (!document.head || document.getElementById('__guide_style')) return;
    const s = document.createElement('style');
    s.id = '__guide_style';
    s.textContent = `nextjs-portal{display:none!important}\n${css}`;
    document.head.appendChild(s);
    const tell = (k, e) => window.__guideMouse && window.__guideMouse(k, e ? e.clientX : 0, e ? e.clientY : 0);
    addEventListener('mousemove', (e) => tell('move', e), true);
    addEventListener('mousedown', (e) => tell('down', e), true);
    addEventListener('mouseup', (e) => tell('up', e), true);
    if (window === top) addEventListener('mouseout', (e) => { if (!e.relatedTarget) tell('hide'); }, true);
  };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', add) : add();
};

// A take.json as a guide function: open off camera, then each line's steps on camera. A target repaired during
// the take is saved, and the take stops at that line, so the next take (--from that line) films it without the
// pause the repair caused.
function fromTake(take) {
  return async (t) => {
    const state = {};
    const site = process.env.GUIDE_SITE || config.site;
    const hooks = config.hooks || {};
    let repaired = false;
    const io = { page: t.page, click: t.click, hover: t.hover, sleep: t.sleep, asset: t.asset, site, hooks, state, t,
      onRepair: (old, fixed) => { steps.saveRepair(project, guide, old, fixed); repaired = true; console.error('REPAIRED', JSON.stringify(old), '->', JSON.stringify(fixed)); } };
    const all = async (list, context) => { for (const step of list || []) await steps.run(step, { ...io, context }); };
    if (hooks.setup) await hooks.setup(t, state, guide);
    await t.offCamera(async () => {
      for (const u of take.warm || []) await steps.run({ goto: u }, io);
      await steps.run({ goto: take.start || '/' }, io);
      await t.waitForImages();
      await t.sleep(800);
    });
    for (const id of Object.keys(lines)) {
      if (take.before && take.before[id]) await t.offCamera(() => all(take.before[id], lines[id]));
      await t.say(id, async () => {
        await all(take.lines[id], lines[id]);
        if (repaired) throw new Error(`a target in ${id} was repaired and saved; film again from ${id}`);
      });
    }
  };
}

(async () => {
  const ctx = await playwright(project).chromium.launchPersistentContext(profile, {
    headless: true, // a visible window is cut to the screen height, which clips the bottom of the video
    viewport: { width: W, height: H },
    // The recorder films at the window's real pixels, which only this flag doubles; deviceScaleFactor alone pads.
    deviceScaleFactor: 2,
    args: ['--force-device-scale-factor=2'],
    recordVideo: { dir: raw, size: { width: Math.round(W * S / 2) * 2, height: Math.round(H * S / 2) * 2 } },
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const session = path.join(profile, 'session.json');
  if (fs.existsSync(session)) await ctx.addCookies(JSON.parse(fs.readFileSync(session, 'utf8')));

  const events = [], writes = new Set(), blocked = new Set(), cursor = [], targets = [];
  let current = null;
  // Mouse positions inside a frame are moved by the frame's place on the page.
  await ctx.exposeBinding('__guideMouse', async (source, k, x, y) => {
    const wall = Date.now();
    let dx = 0, dy = 0;
    if (source.frame && source.frame.parentFrame()) {
      const b = await (await source.frame.frameElement()).boundingBox().catch(() => null);
      if (b) { dx = b.x; dy = b.y; }
    }
    cursor.push({ wall, k, x: Math.round(x + dx), y: Math.round(y + dy) });
  });
  await prepare(ctx, config, out, blocked);
  await ctx.addInitScript(decorate, config.css || '');
  if (config.initScript) await ctx.addInitScript(config.initScript);

  const p = ctx.pages()[0] || (await ctx.newPage());
  p.on('request', (r) => {
    if (r.method() === 'GET' || !r.url().startsWith('http')) return;
    const u = new URL(r.url());
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') writes.add(`${r.method()} ${u.host}${u.pathname}`);
  });
  // Confirm dialogs get "yes" on camera, after a beat so the viewer can see them.
  p.on('dialog', (d) => setTimeout(() => d.accept().catch(() => {}), 1200));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // The video drifts against the clock, so each event shows in the video itself: an 8px corner block changes colour.
  const PALETTE = ['#f0f', '#0f0', '#00f', '#ff0'];
  const mark = async (kind, id) => {
    await p.evaluate((color) => {
      let m = document.getElementById('__guide_mark');
      if (!m) {
        m = document.createElement('div');
        m.id = '__guide_mark';
        m.style.cssText = 'position:fixed;left:0;top:0;width:8px;height:8px;z-index:2147483647;pointer-events:none';
        document.body.appendChild(m);
      }
      m.style.background = color;
    }, PALETTE[events.length % PALETTE.length]);
    events.push({ kind, id, wall: Date.now(), url: p.url() });
    await sleep(120);
  };

  let forwarding = !!from;
  const say = async (id, act) => {
    if (!lines[id] || !durations[id]) throw new Error(`no script line or audio for ${id}`);
    if (forwarding && id !== from) {
      current = null;
      if (act) await act();
      return;
    }
    forwarding = false;
    current = id;
    await mark('say', id);
    const voice = sleep(durations[id] * 1000 + GAP);
    if (act) await act();
    await voice;
  };

  const offCamera = async (work) => {
    await mark('cut-start');
    await work();
    cursor.push({ wall: Date.now(), k: 'hide', x: 0, y: 0 });
    await p.mouse.move(W / 2, H * 0.72);
    await sleep(300);
    await mark('cut-end');
  };

  const click = async (loc, { pause = 400 } = {}) => {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    if (!b) throw new Error('nothing to click');
    const name = await loc.evaluate((el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.getAttribute('alt') || el.getAttribute('placeholder') || el.tagName.toLowerCase()).trim().replace(/\s+/g, ' ').slice(0, 40)).catch(() => 'element');
    targets.push({ line: current, wall: Date.now(), name, box: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } });
    const x = b.x + b.width / 2, y = b.y + Math.min(b.height / 2, 40);
    await p.mouse.move(x, y, { steps: 30 });
    await sleep(pause);
    await p.mouse.down();
    await sleep(90);
    await p.mouse.up();
  };

  // Points at an element without clicking, the same way a click gets there.
  const hover = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    if (!b) throw new Error('nothing to point at');
    await p.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 40), { steps: 30 });
  };

  const t = {
    page: p,
    ctx,
    sleep,
    say,
    offCamera,
    click,
    hover,
    asset: (name) => path.join(project, 'assets', name),
    button: (name) => p.getByRole('button', { name, exact: true }),
    pickFile: async (loc, files) => {
      const [chooser] = await Promise.all([p.waitForEvent('filechooser'), click(loc)]);
      await chooser.setFiles(files);
    },
    // recordVideo films one tab. The new tab closes and its address comes back, for t.visit off camera.
    clickLinkToNewTab: async (loc) => {
      const [opened] = await Promise.all([ctx.waitForEvent('page'), click(loc)]);
      await opened.waitForURL((u) => u.href !== 'about:blank', { timeout: 30000, waitUntil: 'commit' }); // only the address; loading would stall the shot
      const url = opened.url();
      await opened.close();
      return url;
    },
    // Waiting for "load" lets one stalled picture fail a take. ready() runs in the page; a false answer reloads.
    visit: async (url, ready, frame = p) => {
      for (let i = 0; ; i++) {
        await frame.goto(url, { timeout: 120000, waitUntil: 'domcontentloaded' });
        await sleep(2000);
        if (!ready || (await frame.evaluate(ready).catch(() => false))) return;
        if (i === 7) throw new Error(`page never became ready: ${url}`);
        await sleep(5000);
      }
    },
    waitForImages: (frame = p) => frame.waitForFunction(() => [...document.images]
      .filter((i) => { const r = i.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && i.loading !== 'lazy'; })
      .every((i) => i.complete), null, { timeout: 30000 }).catch(() => {}),
    waitForFonts: async (fonts, frame = p) => {
      const missing = await frame.evaluate(async (wanted) => {
        await Promise.race([Promise.all(wanted.map((f) => document.fonts.load(f).catch(() => {}))), new Promise((r) => setTimeout(r, 60000))]);
        return wanted.filter((f) => !document.fonts.check(f));
      }, fonts);
      if (missing.length) throw new Error(`fonts did not load: ${missing}`);
    },
    afterTake: (fn) => { t.cleanup = fn; },
  };

  const take = steps.readTake(project, guide);
  const guideFn = take ? fromTake(take) : (config.guides || {})[guide];
  if (!guideFn) throw new Error(`no take for ${guide}: write scripts/${guide}/take.json (drive.cjs builds it) or a function in takes.cjs`);
  if (from && !lines[from]) throw new Error(`--from ${from}: no such line`);
  let failed = null;
  const video = p.video();
  try {
    await guideFn(t);
    await sleep(1000);
    const ids = Object.keys(lines);
    const missing = ids.slice(from ? ids.indexOf(from) : 0).filter((id) => !events.some((e) => e.id === id));
    if (missing.length) throw new Error(`lines never said: ${missing}`);
    current = null;
    await sleep(400);
    await mark('end');
    await sleep(400);
  } catch (e) {
    await p.screenshot({ path: path.join(out, `${guide}-error.png`) }).catch(() => {});
    console.error('FAILED', e.message);
    // The lines before this one are good: cut.py keeps them, and the next take starts here.
    failed = current || from || Object.keys(lines)[0];
    console.error(`RESUME with: python3 cut.py <project> ${guide}, then node record.cjs <project> ${guide} --from ${failed}`);
    process.exitCode = 1;
  }
  // Past the end mark, so cut.py drops it. It runs after a failed take too, so test records never stay behind.
  if (t.cleanup) await t.cleanup().catch((e) => { console.error('CLEANUP FAILED', e.message); process.exitCode = 1; });
  await ctx.close();
  fs.renameSync(await video.path(), path.join(raw, `${guide}.webm`));
  fs.writeFileSync(path.join(raw, `${guide}.timing.json`), JSON.stringify({ size: [W, H], scale: S, from, failed, events, cursor, targets, writes: [...writes], blocked: [...blocked] }, null, 1));
  console.log('VIDEO', path.join(raw, `${guide}.webm`), 'events', events.length);
  console.log('WRITES', [...writes].join('\n  '));
  console.log('BLOCKED', [...blocked].join('\n  '));
})().catch((e) => { console.error(e.message); process.exit(1); });
