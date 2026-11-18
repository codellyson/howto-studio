import { createReadStream } from 'node:fs'

export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const id = String(getRouterParam(event, 'id')).replace(/\.jpg$/, '')
  if (!/^L\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'No such line' })
  const f = frameFile(app.slug, guide, id)
  if (!f) throw createError({ statusCode: 404, statusMessage: 'Not filmed yet' })
  setHeader(event, 'Content-Type', 'image/jpeg')
  setHeader(event, 'Cache-Control', 'no-cache')
  return sendStream(event, createReadStream(f))
})
