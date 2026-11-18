export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  return jobs.get(key(app.slug, 'signin')) ?? null
})
