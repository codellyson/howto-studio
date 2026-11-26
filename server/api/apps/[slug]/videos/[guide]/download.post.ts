import { execFile } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Copies the finished MP4 into Downloads under the video's name and shows it there. Done by the engine, since the
// Mac app's web view doesn't save downloads.
export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const f = videoFile(app.slug, guide)
  if (!existsSync(f)) throw createError({ statusCode: 404, statusMessage: 'Not filmed yet' })
  const name = `${app.name} - ${readScript(app.slug, guide).title || guide}`.replace(/[/:\\]/g, '-').slice(0, 120)
  const dir = join(homedir(), 'Downloads')
  let file = `${name}.mp4`
  for (let i = 2; existsSync(join(dir, file)); i++) file = `${name} ${i}.mp4`
  copyFileSync(f, join(dir, file))
  execFile('open', ['-R', join(dir, file)])
  return { file }
})
