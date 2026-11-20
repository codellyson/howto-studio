import { spawn } from 'node:child_process'
import { existsSync, openSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { appDir, readApp, writeApp, type AppConfig } from './studio.ts'

// Filming an app on this Mac: the studio starts its dev server for a job and stops it after,
// unless something was already answering at that address, which is then used as it is.

const DEFAULT_PORTS: [string, number][] = [['nuxt', 3000], ['next', 3000], ['astro', 4321], ['@sveltejs/kit', 5173], ['vite', 5173], ['@remix-run/dev', 3000], ['react-scripts', 3000], ['@angular/core', 4200], ['gatsby', 8000]]

// The dev command and address from package.json: the "dev" (or "start") script, run with the repo's package manager.
export function detectLocal(repo: string): { command: string, url: string } | null {
  const pkgFile = join(repo, 'package.json')
  if (!existsSync(pkgFile)) return null
  let pkg: any
  try { pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) } catch { return null }
  const name = pkg.scripts?.dev ? 'dev' : pkg.scripts?.start ? 'start' : null
  if (!name) return null
  const script = String(pkg.scripts[name])
  const pm = packageManager(repo)
  const command = pm === 'npm' ? `npm run ${name}` : `${pm} ${name}`
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const port = Number(script.match(/(?:--port|-p)[ =](\d{2,5})/)?.[1] ?? script.match(/PORT=(\d{2,5})/)?.[1]) || DEFAULT_PORTS.find(([d]) => deps[d])?.[1] || 3000
  return { command, url: `http://localhost:${port}` }
}

// In a monorepo the lockfile sits above the app's folder, so look upwards for it.
function packageManager(repo: string) {
  for (let dir = repo; dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
    if (existsSync(join(dir, 'yarn.lock'))) return 'yarn'
    if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun'
    if (existsSync(join(dir, 'package-lock.json')) || existsSync(join(dir, '.git'))) break
  }
  return 'npm'
}

// The line of the server's output that says why it stopped, without stack frames or blank lines.
function reason(logFile: string) {
  try {
    const lines = readFileSync(logFile, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('at ') && !/ELIFECYCLE|^>/.test(l))
    return lines.find(l => /error|already|EADDRINUSE|not found|cannot/i.test(l) && l.length > 12) ?? ''
  } catch { return '' }
}

// The last local address the dev server printed, such as "Local: http://127.0.0.1:3000/".
function announced(logFile: string) {
  try {
    const found = [...readFileSync(logFile, 'utf8').matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+/g)].map(m => m[0])
    return found.at(-1) ?? null
  } catch { return null }
}

export const isLocalUrl = (url: string) => { try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname) } catch { return false } }

async function answers(url: string) {
  try { await fetch(url, { signal: AbortSignal.timeout(2000), redirect: 'manual' }); return true } catch { return false }
}

const running = new Map<string, { pid?: number, users: number }>()

// Before a job: make sure the app answers at its address, starting it if needed (up to two minutes).
export async function ensureLocal(app: AppConfig, say: (step: string) => void) {
  if (app.mode !== 'local') return
  const held = running.get(app.slug)
  if (held) { held.users++; return }
  if (await answers(app.site)) { running.set(app.slug, { users: 1 }); return }
  if (!app.start) throw new Error(`Nothing answers at ${app.site}, and there is no command to start the app`)
  say(`Starting the app: ${app.start}`)
  const logFile = join(appDir(app.slug), 'local.log')
  const log = openSync(logFile, 'w')
  // A login shell, so the person's PATH (node, pnpm) applies, as it does in their terminal.
  const child = spawn(process.env.SHELL || '/bin/zsh', ['-lc', app.start], { cwd: app.repo, detached: true, stdio: ['ignore', log, log] })
  child.unref()
  running.set(app.slug, { pid: child.pid, users: 1 })
  let exited = false
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 1000))
    if (child.exitCode !== null) { exited = true; break }
    if (await answers(app.site)) return
    // Dev servers move to another port when theirs is taken; follow the address the app printed.
    const printed = announced(logFile)
    if (printed && new URL(printed).origin !== new URL(app.site).origin && await answers(printed)) {
      say(`The app started at ${printed}, not ${app.site}. Using ${printed}`)
      app.site = new URL(printed).origin.replace('127.0.0.1', 'localhost')
      writeApp({ ...readApp(app.slug), site: app.site })
      return
    }
  }
  releaseLocal(app.slug, true)
  const why = reason(logFile).replace(/\.$/, '')
  if (exited) throw new Error(`The app stopped before it answered at ${app.site}${why ? `. It said: "${why.slice(0, 160)}"` : ''}. Its full output is in local.log in the app's studio folder`)
  throw new Error(`Nothing answered at ${app.site} within two minutes, so the app was stopped. Check the address in Settings; the app's output is in local.log in its studio folder`)
}

// After a job: stop the server only if the studio started it and no other job still needs it.
export function releaseLocal(slug: string, force = false) {
  const held = running.get(slug)
  if (!held) return
  held.users = force ? 0 : held.users - 1
  if (held.users > 0) return
  running.delete(slug)
  if (held.pid) { try { process.kill(-held.pid, 'SIGTERM') } catch {} }
}

// The studio is closing: stop every server it started.
process.once('exit', () => { for (const slug of [...running.keys()]) releaseLocal(slug, true) })
