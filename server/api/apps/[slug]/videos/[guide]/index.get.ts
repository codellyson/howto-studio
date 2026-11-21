import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const { title, lines } = readScript(app.slug, guide)
  const notesFile = join(appDir(app.slug), 'scripts', guide, 'notes.md')
  const taskFile = join(appDir(app.slug), 'scripts', guide, 'task.txt')
  return {
    app: { slug: app.slug, name: app.name },
    guide,
    title: title || guide,
    lines,
    recorded: readRecorded(app.slug, guide),
    status: videoStatus(app.slug, guide),
    notes: existsSync(notesFile) ? readFileSync(notesFile, 'utf8') : '',
    // Videos made before requests were saved start from their name.
    outline: readOutline(app.slug, guide),
    task: existsSync(taskFile) ? readFileSync(taskFile, 'utf8') : guide.replace(/-/g, ' '),
    oneWay: (app.summary?.saves ?? []).filter(s => s.oneWay),
    overlay: overlayView(app.slug, guide),
    job: jobs.get(key(app.slug, guide)) ?? null,
  }
})
