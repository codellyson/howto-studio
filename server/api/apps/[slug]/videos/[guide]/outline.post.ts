// The person picks one of the offered outlines, maybe with its steps edited, and the script is written from it.
export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const guide = guideOr404(app, getRouterParam(event, 'guide'))
  const body = await readBody<{ angle?: number, steps?: string[] }>(event)
  const o = readOutline(app.slug, guide)
  const angle = o?.angles[Number(body?.angle)]
  if (!o || !angle) throw createError({ statusCode: 400, statusMessage: 'Pick one of the outlines' })
  const steps = (Array.isArray(body?.steps) ? body.steps : angle.steps).map(s => String(s).trim().slice(0, 200)).filter(Boolean)
  if (steps.length < 2 || steps.length > 15) throw createError({ statusCode: 400, statusMessage: 'An outline needs 2 to 15 steps' })
  if (readScript(app.slug, guide).lines.length) throw createError({ statusCode: 400, statusMessage: 'This video already has a script. Ask for a change instead.' })
  if (busy(key(app.slug))) throw createError({ statusCode: 409, statusMessage: 'The code is still being read. Try again in a moment.' })
  o.chosen = { ...angle, steps }
  writeOutline(app.slug, guide, o)
  return startScript(readApp(app.slug), guide, outlineTask(o))
})
