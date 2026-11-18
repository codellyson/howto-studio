import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Opens a browser window where the person signs in; the session stays in the app's profile for later takes.
export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const k = key(app.slug, 'signin')
  if (busy(k)) throw createError({ statusCode: 409, statusMessage: 'The sign-in window is already open' })
  const pattern = app.summary?.signedInUrl || new URL(app.site).host
  try { new RegExp(pattern) } catch { throw createError({ statusCode: 400, statusMessage: 'The signed-in address pattern is not valid' }) }
  mkdirSync(profileDir(app.slug), { recursive: true })
  const job: Job = { kind: 'signin', state: 'working', steps: ['Sign in in the window that opened'], started: Date.now() }
  const child = spawn('node', [join(SKILL, 'scripts/login.cjs'), appDir(app.slug), app.site, pattern], { env: { ...process.env, GUIDE_PROFILE: profileDir(app.slug) }, stdio: 'ignore' })
  job.pid = child.pid
  jobs.set(k, job)
  child.on('error', (e) => { job.state = 'error'; job.error = e.message; jobs.save(k, job) })
  child.on('close', (code) => {
    if (job.state === 'error') return
    if (code === 0) {
      writeApp({ ...readApp(app.slug), signedIn: true })
      job.state = 'done'
    } else {
      job.state = 'error'
      job.error = 'The window closed before sign-in finished'
    }
    jobs.save(k, job)
  })
  return job
})
