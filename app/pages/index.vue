<script setup lang="ts">
import { PhGearSix, PhPlus } from '@phosphor-icons/vue'

type Video = { guide: string, title: string, status: string, cover: string | null }
type App = { slug: string, name: string, site: string, videos: Video[] }
const { data: apps, error } = usePoll<App[]>(() => '/api/apps', () => false)

// Home shows each app's first filmed video.
function cover(app: App) {
  const v = app.videos.find(v => v.cover)
  return v ? `/api/apps/${app.slug}/videos/${v.guide}/frame/${v.cover}.jpg` : null
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <TopBar>
      <NuxtLink to="/settings" aria-label="Settings" class="btn btn-plain btn-icon"><PhGearSix :size="20" /></NuxtLink>
    </TopBar>

    <main class="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-6 px-8 py-12 max-sm:px-4">
      <h1 class="m-0 font-serif text-[30px] leading-[1.15] font-medium tracking-[-0.01em]">Your apps</h1>
      <p v-if="error" class="m-0 text-rec" role="alert">{{ error }}</p>

      <div v-if="apps && !apps.length" class="flex flex-col items-start gap-2 border border-ink px-[18px] py-[22px]">
        <p class="m-0 font-serif text-[18px]">No apps yet.</p>
        <span class="text-[13px] text-muted">Connect one: point the studio at its code folder and the site to film.</span>
        <NuxtLink to="/connect" class="btn btn-primary mt-1"><PhPlus :size="16" />Connect an app</NuxtLink>
      </div>

      <section v-else class="grid grid-cols-2 gap-6 max-sm:grid-cols-1">
        <NuxtLink v-for="(app, i) in apps ?? []" :key="app.slug" :to="`/apps/${app.slug}`" class="land flex flex-col gap-3 no-underline" :style="{ animationDelay: `${i * 60}ms` }">
          <img v-if="cover(app)" :src="cover(app)!" alt="" class="frame block aspect-[1440/750] w-full object-cover">
          <span v-else class="frame unfilmed grid aspect-[1440/750] place-items-center text-muted">No videos yet</span>
          <span class="flex items-baseline gap-2.5">
            <span class="font-medium">{{ app.name }}</span>
            <span class="meta">{{ app.videos.length }} {{ app.videos.length === 1 ? 'video' : 'videos' }}</span>
          </span>
        </NuxtLink>
        <NuxtLink v-if="apps?.length" to="/connect" class="flex flex-col gap-3 no-underline">
          <span class="grid aspect-[1440/750] place-items-center border border-dashed border-line-strong text-muted hover:border-ink hover:text-ink">
            <span class="flex flex-col items-center gap-2"><PhPlus :size="20" />Connect an app</span>
          </span>
          <span class="meta">Point it at the code folder and the site.</span>
        </NuxtLink>
      </section>
    </main>
  </div>
</template>
