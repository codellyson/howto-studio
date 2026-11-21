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
  const prompt = `This repository is a web app. Someone will film narrated how-to videos of it on ${app.site}${app.mode === 'local' ? ' (its dev server on this Mac)' : ''}, driving a browser and faking every save so real data never changes.
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
      if (!out || !Array.isArray(out.saves)) throw new Error('The code could not be summarised')
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

// Jobs that open the site start the app's dev server first when it runs on this Mac, and stop it after.
const onThisMac = (app: AppConfig) => ({ before: (say: (t: string) => void) => ensureLocal(app, say), after: () => releaseLocal(app.slug) })

// Read when the agent starts, after the app may have moved to a free port.
const guideEnv = (app: AppConfig) => ({ GUIDE_PROFILE: profileDir(app.slug), get GUIDE_SITE() { return app.site } })

const shared = (app: AppConfig, guide: string) => `You make how-to videos with the howto-video skill. Read ${SKILL}/SKILL.md now and follow it.
- Project folder: this directory. It is already a skill project for this app.
- App code: ${app.repo}
- Site to film: ${app.site}${app.mode === 'local' ? ' (the app running on this Mac from the code above; the studio has started it, so do not start or stop it yourself)' : ''}
${app.mode === 'local' ? `- The app's port changes on every run. GUIDE_SITE in your environment holds this run's address: takes.cjs must read it (const APP = process.env.GUIDE_SITE || '${app.site}'), and blockWrites must match any localhost port. Never write a fixed port into takes.cjs or the script.\n` : ''}- GUIDE_PROFILE is already set in your environment to ${profileDir(app.slug)}, so run the skill's scripts without prefixing it. Keep that folder: it holds the saved sign-in; never delete it.
- Video: ${guide}
- Nobody can answer questions during this run. Decide sensibly, and write anything the person should know to scripts/${guide}/notes.md.
- Your final message is shown to the person. Make it one or two plain sentences about the video, with no "I" or "we": if the work could not finish, say where it stopped and why (for example "Filming stopped at line 6. The Approve album button never appeared."). No praise, no exclamation marks.`

const OUTLINE_SCHEMA = {
  type: 'object',
  required: ['clear', 'angles'],
  properties: {
    clear: { type: 'boolean' },
    angles: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'object', required: ['title', 'who', 'after', 'steps'], properties: { title: { type: 'string' }, who: { type: 'string' }, after: { type: 'string' }, steps: { type: 'array', minItems: 3, maxItems: 12, items: { type: 'string' } } } } },
  },
}

// Before a script: turn the request into one outline, or two or three when it is vague, for the person to pick.
// Reading only, so it is quick and needs no running app.
export function startOutline(app: AppConfig, guide: string, task: string) {
  const s = app.summary
  const prompt = `Someone wants a short narrated how-to video of ${app.name}, the web app in this repository. Their request: "${task}"
${s ? `Pages: ${s.pages.join(', ')}. Sign-in: ${s.signIn}.` : ''}
Read the code (do not run anything) and plan the video. A video shows one task, 30 to 60 seconds, for someone who is not technical.
- clear: true when the request names one task and who it is for. Then return exactly one angle.
- Otherwise clear is false: the request is a tour, a feature list or a vague goal. Return two or three different videos it could be, each one task, most useful first. One of them may be a short tour if that fits.
Each angle:
- title: the video's name, in a few words, starting with a verb where it can ("File your first request").
- who: who watches, in a few words ("a new team member").
- after: what they can do after watching, in one short sentence.
- steps: what happens on screen, one short line each, 4 to 10 lines, in the app's own words. The first step already does something; never open on a page where nothing happens. Every step that says "click X" really clicks X. When the video switches to another person's view, that step says whose view it is and how it looks different. The last step shows the result from the other side (what the customer, recipient or teammate sees).`
  return runClaude(key(app.slug, guide), 'plan', prompt, {
    cwd: app.repo, schema: OUTLINE_SCHEMA, readOnly: true,
    onDone: (out) => {
      const angles = (Array.isArray(out?.angles) ? out.angles : []).filter((a: any) => a?.title && Array.isArray(a.steps) && a.steps.length)
      if (!angles.length) throw new Error('No outline was written')
      writeOutline(app.slug, guide, { task, clear: !!out.clear, angles: angles.slice(0, 3), chosen: null })
    },
  })
}

// The approved outline, as the request the script is written from.
export function outlineTask(o: Outline) {
  const a = o.chosen!
  return `${a.title}
Who watches: ${a.who}. After watching, they can ${a.after.replace(/^./, c => c.toLowerCase())}
Approved outline. Follow it in order; each step becomes one or more script lines:
${a.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
}

export function startScript(app: AppConfig, guide: string, task: string) {
  const prompt = () => `${shared(app, guide)}

Task for this video: ${task}

Do these parts only:
1. The "Write the takes from the repository" steps, reading the code for this task.
2. Section 1: write scripts/${guide}/script.md from references/script-template.md. Its heading must be "# ${app.name} / <task name, short>". Check the labels with probe.cjs. In the On screen cell of any line whose click can't be undone (approve, send, pay, delete), add "(one-way)". Follow the skill's script rules: something happens in the first line, every "click X" line clicks X, and each voice line fits on one caption line. Then run node ${SKILL}/scripts/check.cjs . ${guide} and fix what it flags; if a flag is wrong for this video, keep the line and say why in notes.md.
3. Write scripts/${guide}/notes.md: the saves this video makes, which are one-way, guards, dialogs, and anything that shapes the takes.
Do not make the voice and do not record. The person approves the script in the studio.`
  return runClaude(key(app.slug, guide), 'script', prompt, {
    cwd: appDir(app.slug), env: guideEnv(app), ...onThisMac(app),
    onDone: () => { if (!readScript(app.slug, guide).lines.length) throw new Error('No script was written') },
  })
}

export function startChange(app: AppConfig, guide: string, request: string) {
  const prompt = () => `${shared(app, guide)}

Change scripts/${guide}/script.md as asked: "${request}"
Keep the skill's table format. Afterwards run node ${SKILL}/scripts/check.cjs . ${guide} and fix anything the change broke. If the request is about timing, pauses or clicks rather than words, record it in scripts/${guide}/notes.md so the takes follow it. Do not make the voice and do not record.`
  return runClaude(key(app.slug, guide), 'change', prompt, { cwd: appDir(app.slug), env: guideEnv(app), ...onThisMac(app) })
}

export function startRecord(app: AppConfig, guide: string) {
  const writes = app.fakeSaves
    ? `${app.mode === 'local' ? 'The app runs on this Mac, but its data may be shared' : 'The site is live'}: fake every write as the skill describes, block everything else to its host, and confirm the data is unchanged before and after.`
    : 'Writes may go through only if this is a test environment; register afterTake to undo each one. If it looks like production, fake them instead.'
  const prompt = () => `${shared(app, guide)}

Film this video now, following sections 2 to 5 for ${guide}:
- Make the voice with voice "${VOICES[app.voice] ?? 'am_michael'}".
- Write or update this video's function in takes.cjs, using the repository section and scripts/${guide}/notes.md.
- ${writes}
- Record (up to three tries) and cut. The run is done when final/${guide}.mp4 and final/${guide}.lines.json exist.
Then review the frame sheet as section 6 says, and add what you found to scripts/${guide}/notes.md. Do not write look.json: the person sets the look in the studio. Note look problems in notes.md instead.`
  return runClaude(key(app.slug, guide), 'record', prompt, {
    cwd: appDir(app.slug), env: guideEnv(app), ...onThisMac(app),
    onDone: () => { if (!readRecorded(app.slug, guide)) throw new Error('No finished video was made') },
  })
}
