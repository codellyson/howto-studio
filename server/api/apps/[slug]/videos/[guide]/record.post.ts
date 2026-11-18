export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  if (!readScript(app.slug, guide).lines.length) throw createError({ statusCode: 400, statusMessage: 'There is no script to film yet' })
  return startRecord(app, guide)
})
