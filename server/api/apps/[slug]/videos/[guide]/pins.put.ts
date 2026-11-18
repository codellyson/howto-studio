import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const body = await readBody<{ pins?: unknown }>(event)
  if (!Array.isArray(body?.pins) || body.pins.length > 100) throw createError({ statusCode: 400, statusMessage: 'Send the list of marks' })
  writeFileSync(join(appDir(app.slug), 'scripts', guide, 'pins.json'), JSON.stringify(overlay.cleanPins(body.pins), null, 2) + '\n')
  return overlayView(app.slug, guide)
})
