const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

function playwright(project) {
  const req = createRequire(path.join(path.resolve(project), 'package.json'));
  for (const name of ['playwright', '@playwright/test']) {
    try { return req(name); } catch {}
  }
  throw new Error(`No Playwright in ${project}. Run: pnpm add -D playwright && pnpm exec playwright install chromium`);
}

function profileDir() {
  const dir = process.env.GUIDE_PROFILE;
  if (!dir) throw new Error('Set GUIDE_PROFILE to a directory outside the project, e.g. export GUIDE_PROFILE=$(mktemp -d)');
  return dir;
}

// What every browser that films or rehearses a take needs: writes to protected hosts aborted (and listed in
// `blocked`), and web fonts kept after their first fetch so a slow font never films as the fallback.
// Analytics and error reports: still aborted, but they change nothing the viewer sees, so they never fail a take.
const TELEMETRY = [/\/events\/batch\b/, /\/(analytics|telemetry|collect|track|beacon|rum|vitals|metrics|log)(\/|\?|$)/i, /sentry|google-analytics|googletagmanager|posthog|segment\.io|mixpanel|amplitude|hotjar|clarity\.ms|cdn-cgi/i];

async function prepare(ctx, config, out, blocked = new Set()) {
  for (const pattern of config.blockWrites || []) {
    await ctx.route(pattern, (r) => {
      const req = r.request();
      if (req.method() === 'GET') return r.continue();
      if (![...TELEMETRY, ...(config.ignoreBlocked || [])].some((x) => x.test(req.url()))) blocked.add(`${req.method()} ${req.url()}`);
      return r.abort();
    });
  }
  // A font that fails to load films as the fallback font, so font files are kept after the first fetch.
  await ctx.route(/^https:\/\/fonts\.(gstatic|googleapis)\.com\//, async (route) => {
    const dir = path.join(out, 'fonts');
    fs.mkdirSync(dir, { recursive: true });
    const key = path.join(dir, crypto.createHash('sha1').update(route.request().url()).digest('hex'));
    for (let i = 0; i < 4 && !fs.existsSync(key); i++) {
      const res = await route.fetch({ timeout: 45000 }).catch(() => null);
      if (res && res.ok()) {
        fs.writeFileSync(`${key}.type`, res.headers()['content-type'] || '');
        fs.writeFileSync(key, await res.body());
      }
    }
    if (!fs.existsSync(key)) return route.abort();
    return route.fulfill({
      body: fs.readFileSync(key),
      contentType: fs.readFileSync(`${key}.type`, 'utf8'),
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  return blocked;
}

module.exports = { playwright, profileDir, prepare, TELEMETRY };
