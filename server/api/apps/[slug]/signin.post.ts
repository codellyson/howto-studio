import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Opens a browser window where the person signs in; the session stays in the app's profile for later takes.
// An app filmed on this Mac is started first, and stopped once the window closes.
export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const k = key(app.slug, 'signin')
  if (busy(k)) throw createError({ statusCode: 409, statusMessage: 'The sign-in window is already open' })
  const pattern = app.summary?.signedInUrl || new URL(app.site).host
  try { new RegExp(pattern) } catch { throw createError({ statusCode: 400, statusMessage: 'The signed-in address pattern is not valid' }) }
  mkdirSync(profileDir(app.slug), { recursive: true })
  const job: Job = { kind: 'signin', state: 'working', steps: [], started: Date.now() }
  jobs.set(k, job)
  const say = (t: string) => { job.steps = [...job.steps, t]; jobs.save(k, job) }
  const end = (patch: Partial<Job>) => { Object.assign(job, patch); jobs.save(k, job); releaseLocal(app.slug) }
  ;(async () => {
    try { await ensureLocal(app, say) } catch (e: any) { return end({ state: 'error', error: `${e.message}.` }) }
    say('Sign in in the window that opened')
    const child = spawn('node', [join(SKILL, 'scripts/login.cjs'), appDir(app.slug), app.site, pattern], { env: { ...process.env, GUIDE_PROFILE: profileDir(app.slug) }, stdio: 'ignore' })
    job.pid = child.pid
    jobs.save(k, job)
    child.on('error', e => end({ state: 'error', error: e.message }))
    child.on('close', (code) => {
      if (job.state === 'error') return
      if (code === 0) writeApp({ ...readApp(app.slug), signedIn: true })
      end(code === 0 ? { state: 'done' } : { state: 'error', error: 'The window closed before sign-in finished' })
    })
  })()
  return job
})
