export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  if ([...jobs.entries()].some(([k, j]) => k.startsWith(`${app.slug}/`) && j.state === 'working')) throw createError({ statusCode: 409, statusMessage: 'Wait for the current work to finish' })
  removeApp(app.slug)
  return { ok: true }
})
