import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const task = String((await readBody<{ task?: string }>(event))?.task ?? '').trim()
  if (task.length < 4) throw createError({ statusCode: 400, statusMessage: 'Say what the video should show' })
  if (task.length > 500) throw createError({ statusCode: 400, statusMessage: 'Keep it under 500 characters' })
  if (busy(key(app.slug))) throw createError({ statusCode: 409, statusMessage: 'The code is still being read. Try again in a moment.' })
  const guide = newGuide(app.slug, task)
  // Kept so a failed script can be written again from the same request.
  writeFileSync(join(appDir(app.slug), 'scripts', guide, 'task.txt'), task)
  startOutline(app, guide, task)
  return { guide }
})
