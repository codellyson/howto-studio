export default defineEventHandler((event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  return { ...app, say: readSay(app.slug), videos: listVideos(app.slug), job: jobs.get(key(app.slug)) ?? null }
})
