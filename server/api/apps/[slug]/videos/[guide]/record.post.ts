// Films the video, or only from one line on ({ from: 'L07' }), keeping the lines before it as they were filmed.
export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const { lines } = readScript(app.slug, guide)
  if (!lines.length) throw createError({ statusCode: 400, statusMessage: 'There is no script to film yet' })
  const from = String((await readBody<{ from?: string }>(event).catch(() => null))?.from ?? '')
  if (from) {
    if (!lines.some(l => l.id === from)) throw createError({ statusCode: 400, statusMessage: 'No such line' })
    if (!readPlan(app.slug, guide)) throw createError({ statusCode: 400, statusMessage: 'This video was filmed before parts could be filmed again. Record it all once.' })
  }
  return startRecord(app, guide, from || undefined)
})
