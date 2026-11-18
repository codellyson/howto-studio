import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'

// "Export" shows the finished MP4 in Finder; the file is already a normal MP4.
export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const f = videoFile(app.slug, guide)
  if (!existsSync(f)) throw createError({ statusCode: 404, statusMessage: 'Not filmed yet' })
  execFile('open', ['-R', f])
  return { path: f }
})
