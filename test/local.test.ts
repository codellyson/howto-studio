import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.STUDIO_HOME = mkdtempSync(join(tmpdir(), 'studio-local-'))
const { detectLocal, ensureLocal, releaseLocal, isLocalUrl } = await import('../server/utils/local.ts')
const { appDir } = await import('../server/utils/studio.ts')

test('the dev command and port come from package.json and the lockfile', () => {
  const repo = mkdtempSync(join(tmpdir(), 'repo-'))
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ scripts: { dev: 'nuxt dev --port 3477' }, dependencies: { nuxt: '4' } }))
  writeFileSync(join(repo, 'pnpm-lock.yaml'), '')
  assert.deepEqual(detectLocal(repo), { command: 'pnpm dev', url: 'http://localhost:3477' })
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' }, devDependencies: { vite: '7' } }))
  assert.equal(detectLocal(repo)?.url, 'http://localhost:5173')
  assert.ok(isLocalUrl('http://127.0.0.1:3000') && !isLocalUrl('https://example.com'))
})

test('a stopped app is started for a job and stopped after it', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'repo-'))
  const app = { slug: 'local-test', name: 'T', repo, site: 'http://localhost:47991', voice: 'Michael', fakeSaves: true, mode: 'local' as const, start: 'exec python3 -m http.server 47991' }
  mkdirSync(appDir(app.slug), { recursive: true })
  const steps: string[] = []
  await ensureLocal(app, (s) => steps.push(s))
  assert.match(steps[0]!, /Starting the app/)
  assert.ok((await fetch(app.site)).ok)
  releaseLocal(app.slug)
  await new Promise(r => setTimeout(r, 800))
  await assert.rejects(fetch(app.site, { signal: AbortSignal.timeout(1000) }))
})

test('a monorepo app uses the lockfile above it', () => {
  const root = mkdtempSync(join(tmpdir(), 'mono-'))
  mkdirSync(join(root, 'apps', 'web'), { recursive: true })
  writeFileSync(join(root, 'pnpm-lock.yaml'), '')
  writeFileSync(join(root, 'apps', 'web', 'package.json'), JSON.stringify({ scripts: { dev: 'nuxt dev' }, dependencies: { nuxt: '4' } }))
  assert.equal(detectLocal(join(root, 'apps', 'web'))?.command, 'pnpm dev')
})

test('a server that fails to start says why', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'repo-'))
  const app = { slug: 'local-fail', name: 'T', repo, site: 'http://localhost:47992', voice: 'Michael', fakeSaves: true, mode: 'local' as const, start: 'echo "ERROR Another dev server is already running" ; exit 1' }
  mkdirSync(appDir(app.slug), { recursive: true })
  await assert.rejects(ensureLocal(app, () => {}), /It said: "ERROR Another dev server is already running"/)
})

test('an app that starts on another port is followed to the address it printed', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'repo-'))
  const app = { slug: 'local-moved', name: 'T', repo, site: 'http://localhost:47994', voice: 'Michael', fakeSaves: true, mode: 'local' as const, start: 'echo "Local: http://127.0.0.1:47993/"; exec python3 -m http.server 47993 --bind 127.0.0.1' }
  mkdirSync(appDir(app.slug), { recursive: true })
  writeFileSync(join(appDir(app.slug), 'app.json'), JSON.stringify(app))
  await ensureLocal(app, () => {})
  assert.equal(app.site, 'http://localhost:47993')
  releaseLocal(app.slug)
})
