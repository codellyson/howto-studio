<script setup lang="ts">
import { PhDownloadSimple, PhFolderOpen, PhHeadphones, PhPencilSimple } from '@phosphor-icons/vue'

const { slug, guide, base, data: video, error, frame, lengths, oneWayLines } = useVideo()
const player = ref<HTMLVideoElement>()
const problem = ref('')
const current = ref('')

const recorded = computed(() => video.value?.recorded?.lines ?? [])
const scriptLines = computed(() => (video.value?.lines ?? []).filter(l => recorded.value.some(r => r.id === l.id)))
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const times = computed(() => Object.fromEntries(recorded.value.map(l => [l.id, mmss(l.t)])))
const lastId = computed(() => recorded.value.at(-1)?.id)

function jump(id: string) {
  const l = recorded.value.find(x => x.id === id)
  if (!l || !player.value) return
  current.value = id
  player.value.currentTime = l.t
  player.value.play()
}
function onTime() {
  const t = player.value?.currentTime ?? 0
  current.value = [...recorded.value].reverse().find(l => l.t <= t + 0.05)?.id ?? ''
}

const listened = ref(false)
const storeKey = computed(() => `listened:${slug}/${guide}:${video.value?.recorded?.duration}`)
watch(storeKey, (k) => { try { listened.value = localStorage.getItem(k) === '1' } catch {} }, { immediate: true })
watch(listened, (v) => { try { localStorage.setItem(storeKey.value, v ? '1' : '0') } catch {} })

const saved = ref('')
async function download() {
  problem.value = ''
  try { saved.value = (await $fetch<{ file: string }>(`${base}/download`, { method: 'POST' })).file } catch (e) { problem.value = errorText(e) }
}
async function showInFinder() {
  problem.value = ''
  try { await $fetch(`${base}/reveal`, { method: 'POST' }) } catch (e) { problem.value = errorText(e) }
}
</script>

<template>
  <div class="flex h-screen min-h-[640px] flex-col overflow-hidden">
    <TopBar :crumbs="[{ label: video?.app.name ?? '', to: `/apps/${slug}` }, { label: video?.title ?? '' }]">
      <NuxtLink :to="`/apps/${slug}/v/${guide}`" class="btn btn-secondary"><PhPencilSimple :size="16" />Edit</NuxtLink>
      <button type="button" class="btn btn-secondary" :disabled="!video?.recorded" @click="showInFinder"><PhFolderOpen :size="16" />Show in Finder</button>
      <button type="button" class="btn btn-primary" :disabled="!video?.recorded" @click="download"><PhDownloadSimple :size="16" />Download</button>
    </TopBar>
    <p v-if="error || problem" class="m-0 border-b border-line px-4 py-2 text-rec" role="alert">{{ problem || error }}</p>
    <p v-else-if="saved" class="m-0 border-b border-line px-4 py-2 text-muted" role="status">Saved to Downloads as “{{ saved }}”.</p>
    <p v-else-if="video?.status === 'changed'" class="m-0 border-b border-line px-4 py-2 text-muted">The script changed after filming. This video still shows the old script.</p>

    <div class="flex min-h-0 flex-1">
      <section class="w-[42%] min-w-[380px] max-w-[520px] flex-none overflow-y-auto border-r border-line" aria-label="Chapters">
        <ScriptLines v-if="scriptLines.length" :lines="scriptLines" :selected="current" :times="times" :one-way="oneWayLines" @select="jump" />
      </section>
      <main class="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-6">
        <div v-if="video?.recorded" class="flex w-full max-w-[860px] flex-col gap-3">
          <div class="frame">
            <video
              ref="player" :src="`${base}/video?v=${video.recorded.duration}`" :poster="lastId ? frame(lastId) ?? undefined : undefined"
              controls preload="metadata" class="block aspect-[1440/900] w-full bg-black" @timeupdate="onTime"
            />
          </div>
          <p class="meta m-0 text-center">{{ mmss(video.recorded.duration) }} · {{ recorded.length }} lines · filmed on the live site; saves were answered in the browser, so real data is unchanged</p>
          <FrameStrip :lines="recorded" :src="frame" :lengths="lengths" :selected="current" :times="times" :one-way="oneWayLines" @pick="jump" />
          <label class="mt-1 flex cursor-pointer items-center gap-2 self-center text-[13px] text-muted">
            <input v-model="listened" type="checkbox" class="m-0 size-4 accent-[var(--text)]"><PhHeadphones :size="15" />I've listened to it
          </label>
        </div>
        <p v-else-if="video" class="m-0 text-muted">Not filmed yet. <NuxtLink :to="`/apps/${slug}/v/${guide}`">Back to the script</NuxtLink></p>
      </main>
    </div>
  </div>
</template>
