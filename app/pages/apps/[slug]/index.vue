<script setup lang="ts">
import { PhCheck, PhCircleNotch, PhClock, PhGearSix, PhWarningCircle } from '@phosphor-icons/vue'

type Video = { guide: string, title: string, status: string, duration: number | null, cover: string | null }
type App = { slug: string, name: string, summary?: object, videos: Video[], job: { state: string } | null }

const slug = String(useRoute().params.slug)
const { data: app, error } = usePoll<App>(() => `/api/apps/${slug}`, a => !!a && (a.job?.state === 'working' || a.videos.some(v => v.status === 'writing' || v.status === 'planning' || v.status === 'preparing' || v.status === 'recording' || v.status === 'rendering')), 2000)
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

// Import a script written elsewhere: a skill table, or plain lines that become the voice.
const importing = ref(false)
const importName = ref('')
const importText = ref('')
async function readFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  importText.value = await file.text()
  if (!importName.value) importName.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
}
async function importScript() {
  sending.value = true
  problem.value = ''
  try {
    const r = await $fetch<{ guide: string }>(`/api/apps/${slug}/videos/import`, { method: 'POST', body: { text: importText.value, name: importName.value } })
    await navigateTo(`/apps/${slug}/v/${r.guide}`)
  } catch (e) { problem.value = errorText(e) } finally { sending.value = false }
}

const LABEL: Record<string, string> = { done: 'Up to date', changed: 'Script changed', draft: 'Not filmed yet', planning: 'Drafting outlines', preparing: 'Preparing demo data', outline: 'Pick an outline', writing: 'Writing the script', recording: 'Recording', rendering: 'Making it again', failed: 'Could not write the script' }
const link = (v: Video) => v.status === 'done' ? `/apps/${slug}/v/${v.guide}/review` : v.status === 'recording' ? `/apps/${slug}/v/${v.guide}/record` : `/apps/${slug}/v/${v.guide}`
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <TopBar :crumbs="[{ label: 'Your apps', to: '/' }, { label: app?.name ?? '' }]">
      <NuxtLink :to="`/settings?app=${slug}`" aria-label="Settings" class="btn btn-plain btn-icon"><PhGearSix :size="20" /></NuxtLink>
    </TopBar>

    <main class="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-8 px-8 pt-10 pb-12 max-sm:px-4">
      <p v-if="error" class="m-0 text-rec" role="alert">{{ error }}</p>
      <section v-if="app" class="flex flex-col items-center gap-3">
        <h1 class="m-0 text-center font-serif text-[30px] leading-[1.15] font-medium tracking-[-0.01em]">What should {{ app.name }} users learn next?</h1>
        <p v-if="app.job?.state === 'working'" class="m-0 text-muted">The code is still being read. <NuxtLink :to="`/connect?app=${slug}`">Watch</NuxtLink></p>
        <form class="flex w-full max-w-[720px] gap-2" @submit.prevent="start">
          <label for="task" class="sr-only">Describe the next video</label>
          <input id="task" v-model="task" required minlength="4" maxlength="500" placeholder="e.g. How a photographer shares an album for review" class="field min-w-0 flex-1">
          <button :disabled="sending || app.job?.state === 'working'" class="btn btn-primary">{{ sending ? 'Starting' : 'Write script' }}</button>
        </form>
        <button v-if="!importing" type="button" class="btn btn-plain h-7 text-[13px] text-muted" @click="importing = true">Or import a script you already have</button>
        <form v-else class="flex w-full max-w-[720px] flex-col gap-2 border border-line p-4" @submit.prevent="importScript">
          <div class="flex items-center justify-between gap-3">
            <label for="import-text" class="font-medium">Import a script</label>
            <label class="btn btn-secondary h-7 cursor-pointer text-[13px]">Choose file…<input type="file" accept=".md,.txt,text/plain,text/markdown" class="sr-only" @change="readFile"></label>
          </div>
          <p class="meta m-0">Paste one voice line per step, and the agent works out what happens on screen from the code. A skill script table (rows like "| L01 | On screen | Voice |") is used as it is.</p>
          <input v-model="importName" maxlength="120" placeholder="Name, e.g. Approve an album" aria-label="Video name" class="field">
          <textarea id="import-text" v-model="importText" required rows="8" maxlength="20000" placeholder="Click New to ask for something.&#10;Write what you need in your own words.&#10;…" class="field h-auto resize-y py-2 leading-[1.5]" />
          <div class="flex gap-2">
            <button :disabled="sending || !importText.trim()" class="btn btn-primary">{{ sending ? 'Importing' : 'Import' }}</button>
            <button type="button" class="btn btn-plain" @click="importing = false">Cancel</button>
          </div>
        </form>
        <p v-if="problem" class="m-0 text-rec" role="alert">{{ problem }}</p>
      </section>

      <div v-if="app && !app.videos.length" class="mx-auto flex w-full max-w-[720px] flex-col items-start gap-2 border border-ink px-[18px] py-[22px]">
        <p class="m-0 font-serif text-[18px]">No videos yet.</p>
        <span class="text-[13px] text-muted">Describe one task above and a script is written from the code.</span>
      </div>

      <section v-else-if="app" class="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <NuxtLink v-for="(v, i) in app.videos" :key="v.guide" :to="link(v)" class="land flex flex-col gap-2.5 no-underline" :style="{ animationDelay: `${i * 60}ms` }">
          <img v-if="v.cover" :src="`/api/apps/${slug}/videos/${v.guide}/frame/${v.cover}.jpg`" alt="" class="frame block aspect-[1440/750] w-full object-cover">
          <span v-else class="frame unfilmed grid aspect-[1440/750] place-items-center text-muted">{{ LABEL[v.status] }}</span>
          <span class="flex items-center gap-2">
            <span class="min-w-0 flex-1 truncate font-medium">{{ v.title }}</span>
            <span class="meta inline-flex flex-none items-center gap-1.5 whitespace-nowrap" :class="{ 'text-rec': v.status === 'failed' }" :aria-label="LABEL[v.status]">
              <PhCheck v-if="v.status === 'done'" :size="15" />
              <PhClock v-else-if="v.status === 'changed' || v.status === 'outline'" :size="15" />
              <PhCircleNotch v-else-if="v.status === 'writing' || v.status === 'planning' || v.status === 'preparing' || v.status === 'rendering'" :size="15" class="spin" />
              <span v-else-if="v.status === 'recording'" class="rec-dot pulse" />
              <PhWarningCircle v-else-if="v.status === 'failed'" :size="15" />
              {{ v.status === 'done' && v.duration ? mmss(v.duration) : LABEL[v.status] }}
            </span>
          </span>
        </NuxtLink>
      </section>
    </main>
  </div>
</template>
