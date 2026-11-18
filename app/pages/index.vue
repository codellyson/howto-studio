<script setup lang="ts">
type Video = { guide: string, title: string, status: string, cover: string | null }
type App = { slug: string, name: string, site: string, videos: Video[] }
const { data: apps, error } = usePoll<App[]>(() => '/api/apps', () => false)

function cover(app: App) {
  const v = app.videos.find(v => v.cover)
  return v ? `/api/apps/${app.slug}/videos/${v.guide}/frame/${v.cover}.jpg` : null
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <TopBar>
      <NuxtLink to="/settings" aria-label="Settings" class="grid size-[34px] place-items-center rounded-lg text-muted hover:bg-raise hover:text-fg">
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
      </NuxtLink>
    </TopBar>

    <main class="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-7 px-10 py-[72px] max-sm:px-4">
      <h1 class="m-0 text-[28px] font-semibold tracking-[-0.02em]">Your apps</h1>
      <p v-if="error" class="m-0 text-rec">{{ error }}</p>
      <section class="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
        <NuxtLink v-for="app in apps ?? []" :key="app.slug" :to="`/apps/${app.slug}`" class="flex flex-col gap-3.5 no-underline">
          <span class="block rounded-[14px] bg-gradient-to-b from-[#2A2A2F] to-[#1C1C20] p-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_24px_48px_-18px_rgba(0,0,0,.8)]">
            <img v-if="cover(app)" :src="cover(app)!" alt="" class="block aspect-[16/10] w-full rounded-lg object-cover shadow-[0_14px_30px_rgba(0,0,0,.45)]">
            <span v-else class="grid aspect-[16/10] place-items-center rounded-lg bg-[#17171B] text-muted">No videos yet</span>
          </span>
          <span class="flex items-baseline gap-2.5">
            <span class="text-[15px] font-semibold text-fg">{{ app.name }}</span>
            <span class="text-muted">{{ app.videos.length }} {{ app.videos.length === 1 ? 'video' : 'videos' }}</span>
          </span>
        </NuxtLink>
        <NuxtLink to="/connect" class="flex flex-col gap-3.5 no-underline">
          <span class="block rounded-[14px] p-[22px] shadow-[inset_0_0_0_1.5px_#26262C] hover:shadow-[inset_0_0_0_1.5px_#3A3A42]">
            <span class="grid aspect-[16/10] place-items-center text-muted">
              <span class="flex flex-col items-center gap-2.5">
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Connect an app
              </span>
            </span>
          </span>
          <span class="text-muted">Point it at the code and the site.</span>
        </NuxtLink>
      </section>
    </main>
  </div>
</template>
