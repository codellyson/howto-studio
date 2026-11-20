import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Writes the script again after a failed run, from the saved request or an edited one.
export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const task = String((await readBody<{ task?: string }>(event))?.task ?? '').trim()
  if (task.length < 4) throw createError({ statusCode: 400, statusMessage: 'Say what the video should show' })
  if (task.length > 500) throw createError({ statusCode: 400, statusMessage: 'Keep it under 500 characters' })
  if (readScript(app.slug, guide).lines.length) throw createError({ statusCode: 400, statusMessage: 'This video already has a script. Ask for a change instead.' })
  if (busy(key(app.slug))) throw createError({ statusCode: 409, statusMessage: 'The code is still being read. Try again in a moment.' })
  writeFileSync(join(appDir(app.slug), 'scripts', guide, 'task.txt'), task)
  return startScript(readApp(app.slug), guide, task)
})
