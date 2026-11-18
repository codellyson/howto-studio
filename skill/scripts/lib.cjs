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

module.exports = { playwright, profileDir };
