// node probe.cjs <project> <url> [screenshot.png]
// Read-only look at a page: its accessibility tree (exact button and label names), frames, and the hosts it talks to.
const fs = require('fs');
const path = require('path');
const { playwright, profileDir } = require('./lib.cjs');
const [project, url, shot] = process.argv.slice(2);
(async () => {
  const profile = profileDir();
  const ctx = await playwright(project).chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const session = path.join(profile, 'session.json');
  if (fs.existsSync(session)) await ctx.addCookies(JSON.parse(fs.readFileSync(session, 'utf8')));
  await ctx.route('**/*', (r) => (r.request().method() === 'GET' || !r.request().url().startsWith('http') ? r.continue() : r.abort()));
  const p = ctx.pages()[0] || (await ctx.newPage());
  const hosts = new Set();
  p.on('request', (r) => { if (r.url().startsWith('http')) hosts.add(`${r.method()} ${new URL(r.url()).host}`); });
  await p.goto(url, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(8000);
  console.log('URL', p.url());
  for (const f of p.frames()) if (f !== p.mainFrame()) console.log('FRAME', f.url());
  console.log([...hosts].sort().join('\n'));
  console.log(await p.locator('body').ariaSnapshot());
  if (shot) await p.screenshot({ path: shot });
  await ctx.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
