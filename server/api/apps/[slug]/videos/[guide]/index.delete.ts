export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  if (busy(key(app.slug, guide))) throw createError({ statusCode: 409, statusMessage: 'Stop the current work first' })
  removeVideo(app.slug, guide)
  return { ok: true }
})
