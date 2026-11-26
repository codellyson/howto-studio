// node probe.cjs <project> <url> [screenshot.png]
// Read-only look at a page: its accessibility tree (exact button and label names), frames, and the hosts it talks to.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { playwright, profileDir } = require('./lib.cjs');
const [project, url, shot] = process.argv.slice(2);
(async () => {
  const profile = profileDir();
  // A copy of the signed-in profile, so a probe never locks the one filming uses.
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'howto-probe-'));
  if (fs.existsSync(profile)) fs.cpSync(profile, copy, { recursive: true, filter: (f) => !/Singleton/.test(f) });
  const ctx = await playwright(project).chromium.launchPersistentContext(copy, { headless: true, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const session = path.join(profile, 'session.json');
  if (fs.existsSync(session)) await ctx.addCookies(JSON.parse(fs.readFileSync(session, 'utf8')));
  await ctx.route('**/*', (r) => (r.request().method() === 'GET' || !r.request().url().startsWith('http') ? r.continue() : r.abort()));
  const p = ctx.pages()[0] || (await ctx.newPage());
  const hosts = new Set();
  p.on('request', (r) => { if (r.url().startsWith('http')) hosts.add(`${r.method()} ${new URL(r.url()).host}`); });
  await p.goto(url, { timeout: 180000, waitUntil: 'domcontentloaded' });
  // Settled, not a fixed wait: most pages are ready in a second or two.
  await p.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(500);
  console.log('URL', p.url());
  for (const f of p.frames()) if (f !== p.mainFrame()) console.log('FRAME', f.url());
  console.log([...hosts].sort().join('\n'));
  console.log(await p.locator('body').ariaSnapshot());
  if (shot) await p.screenshot({ path: shot });
  await ctx.close();
  fs.rmSync(copy, { recursive: true, force: true });
})().catch((e) => { console.error(e.message); process.exit(1); });
