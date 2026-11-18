<script setup lang="ts">
type Video = { guide: string, title: string, status: string, duration: number | null, cover: string | null }
type App = { slug: string, name: string, summary?: object, videos: Video[], job: { state: string } | null }

const slug = String(useRoute().params.slug)
const { data: app, error } = usePoll<App>(() => `/api/apps/${slug}`, a => !!a && (a.job?.state === 'working' || a.videos.some(v => v.status === 'writing' || v.status === 'recording')), 2000)
const task = ref('')
const sending = ref(false)
const problem = ref('')

async function start() {
  sending.value = true
  problem.value = ''
  try {
    const r = await $fetch<{ guide: string }>(`/api/apps/${slug}/videos`, { method: 'POST', body: { task: task.value } })
    await navigateTo(`/apps/${slug}/v/${r.guide}`)
  } catch (e) { problem.value = errorText(e) } finally { sending.value = false }
}

const STATUS: Record<string, string> = { done: 'Up to date', changed: 'Script changed since filming', draft: 'Not filmed yet', writing: 'Writing the script…', recording: 'Filming…', failed: 'Could not write the script' }
const link = (v: Video) => v.status === 'done' ? `/apps/${slug}/v/${v.guide}/review` : v.status === 'recording' ? `/apps/${slug}/v/${v.guide}/record` : `/apps/${slug}/v/${v.guide}`
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <TopBar :crumbs="[{ label: 'Your apps', to: '/' }, { label: app?.name ?? '' }]">
      <NuxtLink :to="`/settings?app=${slug}`" class="text-muted no-underline hover:text-fg">Settings</NuxtLink>
    </TopBar>

    <main class="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-[30px] px-10 pt-9 pb-10 max-sm:px-4">
      <p v-if="error" class="m-0 text-rec">{{ error }}</p>
      <section v-if="app" class="flex flex-col items-center gap-3.5 pt-2 pb-1">
        <h1 class="m-0 text-center text-[30px] font-semibold tracking-[-0.02em]">What should {{ app.name }} users learn next?</h1>
        <p v-if="app.job?.state === 'working'" class="m-0 text-muted">Still reading the code. <NuxtLink :to="`/connect?app=${slug}`" class="text-fg">Watch</NuxtLink></p>
        <form class="flex w-full max-w-[720px] items-center gap-2 rounded-[14px] bg-[#17171B] py-1.5 pr-1.5 pl-4 shadow-[0_0_0_1px_#2A2A30,0_20px_40px_-12px_rgba(0,0,0,.6)]" @submit.prevent="start">
          <label for="task" class="sr-only">Describe the next video</label>
          <input id="task" v-model="task" required minlength="4" maxlength="500" placeholder="e.g. How a photographer shares an album for review" class="h-10 min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-fg outline-none placeholder:text-dim">
          <button :disabled="sending || app.job?.state === 'working'" class="h-10 rounded-[10px] border-0 bg-fg px-4 font-semibold text-ink disabled:opacity-50">{{ sending ? 'Starting…' : 'Write script' }}</button>
        </form>
        <p v-if="problem" class="m-0 text-rec">{{ problem }}</p>
      </section>

      <section v-if="app?.videos.length" class="grid grid-cols-3 gap-[22px] max-lg:grid-cols-2 max-sm:grid-cols-1">
        <NuxtLink v-for="v in app.videos" :key="v.guide" :to="link(v)" class="flex flex-col gap-3 no-underline">
          <span v-if="v.cover" class="relative block rounded-[14px] bg-gradient-to-b from-[#2A2A2F] to-[#1C1C20] p-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_24px_48px_-18px_rgba(0,0,0,.8)]">
            <img :src="`/api/apps/${slug}/videos/${v.guide}/frame/${v.cover}.jpg`" alt="" class="block aspect-[16/10] w-full rounded-lg object-cover shadow-[0_14px_30px_rgba(0,0,0,.45)]">
            <span v-if="v.duration" class="absolute right-[30px] bottom-[30px] rounded-[5px] bg-black/75 px-[7px] py-0.5 text-[11.5px] font-semibold text-fg">{{ mmss(v.duration) }}</span>
          </span>
          <span v-else class="block rounded-[14px] bg-[#141418] p-[22px] shadow-[inset_0_0_0_1.5px_#2A2A30]">
            <span class="grid aspect-[16/10] place-items-center rounded-lg bg-[repeating-linear-gradient(135deg,#17171C_0_10px,#1B1B21_10px_20px)] text-muted shadow-[inset_0_0_0_1px_#26262D]">{{ STATUS[v.status] }}</span>
          </span>
          <span class="text-[14.5px] font-semibold text-fg">{{ v.title }}</span>
          <span class="-mt-1.5 text-[12.5px]" :class="v.status === 'failed' ? 'text-rec' : 'text-muted'">{{ STATUS[v.status] }}</span>
        </NuxtLink>
      </section>
    </main>
  </div>
</template>
