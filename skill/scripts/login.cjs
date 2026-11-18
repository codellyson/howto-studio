// node login.cjs <project> <url> <signed-in-url-regex>
// Opens a window for the user to sign in. Session cookies end with the window, so they are saved for record.cjs.
const fs = require('fs');
const path = require('path');
const { playwright, profileDir } = require('./lib.cjs');
const [project, url, signedIn] = process.argv.slice(2);
(async () => {
  const profile = profileDir();
  const ctx = await playwright(project).chromium.launchPersistentContext(profile, { headless: false, viewport: { width: 1440, height: 900 } });
  const p = ctx.pages()[0] || (await ctx.newPage());
  await p.goto(url, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForURL(new RegExp(signedIn), { timeout: 600000 });
  fs.writeFileSync(path.join(profile, 'session.json'), JSON.stringify(await ctx.cookies()), { mode: 0o600 });
  console.log('SIGNED_IN');
  await ctx.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
