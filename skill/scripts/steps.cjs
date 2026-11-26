// A take as data: scripts/<guide>/take.json. record.cjs films it, drive.cjs builds it one step at a time.
//
// take.json:
//   { "start": "/hub",                       where the take opens (off camera), relative to the site
//     "warm": ["/hub/work", "/hub/new"],     pages loaded once off camera first, so nothing compiles on camera
//     "lines":  { "L01": [step, ...], ... }, what happens during each script line, on camera
//     "before": { "L13": [step, ...] } }     off-camera steps just before a line (switching person, a new page)
//
// A step is one of:
//   { "click": T, "pause"?: ms }      { "hover": T }          { "type": T, "text": "...", "delay"?: ms }
//   { "press": "Enter" }              { "paste": T, "file": "shot.png" }      { "pick": T, "files": ["a.png"] }
//   { "wait": T }                     { "sleep": ms }         { "goto": "/path", "ready"?: T }
//   { "scroll": T }                   { "hook": "name", "args": [...] }   (a function in takes.cjs `hooks`)
// A target T finds one visible element, the way a person reads the page:
//   { "role": "button", "name": "File it" } | { "text": "Website", "exact": true } | { "label": "Email" }
//   | { "placeholder": "Search" } | { "css": "main img" }, plus "in": T to look inside another element,
//   and "nth": 0 (first, the default) or -1 (last). A name or text written "/like this/i" is a pattern.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WAIT = 10000;
const pattern = (v) => {
  const m = typeof v === 'string' && v.match(/^\/(.+)\/([a-z]*)$/);
  return m ? new RegExp(m[1], m[2]) : v;
};

function locate(root, T) {
  const base = T.in ? locate(root, T.in) : root;
  const exact = T.exact ?? (typeof T.name === 'string' && !pattern(T.name).source);
  let loc;
  if (T.role) loc = base.getByRole(T.role, T.name !== undefined ? { name: pattern(T.name), exact } : {});
  else if (T.text !== undefined) loc = base.getByText(pattern(T.text), { exact: !!T.exact });
  else if (T.label !== undefined) loc = base.getByLabel(pattern(T.label), { exact: !!T.exact });
  else if (T.placeholder !== undefined) loc = base.getByPlaceholder(pattern(T.placeholder), { exact: !!T.exact });
  else if (T.css) loc = base.locator(T.css);
  else throw new Error(`a target needs role, text, label, placeholder or css: ${JSON.stringify(T)}`);
  // Hidden copies (a mobile menu, a measuring clone) are never what the viewer sees.
  loc = loc.filter({ visible: true });
  return T.nth === -1 ? loc.last() : loc.nth(T.nth || 0);
}

const describe = (T) => JSON.stringify(T);

// A short text picture of the page for a person or a model: roles, names and text, as Playwright reads them.
async function snapshot(page, max = 9000) {
  const s = await page.locator('body').ariaSnapshot({ timeout: 5000 }).catch((e) => `(no snapshot: ${e.message})`);
  return s.length > max ? `${s.slice(0, max)}\n… (cut)` : s;
}

// When a target is missing: first the visible text of its name, then one quick model call that picks the element
// from the page snapshot. Returns a target that resolves now, or null.
async function repair(page, T, context) {
  const tries = [];
  if (T.name && typeof T.name === 'string') tries.push({ text: T.name, ...(T.in ? { in: T.in } : {}) }, { text: T.name });
  for (const t of tries) if (await locate(page, t).count().catch(() => 0)) return t;
  if (process.env.GUIDE_NO_MODEL_REPAIR) return null;
  const prompt = `A recorded how-to video clicks through a web app. This target no longer matches anything visible:
${describe(T)}
The script line it belongs to says: "${context || ''}"
Here is the page now (Playwright aria snapshot):
${await snapshot(page)}

Reply with only a JSON target for the element meant, using the same format: {"role": "...", "name": "..."} or
{"text": "...", "exact": true}, optionally with "in": {...} or "nth": -1. Reply {} if it is not on the page.`;
  try {
    const out = execFileSync('claude', ['-p', '--model', 'haiku', '--output-format', 'json', '--no-session-persistence', '--disallowedTools', 'Bash', 'Edit', 'Write', 'Read', 'Glob', 'Grep'], { input: prompt, encoding: 'utf8', timeout: 90000, env: { ...process.env, MAX_THINKING_TOKENS: '0' } });
    const text = JSON.parse(out).result || '';
    const fixed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (fixed && Object.keys(fixed).length && (await locate(page, fixed).count())) return fixed;
  } catch {}
  return null;
}

// Finds a step's target, repairing it once if needed. `onRepair(old, fixed)` lets the caller save the fix.
async function find(page, T, { context, onRepair } = {}) {
  const loc = locate(page, T);
  try {
    await loc.waitFor({ state: 'visible', timeout: WAIT });
    return loc;
  } catch (e) {
    const fixed = await repair(page, T, context);
    if (!fixed) throw new Error(`not found: ${describe(T)}`);
    if (onRepair) await onRepair(T, fixed);
    return locate(page, fixed);
  }
}

// Runs one step. `io` comes from the caller: { page, click(loc, opts), hover(loc), sleep, asset, site, hooks,
// state, context, onRepair }. record.cjs passes its human-looking click and hover; drive.cjs passes quick ones.
async function run(step, io) {
  const p = io.page;
  const target = (T) => find(p, T, io);
  if (step.click) return io.click(await target(step.click), { pause: step.pause });
  if (step.hover) return io.hover(await target(step.hover));
  if (step.scroll) return (await target(step.scroll)).scrollIntoViewIfNeeded();
  if (step.type) {
    const box = await target(step.type);
    await io.click(box, { pause: 150 });
    return box.pressSequentially(String(step.text ?? ''), { delay: step.delay ?? 16 });
  }
  if (step.press) return p.keyboard.press(step.press);
  if (step.wait) return target(step.wait);
  if (step.sleep) return io.sleep(step.sleep);
  if (step.goto) {
    await p.goto(new URL(step.goto, io.site).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (step.ready) await target(step.ready);
    return;
  }
  if (step.pick) {
    const [chooser] = await Promise.all([p.waitForEvent('filechooser'), io.click(await target(step.pick), {})]);
    return chooser.setFiles(step.files.map(io.asset));
  }
  if (step.paste) {
    const el = await target(step.paste);
    const file = io.asset(step.file);
    const b64 = fs.readFileSync(file).toString('base64');
    const type = /\.png$/i.test(file) ? 'image/png' : /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'application/octet-stream';
    return el.evaluate((node, [data, name, mime]) => {
      const bin = atob(data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: mime }));
      node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, [b64, path.basename(file), type]);
  }
  if (step.hook) {
    const fn = io.hooks && io.hooks[step.hook];
    if (!fn) throw new Error(`no hook "${step.hook}" in takes.cjs`);
    return fn(io.t, io.state, ...(step.args || []));
  }
  throw new Error(`unknown step: ${JSON.stringify(step)}`);
}

const takeFile = (project, guide) => path.join(project, 'scripts', guide, 'take.json');
const readTake = (project, guide) => (fs.existsSync(takeFile(project, guide)) ? JSON.parse(fs.readFileSync(takeFile(project, guide), 'utf8')) : null);
const writeTake = (project, guide, take) => fs.writeFileSync(takeFile(project, guide), JSON.stringify(take, null, 2) + '\n');

// Replaces a repaired target everywhere it appears in the take, so the next take uses it from the start.
function saveRepair(project, guide, old, fixed) {
  const take = readTake(project, guide);
  const was = JSON.stringify(old);
  const swap = (v) => (JSON.stringify(v) === was ? fixed : v && typeof v === 'object' ? (Array.isArray(v) ? v.map(swap) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]))) : v);
  writeTake(project, guide, swap(take));
}

module.exports = { locate, find, run, snapshot, repair, readTake, writeTake, saveRepair, takeFile };
