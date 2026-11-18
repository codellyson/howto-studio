import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { basename, join, resolve } from 'node:path'

// Everything lives in one folder: one howto-video skill project per app (apps/<slug>), sign-in profiles beside it.
export const HOME = resolve(process.env.STUDIO_HOME || join(homedir(), 'HowtoStudio'))
export const SKILL = resolve(process.env.HOWTO_SKILL || join(homedir(), '.claude/skills/howto-video'))
const MODEL = process.env.STUDIO_MODEL || 'opus'
export const SAFE = /^[a-z0-9][a-z0-9-]{0,60}$/

export type Save = { method: string, route: string, what: string, oneWay: boolean }
export type Summary = { framework: string, clientRendered: boolean, signIn: string, signedInUrl: string, pages: string[], saves: Save[] }
// mode 'local': the site is the app's dev server on this Mac, started with `start` in the repo when it isn't running.
export type AppConfig = { slug: string, name: string, repo: string, site: string, voice: string, fakeSaves: boolean, mode?: 'live' | 'local', start?: string, summary?: Summary, signedIn?: boolean }
export type Line = { id: string, screen: string, voice: string }
export type Job = { kind: 'connect' | 'script' | 'change' | 'record' | 'signin' | 'render', state: 'working' | 'done' | 'error', steps: string[], error?: string, started: number, pid?: number, detached?: boolean }

export const appDir = (slug: string) => join(HOME, 'apps', slug)
export const profileDir = (slug: string) => join(HOME, 'profiles', slug)
const configFile = (slug: string) => join(appDir(slug), 'app.json')

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item'
}

export function listApps(): AppConfig[] {
  const dir = join(HOME, 'apps')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(s => SAFE.test(s) && existsSync(configFile(s))).map(readApp)
}

export function readApp(slug: string): AppConfig {
  return JSON.parse(readFileSync(configFile(slug), 'utf8'))
}

export function writeApp(app: AppConfig) {
  mkdirSync(appDir(app.slug), { recursive: true })
  writeFileSync(configFile(app.slug), JSON.stringify(app, null, 2) + '\n')
}

export function appOr404(slug?: string) {
  if (!slug || !SAFE.test(slug) || !existsSync(configFile(slug))) throw createError({ statusCode: 404, statusMessage: 'No such app' })
  return readApp(slug)
}

export function guideOr404(app: AppConfig, guide?: string) {
  if (!guide || !SAFE.test(guide) || !existsSync(join(appDir(app.slug), 'scripts', guide))) throw createError({ statusCode: 404, statusMessage: 'No such video' })
  return guide
}

// Removing keeps the files: the folder is renamed, so videos can be recovered by hand.
export function removeApp(slug: string) {
  renameSync(appDir(slug), join(HOME, 'apps', `.removed-${slug}-${Date.now()}`))
}

// ---- Scripts ----

const scriptFile = (slug: string, guide: string) => join(appDir(slug), 'scripts', guide, 'script.md')

// The skill's script.md: a "# Product / Task" heading and a table whose rows start with "| L".
export function readScript(slug: string, guide: string): { title: string, lines: Line[] } {
  const f = scriptFile(slug, guide)
  if (!existsSync(f)) return { title: '', lines: [] }
  const text = readFileSync(f, 'utf8')
  const title = text.match(/^#\s+(.+)$/m)?.[1]?.split(' / ').pop()?.trim() ?? guide
  const lines = text.split('\n').filter(l => /^\|\s*L\d+/.test(l)).map((l) => {
    const cells = l.split('|').slice(1, -1).map(c => c.trim())
    return { id: cells[0]!, screen: cells[1] ?? '', voice: cells.at(-1) ?? '' }
  })
  return { title, lines }
}

export function setLineVoice(slug: string, guide: string, id: string, voice: string) {
  const clean = voice.replace(/[|\n\r]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!clean) throw createError({ statusCode: 400, statusMessage: 'A line needs some words' })
  const f = scriptFile(slug, guide)
  const out = readFileSync(f, 'utf8').split('\n').map((l) => {
    if (!new RegExp(`^\\|\\s*${id}\\s*\\|`).test(l)) return l
    const cells = l.split('|')
    cells[cells.length - 2] = ` ${clean} `
    return cells.join('|')
  })
  writeFileSync(f, out.join('\n'))
}

export type Recorded = { duration: number, lines: { id: string, t: number, len: number }[] }

export function readRecorded(slug: string, guide: string): Recorded | null {
  const f = join(appDir(slug), 'final', `${guide}.lines.json`)
  return existsSync(f) && existsSync(videoFile(slug, guide)) ? JSON.parse(readFileSync(f, 'utf8')) : null
}

export const videoFile = (slug: string, guide: string) => join(appDir(slug), 'final', `${guide}.mp4`)

export function videoStatus(slug: string, guide: string) {
  const job = jobs.get(key(slug, guide))
  if (job?.state === 'working') return job.kind === 'record' ? 'recording' : job.kind === 'render' ? 'rendering' : 'writing'
  const script = scriptFile(slug, guide)
  if (!existsSync(script)) return job?.state === 'error' ? 'failed' : 'writing'
  const v = videoFile(slug, guide)
  if (!existsSync(v)) return 'draft'
  return statSync(script).mtimeMs > statSync(v).mtimeMs ? 'changed' : 'done'
}

export function listVideos(slug: string) {
  const dir = join(appDir(slug), 'scripts')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(g => SAFE.test(g)).map((guide) => {
    const rec = readRecorded(slug, guide)
    return { guide, title: readScript(slug, guide).title || guide, status: videoStatus(slug, guide), duration: rec?.duration ?? null, cover: rec ? rec.lines.at(-1)?.id ?? null : null }
  }).sort((a, b) => a.title.localeCompare(b.title))
}

// ---- Look and pinned marks: drawn over the clean take by the skill's dress.cjs ----

// The skill's own overlay module, so the preview here is built by the same code that draws the video.
export const overlay = createRequire(import.meta.url)(join(SKILL, 'scripts', 'overlay.cjs'))
const cleanFile = (slug: string, guide: string) => join(appDir(slug), 'out', `${guide}.silent.mp4`)
const planFile = (slug: string, guide: string) => join(appDir(slug), 'out', `${guide}.overlay.json`)
export type Plan = { size: [number, number], duration: number, lines: { id: string, t: number, len: number }[], cursor: { t: number, k: string, x: number, y: number }[], targets: { line: string, t: number, name: string, box: { x: number, y: number, w: number, h: number } }[] }

// Videos filmed before looks could change have no clean take, so they can't be re-styled.
export function readPlan(slug: string, guide: string): Plan | null {
  const f = planFile(slug, guide)
  return existsSync(f) && existsSync(cleanFile(slug, guide)) ? JSON.parse(readFileSync(f, 'utf8')) : null
}

const frameAt = (line: { t: number, len: number }, duration: number) => Math.min(line.t + line.len * 0.75, duration - 0.1)

export function overlayView(slug: string, guide: string) {
  const plan = readPlan(slug, guide)
  const project = appDir(slug)
  const { look, scope } = overlay.readLook(project, guide)
  const pins = overlay.readPins(project, guide)
  if (!plan) return { restyle: false, look, scope, choices: overlay.CHOICES, backgrounds: overlay.BACKGROUNDS, pins, css: '', size: null, lines: {} }
  const captions = Object.fromEntries(readScript(slug, guide).lines.map(l => [l.id, l.voice]))
  const zooms = overlay.zoomWindows(look, plan.lines, plan.targets)
  const address = (plan as any).address || readApp(slug).site
  const lines: Record<string, { html: string, targets: string[] }> = {}
  for (const l of plan.lines) {
    const targets = plan.targets.filter(t => t.line === l.id)
    const at = frameAt(l, plan.duration)
    const last = plan.cursor.filter(c => c.t <= at).at(-1)
    lines[l.id] = {
      // The same frame, marks, cursor, zoom and caption the video gets at this still's moment.
      html: overlay.previewHtml({
        look, size: plan.size, address, caption: captions[l.id], targets,
        src: `/api/apps/${slug}/videos/${guide}/frame/${l.id}.jpg?v=${plan.duration}`,
        pins: pins.filter((p: any) => p.line === l.id),
        cursor: last && last.k !== 'hide' ? { x: last.x, y: last.y } : null,
        zoom: overlay.zoomAt(zooms, at, plan.size),
      }),
      targets: targets.map(t => t.name),
    }
  }
  const files = overlay.lookFiles(project, guide)
  const newest = Math.max(...[files.app, files.video, join(project, 'scripts', guide, 'pins.json')].filter(f => existsSync(f)).map(f => statSync(f).mtimeMs), 0)
  const v = videoFile(slug, guide)
  return {
    restyle: true, look, scope, choices: overlay.CHOICES, backgrounds: overlay.BACKGROUNDS, pins, css: overlay.css(), size: plan.size, lines,
    // The look or the marks changed after the video was last made.
    stale: existsSync(v) && newest > statSync(v).mtimeMs,
  }
}

// One still per line, taken late in the line so the click has happened. A clean take gives a still without
// captions, for the preview to draw over; an older video gives its finished frame with the caption cropped off.
export function frameFile(slug: string, guide: string, id: string) {
  const rec = readRecorded(slug, guide)
  const line = rec?.lines.find(l => l.id === id)
  if (!rec || !line) return null
  const dir = join(appDir(slug), 'out', 'frames', guide)
  const f = join(dir, `${id}.jpg`)
  const clean = readPlan(slug, guide) ? cleanFile(slug, guide) : null
  const v = clean ?? videoFile(slug, guide)
  if (existsSync(f) && statSync(f).mtimeMs >= statSync(v).mtimeMs) return f
  mkdirSync(dir, { recursive: true })
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(frameAt(line, rec.duration)), '-i', v, '-frames:v', '1', '-vf', clean ? 'scale=960:-1' : 'crop=iw:ih-150:0:0,scale=960:-1', '-q:v', '4', f])
  return f
}

// Draws the look and marks onto the clean take again. No agent: the skill's cut.py --redress.
export function startRender(slug: string, guide: string) {
  const k = key(slug, guide)
  if (busy(k)) throw createError({ statusCode: 409, statusMessage: 'This is already running.' })
  const job: Job = { kind: 'render', state: 'working', steps: ['Drawing the captions and cursor'], started: Date.now() }
  jobs.set(k, job)
  const child = spawn('python3', [join(SKILL, 'scripts', 'cut.py'), appDir(slug), guide, '--redress'], { cwd: appDir(slug) })
  job.pid = child.pid
  jobs.save(k, job)
  let stderr = ''
  child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000) })
  child.on('error', (e) => { job.state = 'error'; job.error = `Could not start python3: ${e.message}`; jobs.save(k, job) })
  child.on('close', (code) => {
    if (job.state === 'error') return
    job.state = code === 0 ? 'done' : 'error'
    if (code !== 0) job.error = `The video could not be made again. ${stderr.trim().split('\n').at(-1) ?? ''}`.trim()
    jobs.save(k, job)
  })
  return job
}

// ---- Jobs: one claude -p run per app or video at a time ----
// Each job is also written to disk with its process id, so a restarted studio still knows what is running.

const jobsDir = join(HOME, '.jobs')
const jobFile = (k: string) => join(jobsDir, `${k.replace('/', '__')}.json`)
const alive = (pid?: number) => { if (!pid) return false; try { process.kill(pid, 0); return true } catch { return false } }
const memory = new Map<string, Job>()

export const jobs = {
  get(k: string): Job | undefined {
    let job = memory.get(k)
    if (!job && existsSync(jobFile(k))) {
      try { job = JSON.parse(readFileSync(jobFile(k), 'utf8')) as Job } catch { return undefined }
      memory.set(k, job)
    }
    // A job whose process outlived an earlier studio: it ends when its process does.
    if (job?.state === 'working' && job.detached && !alive(job.pid)) {
      const [slug, guide] = k.split('/') as [string, string]
      const made = job.kind === 'record' || job.kind === 'render' ? !!readRecorded(slug, guide) : job.kind === 'script' ? readScript(slug, guide).lines.length > 0 : false
      Object.assign(job, made ? { state: 'done' } : { state: 'error', error: 'The studio restarted while this was running. Try again.' })
      jobs.save(k, job)
    }
    return job
  },
  set(k: string, job: Job) {
    memory.set(k, job)
    jobs.save(k, job)
  },
  save(k: string, job: Job) {
    mkdirSync(jobsDir, { recursive: true })
    writeFileSync(jobFile(k), JSON.stringify({ ...job, detached: true }))
  },
  entries: () => memory.entries(),
}

// Jobs left by a previous run of the studio are loaded once, so a delete or a new run sees them.
if (existsSync(jobsDir)) for (const f of readdirSync(jobsDir)) if (f.endsWith('.json')) jobs.get(f.slice(0, -5).replace('__', '/'))

export const key = (slug: string, guide = '_') => `${slug}/${guide}`
export const busy = (k: string) => jobs.get(k)?.state === 'working'

const BASH = ['node', 'python3', 'pnpm', 'npx', 'ffmpeg', 'ffprobe', 'curl', 'ls', 'cat', 'head', 'tail', 'grep', 'mkdir', 'mktemp', 'cp', 'find', 'wc', 'zip', 'unzip', 'git log', 'git rev-parse', 'git status']
// The skill prefixes commands with GUIDE_PROFILE= and retries in a for loop, so those starts are allowed too.
const TOOLS = ['Read', 'Glob', 'Grep', 'Write', 'Edit', ...BASH.map(c => `Bash(${c}:*)`), 'Bash(GUIDE_PROFILE=:*)', 'Bash(for :*)', 'Bash(cd :*)']

// Runs a headless Claude Code session and turns its tool calls into plain progress lines.
export function runClaude(k: string, kind: Job['kind'], prompt: string, opts: { cwd: string, env?: Record<string, string>, schema?: object, readOnly?: boolean, onDone?: (out: any) => void, before?: (say: (t: string) => void) => Promise<void>, after?: () => void }) {
  if (busy(k)) throw createError({ statusCode: 409, statusMessage: 'This is already running.' })
  const job: Job = { kind, state: 'working', steps: [], started: Date.now() }
  jobs.set(k, job)
  const say = (t?: string | null) => { if (t && job.steps.at(-1) !== t) { job.steps = [...job.steps, t].slice(-60); jobs.save(k, job) } }
  const fail = (message: string) => { job.state = 'error'; job.error = message; jobs.save(k, job); opts.after?.() }
  ;(async () => {
    try { await opts.before?.(say) } catch (e: any) { return fail(`${e.message}.`) }
    launch()
  })()
  return job

  function launch() {
    const args = ['-p', '--model', MODEL, '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--add-dir', SKILL]
    if (opts.schema) args.push('--json-schema', JSON.stringify(opts.schema))
    args.push('--allowedTools', ...(opts.readOnly ? ['Read', 'Glob', 'Grep'] : TOOLS))
    if (opts.readOnly) args.push('--disallowedTools', 'Bash', 'Edit', 'Write')
    const child = spawn('claude', args, { cwd: opts.cwd, env: { ...process.env, ...opts.env, HOWTO_STUDIO_CHILD: '1' } })
    job.pid = child.pid
    jobs.save(k, job)
    let buf = ''
    let result: any = null
    let failure = ''
    let lastText = ''
    child.stdout.on('data', (d) => {
      buf += d
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        let ev: any
        try { ev = JSON.parse(line) } catch { continue }
        if (ev.type === 'result') {
          result = ev.structured_output ?? ev.result
          if (ev.is_error) failure = String(ev.result ?? 'The agent stopped with an error')
        }
        for (const c of ev.type === 'assistant' ? ev.message?.content ?? [] : []) {
          if (c.type === 'tool_use') say(describe(c.name, c.input ?? {}))
          if (c.type === 'text' && c.text?.trim()) lastText = c.text.trim()
        }
      }
    })
    let stderr = ''
    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000) })
    child.on('error', (e) => { fail(`Could not start claude: ${e.message}`) })
    child.on('close', (code) => {
      if (job.state === 'error') return
      if (code !== 0 || failure) {
        job.state = 'error'
        job.error = failure || stderr.trim().split('\n').at(-1) || `claude exited with code ${code}`
      } else {
        try {
          opts.onDone?.(result)
          job.state = 'done'
        } catch (e: any) {
          job.state = 'error'
          // The prompts ask the agent to end with a short, plain account of where it stopped and why.
          job.error = lastText ? `${e.message}. ${lastText.slice(0, 400)}` : `${e.message}.`
        }
      }
      jobs.save(k, job)
      opts.after?.()
    })
    child.stdin.end(prompt)
  }
}

function describe(name: string, i: any): string | null {
  const file = (p = '') => basename(String(p))
  if (name === 'Read') return `Reading ${file(i.file_path)}`
  if (name === 'Grep') return `Searching the code for “${String(i.pattern).slice(0, 40)}”`
  if (name === 'Glob') return `Looking for ${i.pattern}`
  if (name === 'Write' || name === 'Edit') return `Writing ${file(i.file_path)}`
  if (name !== 'Bash') return null
  const cmd = String(i.command ?? '')
  if (cmd.includes('voice.py')) return 'Making the voice'
  if (cmd.includes('record.cjs')) return 'Filming the take'
  if (cmd.includes('cut.py')) return 'Cutting and checking the video'
  if (cmd.includes('probe.cjs')) return 'Looking at the live page'
  if (cmd.includes('repo-writes.cjs')) return 'Listing what the app saves'
  if (/pnpm (add|install)|playwright install/.test(cmd)) return 'Setting up the recorder'
  if (cmd.startsWith('curl')) return 'Checking the real data is unchanged'
  return i.description ? String(i.description) : 'Running a command'
}
