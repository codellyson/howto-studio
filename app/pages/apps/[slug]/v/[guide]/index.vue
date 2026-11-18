<script setup lang="ts">
import { PhChatCircle, PhCircleNotch, PhPlay } from '@phosphor-icons/vue'

const { slug, guide, base, data: video, error, load, frame, lengths, oneWayLines } = useVideo()
const selected = ref('')
const ask = ref('')
const problem = ref('')
const showNotes = ref(false)
const confirmRecord = ref(false)

watch(video, (v) => { if (v?.lines.length && !v.lines.some(l => l.id === selected.value)) selected.value = v.lines[0]!.id })
const line = computed(() => video.value?.lines.find(l => l.id === selected.value))
const working = computed(() => video.value?.job?.state === 'working')
const steps = computed(() => video.value?.job?.steps.slice(-6) ?? [])

function move(by: number) {
  const lines = video.value?.lines ?? []
  const next = lines[lines.findIndex(l => l.id === selected.value) + by]
  if (next) selected.value = next.id
}
function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement).closest('input, textarea, select, dialog')) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); move(1) }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); move(-1) }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

async function saveLine(id: string, voice: string) {
  problem.value = ''
  try {
    const r = await $fetch<{ lines: Line[] }>(`${base}/lines/${id}`, { method: 'PATCH', body: { voice } })
    if (video.value) video.value.lines = r.lines
    load()
  } catch (e) { problem.value = errorText(e) }
}

async function sendAsk() {
  if (!ask.value.trim()) return
  problem.value = ''
  try {
    await $fetch(`${base}/ask`, { method: 'POST', body: { request: ask.value } })
    ask.value = ''
    load()
  } catch (e) { problem.value = errorText(e) }
}

async function record() {
  confirmRecord.value = false
  problem.value = ''
  try {
    await $fetch(`${base}/record`, { method: 'POST' })
    await navigateTo(`/apps/${slug}/v/${guide}/record`)
  } catch (e) { problem.value = errorText(e) }
}

const shotMeta = computed(() => {
  if (!line.value) return ''
  const len = lengths.value[line.value.id]
  return `SHOT ${line.value.id.replace(/^L/, '')}${len ? ` · ${len.toFixed(1)} s` : ''}`
})
</script>

<template>
  <div class="flex h-screen min-h-[640px] flex-col overflow-hidden">
    <TopBar :crumbs="[{ label: video?.app.name ?? '', to: `/apps/${slug}` }, { label: video?.title ?? '' }]">
      <form v-if="video?.lines.length" class="relative max-lg:hidden" @submit.prevent="sendAsk">
        <label for="ask" class="sr-only">Ask for a change</label>
        <PhChatCircle :size="16" class="pointer-events-none absolute top-2 left-3 text-muted" />
        <input id="ask" v-model="ask" :disabled="working" placeholder="Ask for a change…" class="field w-[280px] pl-9 disabled:opacity-40">
      </form>
      <button v-if="video?.notes" type="button" class="btn btn-plain" :aria-expanded="showNotes" @click="showNotes = !showNotes">Notes</button>
      <NuxtLink v-if="video?.recorded" :to="`/apps/${slug}/v/${guide}/review`" class="btn btn-secondary"><PhPlay :size="16" />Watch</NuxtLink>
      <button type="button" class="btn btn-primary" :disabled="working || !video?.lines.length" @click="video?.recorded ? (confirmRecord = true) : record()">
        <span class="rec-dot" />{{ video?.recorded ? 'Record again' : 'Record' }}
      </button>
    </TopBar>

    <p v-if="error || problem || video?.job?.state === 'error'" class="m-0 border-b border-line px-4 py-2 text-rec" role="alert">{{ problem || error || video?.job?.error }}</p>
    <p v-else-if="video?.status === 'changed'" class="m-0 border-b border-line px-4 py-2 text-muted">The script changed after filming. Record again to update the video.</p>

    <div class="flex min-h-0 flex-1">
      <section class="w-[42%] min-w-[380px] max-w-[520px] flex-none overflow-y-auto border-r border-line" aria-label="Script">
        <div v-if="video && !video.lines.length" class="flex flex-col gap-2 p-4" aria-live="polite">
          <p class="m-0 flex items-center gap-2 font-medium"><PhCircleNotch v-if="working" :size="16" class="spin" />{{ working ? 'Writing the script' : 'No script yet' }}</p>
          <p v-for="(s, i) in steps" :key="i" class="m-0" :class="i === steps.length - 1 ? 'text-ink' : 'text-muted'">{{ s }}</p>
        </div>
        <template v-else-if="video">
          <p v-if="working" class="m-0 flex items-center gap-2 px-4 pt-4 text-muted" aria-live="polite"><PhCircleNotch :size="15" class="spin" />{{ steps.at(-1) ?? 'Working' }}</p>
          <ScriptLines :lines="video.lines" :selected="selected" :one-way="oneWayLines" :editable="!working" @select="selected = $event" @save="saveLine" />
        </template>
      </section>

      <main class="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-6">
        <div class="flex w-full max-w-[860px] flex-col gap-3">
          <StageFrame :src="line ? frame(line.id) : null" :subtitle="line?.voice" :on-screen="line?.screen" :alt="line ? `Shot ${line.id.replace(/^L/, '')}` : ''" />
          <p v-if="line" class="meta m-0 text-center">{{ shotMeta }}<template v-if="oneWayLines.includes(line.id)"> · <span class="text-oneway">can't be undone</span></template></p>
          <FrameStrip v-if="video?.lines.length" :lines="video.lines" :src="frame" :lengths="lengths" :selected="selected" :one-way="oneWayLines" @pick="selected = $event" />
        </div>
      </main>
    </div>

    <aside v-if="showNotes && video?.notes" class="land fixed top-[60px] right-4 z-10 max-h-[70vh] w-[420px] overflow-auto border border-ink bg-page p-4 text-[13px] whitespace-pre-wrap" aria-label="Notes from reading the code">{{ video.notes }}</aside>

    <ConfirmDialog
      :open="confirmRecord" title="Record this video again?" body="The current video is replaced when the new one is done."
      action="Record again" @confirm="record" @cancel="confirmRecord = false"
    />
  </div>
</template>
