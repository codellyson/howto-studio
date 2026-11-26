import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, resolve } from 'node:path'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ repo?: string, site?: string, mode?: string, start?: string }>(event)
  const repo = resolve(String(body?.repo ?? '').trim().replace(/^~(?=\/|$)/, homedir()))
  if (!body?.repo || !existsSync(repo) || !statSync(repo).isDirectory()) throw createError({ statusCode: 400, statusMessage: 'There is no folder at that path.' })
  let site: URL
  try { site = new URL(String(body.site ?? '').trim()) } catch { throw createError({ statusCode: 400, statusMessage: 'Enter the full site address, starting with https://' }) }
  if (!/^https?:$/.test(site.protocol)) throw createError({ statusCode: 400, statusMessage: 'The site must be an http or https address' })
  const mode = body.mode === 'local' ? 'local' : 'live'
  const start = String(body.start ?? '').trim().slice(0, 300)
  if (mode === 'local' && !isLocalUrl(site.href)) throw createError({ statusCode: 400, statusMessage: 'On this Mac, the address must start with http://localhost' })
  if (mode === 'local' && !start) throw createError({ statusCode: 400, statusMessage: 'Enter the command that starts the app, like pnpm dev' })

  const name = basename(repo)
  let slug = slugify(name)
  for (let i = 2; listApps().some(a => a.slug === slug); i++) slug = `${slugify(name)}-${i}`
  const app: AppConfig = { slug, name: name.charAt(0).toUpperCase() + name.slice(1), repo, site: site.origin, voice: 'Heart', fakeSaves: true, ...(mode === 'local' ? { mode, start } : {}) }
  writeApp(app)
  startConnect(app)
  return { slug }
})
