import { existsSync, rmSync, writeFileSync } from 'node:fs'

export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const body = await readBody<{ look?: object, scope?: string }>(event)
  if (body?.scope !== 'app' && body?.scope !== 'video') throw createError({ statusCode: 400, statusMessage: 'Say whether the look is for this video or the whole app' })
  const files = overlay.lookFiles(appDir(app.slug), guide)
  writeFileSync(body.scope === 'app' ? files.app : files.video, JSON.stringify(overlay.cleanLook(body.look), null, 2) + '\n')
  // A look for the whole app replaces this video's own look.
  if (body.scope === 'app' && existsSync(files.video)) rmSync(files.video)
  return overlayView(app.slug, guide)
})
