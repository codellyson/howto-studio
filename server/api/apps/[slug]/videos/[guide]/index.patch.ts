export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const { title } = await readBody<{ title?: string }>(event)
  if (!readScript(app.slug, guide).lines.length) throw createError({ statusCode: 400, statusMessage: 'Name it once the script is written' })
  setTitle(app.slug, guide, String(title ?? ''))
  return { title: readScript(app.slug, guide).title }
})
