// Keeps one script-check flag: the person decided the line is right as it is.
export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const flag = String((await readBody<{ flag?: string }>(event))?.flag ?? '').trim()
  if (!/^(L\d+|video): .{1,300}$/.test(flag)) throw createError({ statusCode: 400, statusMessage: 'Not a flag' })
  keepFlag(app.slug, guide, flag)
  return scriptChecks(app.slug, guide, readScript(app.slug, guide).lines)
})
