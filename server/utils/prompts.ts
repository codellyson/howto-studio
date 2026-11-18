import { execFileSync, spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const VOICES: Record<string, string> = { Michael: 'am_michael', Adam: 'am_adam', Heart: 'af_heart', Bella: 'af_bella', George: 'bm_george', Emma: 'bf_emma' }

const SUMMARY_SCHEMA = {
  type: 'object',
  required: ['name', 'framework', 'clientRendered', 'signIn', 'signedInUrl', 'pages', 'saves'],
  properties: {
    name: { type: 'string' },
    framework: { type: 'string' },
    clientRendered: { type: 'boolean' },
    signIn: { type: 'string' },
    signedInUrl: { type: 'string' },
    pages: { type: 'array', items: { type: 'string' } },
    saves: { type: 'array', items: { type: 'object', required: ['method', 'route', 'what', 'oneWay'], properties: { method: { type: 'string' }, route: { type: 'string' }, what: { type: 'string' }, oneWay: { type: 'boolean' } } } },
  },
}

// Reads the repo once when an app is connected. The write scan runs here, so the agent only reads.
export function startConnect(app: AppConfig) {
  let writes = ''
  try { writes = execFileSync('node', [join(SKILL, 'scripts/repo-writes.cjs'), app.repo], { encoding: 'utf8', maxBuffer: 4e6 }) } catch (e: any) { writes = `(scan failed: ${e.message})` }
  setUpRecorder(app.slug)
  const prompt = `This repository is a web app. Someone will film narrated how-to videos of it on ${app.site}, driving a browser and faking every save so real data never changes.
Read the code (do not run anything) and report:
- name: the product's name as its users see it (from the page title, README or branding), not the folder name.
- framework: the framework and version, short.
- clientRendered: true when the pages fetch their data in the browser (an SPA, ssr: false, data loaded after mount), so every save can be answered inside the browser; false if pages are server-rendered with data in the HTML.
- signIn: how users sign in, in one plain sentence (for example "Emailed 6-digit code, no password").
- signedInUrl: a JavaScript regex source matching the site's URL once signed in (for example "/albums").
- pages: the app's page routes, as paths.
- saves: every endpoint below that changes data. what = what it does, in a few plain words. oneWay = true when it cannot be undone (approve, send, email, pay, delete, publish).

The write scanner found these:
${writes}`
  return runClaude(key(app.slug), 'connect', prompt, {
    cwd: app.repo, schema: SUMMARY_SCHEMA, readOnly: true,
    onDone: (out) => {
      if (!out || !Array.isArray(out.saves)) throw new Error('The agent did not return a summary of the code')
      const { name, ...summary } = out
      writeApp({ ...readApp(app.slug), ...(typeof name === 'string' && name.trim() ? { name: name.trim().slice(0, 60) } : {}), summary })
    },
  })
}

// Each app folder is a howto-video skill project; Playwright is installed in the background.
function setUpRecorder(slug: string) {
  const dir = appDir(slug)
  if (!existsSync(join(dir, 'package.json'))) writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `howto-${slug}`, private: true }, null, 2) + '\n')
  if (existsSync(join(dir, 'node_modules', 'playwright'))) return
  const child = spawn('sh', ['-c', 'pnpm add -D playwright && pnpm exec playwright install chromium'], { cwd: dir, stdio: 'ignore', detached: true })
  child.unref()
}

const shared = (app: AppConfig, guide: string) => `You make how-to videos with the howto-video skill. Read ${SKILL}/SKILL.md now and follow it.
- Project folder: this directory. It is already a skill project for this app.
- App code: ${app.repo}
- Site to film: ${app.site}
- GUIDE_PROFILE is already set in your environment to ${profileDir(app.slug)}, so run the skill's scripts without prefixing it. Keep that folder: it holds the saved sign-in; never delete it.
- Video: ${guide}
- Nobody can answer questions during this run. Decide sensibly, and write anything the person should know to scripts/${guide}/notes.md.`

export function startScript(app: AppConfig, guide: string, task: string) {
  const prompt = `${shared(app, guide)}

Task for this video: ${task}

Do these parts only:
1. The "Write the takes from the repository" steps, reading the code for this task.
2. Section 1: write scripts/${guide}/script.md from references/script-template.md. Its heading must be "# ${app.name} / <task name, short>". Check the labels with probe.cjs. In the On screen cell of any line whose click can't be undone (approve, send, pay, delete), add "(one-way)".
3. Write scripts/${guide}/notes.md: the saves this video makes, which are one-way, guards, dialogs, and anything that shapes the takes.
Do not make the voice and do not record. The person approves the script in the studio.`
  return runClaude(key(app.slug, guide), 'script', prompt, {
    cwd: appDir(app.slug), env: { GUIDE_PROFILE: profileDir(app.slug) },
    onDone: () => { if (!readScript(app.slug, guide).lines.length) throw new Error('The agent finished without writing a script') },
  })
}

export function startChange(app: AppConfig, guide: string, request: string) {
  const prompt = `${shared(app, guide)}

Change scripts/${guide}/script.md as asked: "${request}"
Keep the skill's table format. If the request is about timing, pauses or clicks rather than words, record it in scripts/${guide}/notes.md so the takes follow it. Do not make the voice and do not record.`
  return runClaude(key(app.slug, guide), 'change', prompt, { cwd: appDir(app.slug), env: { GUIDE_PROFILE: profileDir(app.slug) } })
}

export function startRecord(app: AppConfig, guide: string) {
  const writes = app.fakeSaves
    ? 'The site is live: fake every write as the skill describes, block everything else to its host, and confirm the real data is unchanged before and after.'
    : 'Writes may go through only if this is a test environment; register afterTake to undo each one. If it looks like production, fake them instead.'
  const prompt = `${shared(app, guide)}

Film this video now, following sections 2 to 5 for ${guide}:
- Make the voice with voice "${VOICES[app.voice] ?? 'am_michael'}".
- Write or update this video's function in takes.cjs, using the repository section and scripts/${guide}/notes.md.
- ${writes}
- Record (up to three tries) and cut. The run is done when final/${guide}.mp4 and final/${guide}.lines.json exist.
Then review the frame sheet as section 6 says, and add what you found to scripts/${guide}/notes.md.`
  return runClaude(key(app.slug, guide), 'record', prompt, {
    cwd: appDir(app.slug), env: { GUIDE_PROFILE: profileDir(app.slug) },
    onDone: () => { if (!readRecorded(app.slug, guide)) throw new Error('The agent finished without a finished video') },
  })
}
