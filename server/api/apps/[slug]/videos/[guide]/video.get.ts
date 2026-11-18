import { createReadStream, existsSync, statSync } from 'node:fs'

// Range requests, so the player can seek to a chapter.
export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const f = videoFile(app.slug, guide)
  if (!existsSync(f)) throw createError({ statusCode: 404, statusMessage: 'Not filmed yet' })
  const size = statSync(f).size
  setHeader(event, 'Content-Type', 'video/mp4')
  setHeader(event, 'Accept-Ranges', 'bytes')
  setHeader(event, 'Cache-Control', 'no-cache')
  const m = /bytes=(\d*)-(\d*)/.exec(getRequestHeader(event, 'range') ?? '')
  if (!m) {
    setHeader(event, 'Content-Length', size)
    return sendStream(event, createReadStream(f))
  }
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
  if (start >= size || start > end) {
    setResponseStatus(event, 416)
    setHeader(event, 'Content-Range', `bytes */${size}`)
    return ''
  }
  setResponseStatus(event, 206)
  setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`)
  setHeader(event, 'Content-Length', end - start + 1)
  return sendStream(event, createReadStream(f, { start, end }))
})
