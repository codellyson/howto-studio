<script setup lang="ts">
const { slug, guide, base, data: video, error, frame, lengths } = useVideo()
const player = ref<HTMLVideoElement>()
const problem = ref('')
const current = ref('')

const lines = computed(() => video.value?.recorded?.lines ?? [])
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const times = computed(() => Object.fromEntries(lines.value.map(l => [l.id, mmss(l.t)])))
const lastId = computed(() => lines.value.at(-1)?.id)

function jump(id: string) {
  const l = lines.value.find(x => x.id === id)
  if (!l || !player.value) return
  player.value.currentTime = l.t
  player.value.play()
}
function onTime() {
  const t = player.value?.currentTime ?? 0
  current.value = [...lines.value].reverse().find(l => l.t <= t + 0.05)?.id ?? ''
}

const listened = ref(false)
const storeKey = computed(() => `listened:${slug}/${guide}:${video.value?.recorded?.duration}`)
watch(storeKey, (k) => { try { listened.value = localStorage.getItem(k) === '1' } catch {} }, { immediate: true })
watch(listened, (v) => { try { localStorage.setItem(storeKey.value, v ? '1' : '0') } catch {} })

async function exportVideo() {
  problem.value = ''
  try { await $fetch(`${base}/reveal`, { method: 'POST' }) } catch (e) { problem.value = errorText(e) }
}
</script>

<template>
  <div class="flex h-screen min-h-[640px] flex-col overflow-hidden">
    <TopBar :crumbs="[{ label: video?.app.name ?? '', to: `/apps/${slug}` }, { label: video?.title ?? '' }]">
      <NuxtLink :to="`/apps/${slug}/v/${guide}`" class="inline-flex h-8 items-center rounded-lg border border-edge px-3.5 font-medium text-fg no-underline">Edit</NuxtLink>
      <button :disabled="!video?.recorded" class="h-8 rounded-lg border-0 bg-fg px-3.5 font-semibold text-ink disabled:opacity-50" @click="exportVideo">Show MP4 in Finder</button>
    </TopBar>

    <main class="flex min-h-0 flex-1 flex-col items-center justify-center gap-[18px] px-10 pt-1 max-sm:px-4">
      <p v-if="error" class="m-0 text-rec">{{ error }}</p>
      <template v-if="video?.recorded">
        <video
          ref="player" :src="`${base}/video?v=${video.recorded.duration}`" :poster="lastId ? frame(lastId) ?? undefined : undefined" controls preload="metadata"
          class="block aspect-[1440/900] max-h-[calc(100vh-280px)] w-full max-w-[860px] rounded-[10px] bg-black shadow-[0_0_0_1px_rgba(255,255,255,.06),0_30px_60px_-10px_rgba(0,0,0,.7)]"
          @timeupdate="onTime"
        />
        <p class="m-0 text-muted">{{ mmss(video.recorded.duration) }} · filmed on the live site · saves answered in the browser<template v-if="video.status === 'changed'"> · <span class="text-fg">script changed since</span></template></p>
        <label class="flex items-center gap-2 text-[13px] text-faint">
          <input v-model="listened" type="checkbox" class="m-0 size-[15px]">I've listened to it
        </label>
        <p v-if="problem" class="m-0 text-rec">{{ problem }}</p>
      </template>
      <p v-else-if="video" class="m-0 text-muted">Not filmed yet. <NuxtLink :to="`/apps/${slug}/v/${guide}`" class="text-fg">Back to the script</NuxtLink></p>
    </main>

    <FrameStrip v-if="lines.length" :lines="lines" :src="frame" :lengths="lengths" :selected="current" :times="times" mode="chapters" @pick="jump" />
  </div>
</template>
