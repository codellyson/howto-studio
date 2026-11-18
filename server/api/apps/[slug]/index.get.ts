export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  return { ...app, videos: listVideos(app.slug), job: jobs.get(key(app.slug)) ?? null }
})
