export default defineEventHandler(() => listApps().map(app => ({
  slug: app.slug,
  name: app.name,
  site: app.site,
  videos: listVideos(app.slug),
  job: jobs.get(key(app.slug)) ?? null,
})))
