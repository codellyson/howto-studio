export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  if (!readPlan(app.slug, guide)) throw createError({ statusCode: 400, statusMessage: 'This video was filmed before looks could change. Record it again first.' })
  return startRender(app.slug, guide)
})
