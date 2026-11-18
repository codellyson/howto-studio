export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  startConnect(app)
  return { ok: true }
})
