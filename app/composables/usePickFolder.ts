// Opens the Mac's folder dialog through the studio's server. null when cancelled.
export async function pickFolder(start?: string) {
  const r = await $fetch<{ path: string | null }>('/api/pick-folder', { method: 'POST', body: { start } })
  return r.path
}
