#!/usr/bin/env node
// Lists every endpoint in an app repository that can change data, with the client files that call it.
// Usage: node repo-writes.cjs <repo> [filter]
// Knows file-routed Nuxt/Nitro, Next (app and pages), SvelteKit and Remix, plus .post('/x') style routers.
// shortcut: regex scanning, not a parser; an endpoint built from variables may be missed, so read the routes folder too.
const fs = require('fs');
const path = require('path');

const repo = path.resolve(process.argv[2] || '.');
const filter = process.argv[3] ? new RegExp(process.argv[3], 'i') : null;
const SKIP = new Set(['node_modules', '.git', '.nuxt', '.output', '.next', '.svelte-kit', 'dist', 'build', '.wrangler', 'coverage']);
const CODE = /\.(m?[jt]sx?|vue|svelte)$/;
const METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    // Built bundles are minified: no line break in the first 2000 characters.
    else if (CODE.test(e.name) && fs.readFileSync(p, 'utf8').slice(0, 2000).includes('\n')) files.push(p);
  }
})(repo);

const rel = (p) => path.relative(repo, p);
const routeOf = (parts) => '/' + parts.filter((s) => s && s !== 'index' && !/^\(.*\)$/.test(s)).join('/');
const found = [];
const add = (method, route, file) => found.push({ method, route: route.replace(/\/+/g, '/'), file: rel(file) });

for (const f of files) {
  const r = rel(f).split(path.sep);
  const base = path.basename(f).replace(CODE, '');
  const src = () => fs.readFileSync(f, 'utf8');
  const exported = () => METHODS.filter((m) => new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${m}\\b`).test(src()));

  // Nuxt / Nitro: server/api/a/[id].post.ts
  const nitro = r.indexOf('server');
  if (nitro !== -1 && ['api', 'routes'].includes(r[nitro + 1])) {
    const m = base.match(/\.(post|put|patch|delete)$/i);
    if (m) add(m[1].toUpperCase(), routeOf([r[nitro + 1] === 'api' ? 'api' : '', ...r.slice(nitro + 2, -1), base.slice(0, -m[0].length)]), f);
    else if (!/\.(get|head)$/i.test(base) && /readBody|readMultipartFormData/.test(src())) add('ANY', routeOf(['api', ...r.slice(nitro + 2, -1), base]), f);
    continue;
  }
  // Next app router: app/api/x/route.ts exporting POST
  if (base === 'route' && r.includes('app')) {
    for (const m of exported()) add(m, routeOf(r.slice(r.indexOf('app') + 1, -1)), f);
    continue;
  }
  // Next pages router: pages/api/x.ts handles every method
  if (r.includes('pages') && r[r.indexOf('pages') + 1] === 'api') {
    add('ANY', routeOf(r.slice(r.indexOf('pages'), -1).concat(base).slice(1)), f);
    continue;
  }
  // SvelteKit: +server.ts exports, +page.server.ts form actions
  if (base === '+server') { for (const m of exported()) add(m, routeOf(r.slice(r.indexOf('routes') + 1, -1)), f); continue; }
  if (base === '+page.server' && /export\s+const\s+actions/.test(src())) { add('POST', routeOf(r.slice(r.indexOf('routes') + 1, -1)) + ' (form action)', f); continue; }
  // Remix: route modules exporting action
  if (r.includes('routes') && /export\s+(async\s+)?(function|const)\s+action\b/.test(src())) { add('POST', '(remix action) ' + base, f); continue; }
  // Express, Hono, Fastify and similar: app.post('/x', ...)
  for (const m of src().matchAll(/\.(post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/gi)) add(m[1].toUpperCase(), m[2], f);
}

// Callers: client files that contain the route's path, with dynamic segments matching anything such as ${id}.
// shortcut: a path assembled across several strings is missed; the skill says to confirm callers in the page's code.
const clients = files.filter((f) => !/[\\/](server|api)[\\/]/.test(rel(f)));
const texts = new Map(clients.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const e of found) {
  const segs = e.route.replace(/ \(.*\)$/, '').split('/').filter(Boolean);
  const fixed = segs.filter((s) => !/^[[:(]/.test(s));
  if (!fixed.length || e.route.startsWith('(')) { e.callers = []; continue; }
  const path = new RegExp(segs.map((s) => (/^[[:]/.test(s) ? '[^/\'"`\\s?]+' : esc(s))).join('/') + '(?![\\w-])');
  e.callers = clients.filter((f) => path.test(texts.get(f))).map(rel);
  // No full-path match: the path is likely built from a base, so fall back to the last fixed segment plus the method.
  const tail = new RegExp(`/${esc(fixed.at(-1))}(?![\\w-])`), verb = new RegExp(`method:\\s*['"\`]${e.method}`, 'i');
  if (!e.callers.length && e.method !== 'ANY') e.maybe = clients.filter((f) => tail.test(texts.get(f)) && verb.test(texts.get(f))).map(rel);
}

const shown = found.filter((e) => !filter || filter.test(`${e.method} ${e.route} ${e.callers.join(' ')} ${(e.maybe || []).join(' ')}`));
shown.sort((a, b) => a.route.localeCompare(b.route));
for (const e of shown) console.log(`${e.method.padEnd(6)} ${e.route}\n       handler ${e.file}${e.callers.length ? `\n       called  ${e.callers.join(', ')}` : ''}${e.maybe?.length ? `\n       maybe   ${e.maybe.join(', ')}` : ''}`);
console.log(`\n${shown.length} write endpoints${filter ? ` matching ${filter}` : ''}.`);
