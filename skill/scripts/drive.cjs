// GUIDE_PROFILE=<dir> node drive.cjs <project> <guide> <command> [...]
// Builds scripts/<guide>/take.json by doing the take one step at a time in a real browser, with the same faked
// data and blocked writes as filming. A step that works is kept; one that fails is not, and the page is printed
// either way so the next step can be chosen from what is really there.
//
//   start                 open a browser, run the take saved so far, print the page
//   open /path            set where the take starts, go there, print the page
//   do L03 '<step>'       try a step during line L03 (see steps.cjs for steps and targets); kept if it works
//   before L13 '<step>'   an off-camera step just before L13 (another page, another person)
//   look                  print the page again
//   undo L03              drop L03's last step from take.json (then `start` again to replay without it)
//   check                 run the whole take quickly in a fresh browser and report the first step that fails
//   stop                  close the browser
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { playwright, profileDir, prepare } = require('./lib.cjs');
const steps = require('./steps.cjs');

const project = path.resolve(process.argv[2]);
const guide = process.argv[3];
const [cmd, ...args] = process.argv.slice(4);
const out = path.join(project, 'out');
const sock = path.join(os.tmpdir(), `howto-drive-${require('crypto').createHash('sha1').update(`${project}/${guide}`).digest('hex').slice(0, 12)}.sock`);
const config = fs.existsSync(path.join(project, 'takes.cjs')) ? require(path.join(project, 'takes.cjs')) : {};
const W = config.width || 1280, H = config.height || 800;
const lineIds = () => execFileSync('python3', ['-I', path.join(__dirname, 'lines.py'), path.join(project, 'scripts', guide, 'script.md')], { encoding: 'utf8' })
  .trim().split('\n').map((l) => l.split('\t'));

// Quick versions of the human moves: the point here is finding what works, not how it looks.
async function openBrowser() {
  // A copy of the signed-in profile, so the driver never locks the one filming uses.
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'howto-drive-profile-'));
  const profile = profileDir();
  if (fs.existsSync(profile)) fs.cpSync(profile, copy, { recursive: true, filter: (f) => !/Singleton/.test(f) });
  const ctx = await playwright(project).chromium.launchPersistentContext(copy, { headless: true, viewport: { width: W, height: H } });
  const session = path.join(profile, 'session.json');
  if (fs.existsSync(session)) await ctx.addCookies(JSON.parse(fs.readFileSync(session, 'utf8')));
  const blocked = await prepare(ctx, config, out);
  if (config.css) await ctx.addInitScript((css) => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }), config.css);
  if (config.initScript) await ctx.addInitScript(config.initScript);
  const page = ctx.pages()[0] || (await ctx.newPage());
  page.on('dialog', (d) => d.accept().catch(() => {}));
  // Requests to the app that failed or weren't answered: usually a fake the take still needs.
  const failed = new Set();
  const site = process.env.GUIDE_SITE || config.site || '';
  const ours = (u) => { try { return new URL(u).host === new URL(site).host; } catch { return false; } };
  page.on('response', (r) => { if (r.status() >= 400 && ours(r.url())) failed.add(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  page.on('requestfailed', (r) => { if (ours(r.url()) && !/\.(js|css|woff2?|png|svg|ico)(\?|$)/.test(r.url())) failed.add(`failed ${r.method()} ${new URL(r.url()).pathname}`); });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const point = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    if (!b) throw new Error('nothing to point at');
    return [b.x + b.width / 2, b.y + Math.min(b.height / 2, 40)];
  };
  const t = {
    page, ctx, sleep, asset: (n) => path.join(project, 'assets', n), afterTake: () => {}, offCamera: (fn) => fn(),
    // The same mouse moves filming makes, only quicker, so what works here works on camera.
    click: async (loc) => { const [x, y] = await point(loc); await page.mouse.click(x, y); },
    hover: async (loc) => { const [x, y] = await point(loc); await page.mouse.move(x, y, { steps: 3 }); },
    visit: (url) => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }), waitForImages: async () => {},
  };
  const state = {};
  const hooks = config.hooks || {};
  if (hooks.setup) await hooks.setup(t, state, guide);
  const io = { page, click: t.click, hover: t.hover, sleep: (ms) => sleep(Math.min(ms, 300)), asset: t.asset,
    site: process.env.GUIDE_SITE || config.site, hooks, state, t };
  return { ctx, page, io, blocked, failed, copy };
}

// Everything saved so far, in take order. Stops at the first failure and says where.
async function replay(b, take) {
  const texts = Object.fromEntries(lineIds());
  const run = async (where, step, context) => {
    try { await steps.run(step, { ...b.io, context }); } catch (e) { throw new Error(`${where}: ${JSON.stringify(step)}: ${e.message}`); }
  };
  for (const u of take.warm || []) await run('warm', { goto: u });
  await run('start', { goto: take.start || '/' });
  for (const [id] of lineIds()) {
    for (const s of (take.before || {})[id] || []) await run(`before ${id}`, s, texts[id]);
    for (const s of (take.lines || {})[id] || []) await run(id, s, texts[id]);
  }
}

const emptyTake = () => ({ start: '/', warm: [], lines: {}, before: {} });
const take = () => steps.readTake(project, guide) || emptyTake();
const writes = (b) => {
  const out = `${b.blocked.size ? `\nBLOCKED WRITES: ${[...b.blocked].join(', ')}` : ''}${b.failed.size ? `\nREQUESTS NOT ANSWERED (missing fakes?): ${[...b.failed].join(', ')}` : ''}`;
  b.failed.clear();
  return out;
};

async function serve() {
  const b = await openBrowser();
  let ready = 'ok';
  try { await replay(b, take()); } catch (e) { ready = `the saved take stops at ${e.message}`; }
  const answer = async (res, ok, text) => res.end(JSON.stringify({ ok, text: `${text}${writes(b)}\n\nPAGE (${b.page.url()}):\n${await steps.snapshot(b.page)}` }));
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const q = JSON.parse(body || '{}');
    try {
      if (q.cmd === 'hello') return answer(res, ready === 'ok', ready === 'ok' ? 'Browser open; the saved take ran.' : ready);
      if (q.cmd === 'look') return answer(res, true, 'The page now.');
      if (q.cmd === 'open') {
        await steps.run({ goto: q.path }, b.io);
        const tk = take();
        tk.start = q.path;
        steps.writeTake(project, guide, tk);
        return answer(res, true, `The take starts at ${q.path}.`);
      }
      if (q.cmd === 'do' || q.cmd === 'before') {
        const context = Object.fromEntries(lineIds())[q.line];
        if (!context) throw new Error(`no line ${q.line} in the script`);
        let fixed = null;
        await steps.run(q.step, { ...b.io, context, onRepair: (_, f) => { fixed = f; } });
        // A repaired target is saved as repaired, so the take doesn't need repairing again.
        const k = ['click', 'hover', 'type', 'wait', 'scroll', 'paste', 'pick'].find((x) => q.step[x]);
        const step = fixed && k ? { ...q.step, [k]: fixed } : q.step;
        const tk = take();
        const key = q.cmd === 'do' ? 'lines' : 'before';
        tk[key] = tk[key] || {};
        (tk[key][q.line] = tk[key][q.line] || []).push(step);
        steps.writeTake(project, guide, tk);
        return answer(res, true, `Kept in ${q.line}${q.cmd === 'before' ? ' (before, off camera)' : ''}: ${JSON.stringify(step)}`);
      }
      if (q.cmd === 'stop') {
        res.end(JSON.stringify({ ok: true, text: 'Closed.' }));
        await b.ctx.close().catch(() => {});
        fs.rmSync(b.copy, { recursive: true, force: true });
        server.close();
        process.exit(0);
      }
      throw new Error(`unknown command ${q.cmd}`);
    } catch (e) {
      return answer(res, false, `Not kept: ${e.message.split('\n')[0]}`);
    }
  });
  fs.rmSync(sock, { force: true });
  server.listen(sock);
}

const call = (q) => new Promise((resolve, reject) => {
  const req = http.request({ socketPath: sock, method: 'POST', path: '/' }, async (res) => {
    let body = '';
    for await (const c of res) body += c;
    resolve(JSON.parse(body));
  });
  req.on('error', reject);
  req.end(JSON.stringify(q));
});
const print = (r) => { console.log(r.text); process.exitCode = r.ok ? 0 : 1; };

(async () => {
  if (cmd === 'serve') return serve();
  if (cmd === 'start') {
    await call({ cmd: 'stop' }).catch(() => {});
    const log = fs.openSync(path.join(out, `drive-${guide}.log`), 'w');
    spawn(process.execPath, [__filename, project, guide, 'serve'], { detached: true, stdio: ['ignore', log, log], env: process.env }).unref();
    for (let i = 0; i < 240; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const r = await call({ cmd: 'hello' }).catch(() => null);
      if (r) return print(r);
    }
    throw new Error(`the browser did not open; see out/drive-${guide}.log`);
  }
  if (cmd === 'check') {
    // A check only needs to know whether the take runs: short waits, and no model repairs.
    process.env.GUIDE_WAIT = process.env.GUIDE_WAIT || '4000';
    process.env.GUIDE_NO_MODEL_REPAIR = '1';
    const b = await openBrowser();
    try {
      await replay(b, take());
      console.log(`The whole take runs.${writes(b)}`);
    } catch (e) {
      console.log(`Fails at ${e.message}${writes(b)}\n\nPAGE (${b.page.url()}):\n${await steps.snapshot(b.page)}`);
      process.exitCode = 1;
    }
    await b.ctx.close();
    fs.rmSync(b.copy, { recursive: true, force: true });
    return;
  }
  if (cmd === 'undo') {
    const tk = take();
    const list = (tk.lines || {})[args[0]] || [];
    const gone = list.pop();
    steps.writeTake(project, guide, tk);
    return console.log(gone ? `Dropped from ${args[0]}: ${JSON.stringify(gone)}. Run start to replay without it.` : `${args[0]} has no steps.`);
  }
  if (cmd === 'look' || cmd === 'stop') return print(await call({ cmd }));
  if (cmd === 'open') return print(await call({ cmd, path: args[0] }));
  if (cmd === 'do' || cmd === 'before') return print(await call({ cmd, line: args[0], step: JSON.parse(args[1]) }));
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
})().catch((e) => { console.error(e.message); process.exit(1); });
