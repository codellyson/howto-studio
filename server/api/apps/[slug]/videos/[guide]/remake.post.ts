// Films the saved take again with the current voice and pronunciations. No agent.
export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  if (!takeSaved(app.slug, guide) || !readRecorded(app.slug, guide)) throw createError({ statusCode: 400, statusMessage: 'This video has no saved take yet. Record it first.' })
  return startRemake(app, guide)
})
