export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const request = String((await readBody<{ request?: string }>(event))?.request ?? '').trim()
  if (!request) throw createError({ statusCode: 400, statusMessage: 'Say what to change' })
  if (request.length > 1000) throw createError({ statusCode: 400, statusMessage: 'Keep it under 1000 characters' })
  return startChange(app, guide, request)
})
