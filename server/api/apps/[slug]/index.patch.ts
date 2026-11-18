import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const body = await readBody<Partial<AppConfig>>(event)
  if (body.voice !== undefined) {
    if (!VOICES[body.voice]) throw createError({ statusCode: 400, statusMessage: 'Unknown voice' })
    app.voice = body.voice
  }
  if (body.fakeSaves !== undefined) app.fakeSaves = !!body.fakeSaves
  if (body.repo !== undefined) {
    const repo = resolve(String(body.repo).trim().replace(/^~(?=\/|$)/, homedir()))
    if (!existsSync(repo)) throw createError({ statusCode: 400, statusMessage: 'There is no folder at that path.' })
    app.repo = repo
  }
  if (body.site !== undefined) {
    try { app.site = new URL(String(body.site).trim()).origin } catch { throw createError({ statusCode: 400, statusMessage: 'Enter the full site address, starting with https://' }) }
  }
  if (body.start !== undefined && app.mode === 'local') {
    const start = String(body.start).trim().slice(0, 300)
    if (!start) throw createError({ statusCode: 400, statusMessage: 'Enter the command that starts the app, like pnpm dev' })
    app.start = start
  }
  if (app.mode === 'local' && !isLocalUrl(app.site)) throw createError({ statusCode: 400, statusMessage: 'On this Mac, the address must start with http://localhost' })
  writeApp(app)
  return app
})
