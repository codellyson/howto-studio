<script setup lang="ts">
import { PhArrowClockwise, PhChatCircle, PhPlay } from '@phosphor-icons/vue'
import type { Pin } from '~/components/PinsEditor.vue'

const { slug, guide, base, data: video, error, load, frame, lengths, oneWayLines } = useVideo()
const selected = ref('')
const ask = ref('')
const problem = ref('')
const showNotes = ref(false)
const confirmRecord = ref(false)
const tab = ref<'script' | 'look'>('script')
const view = computed(() => video.value?.overlay)
useHead(() => ({ style: view.value?.css ? [{ key: 'overlay-css', innerHTML: view.value.css }] : [] }))

async function saveLook(look: object, scope: 'app' | 'video') {
  problem.value = ''
  try {
    const o = await $fetch<Overlay>(`${base}/look`, { method: 'PUT', body: { look, scope } })
    if (video.value) video.value.overlay = o
  } catch (e) { problem.value = errorText(e) }
}
async function savePins(pins: Pin[]) {
  problem.value = ''
  try {
    const o = await $fetch<Overlay>(`${base}/pins`, { method: 'PUT', body: { pins } })
    if (video.value) video.value.overlay = o
  } catch (e) { problem.value = errorText(e) }
}
async function restyle() {
  problem.value = ''
  try {
    await $fetch(`${base}/restyle`, { method: 'POST' })
    load()
  } catch (e) { problem.value = errorText(e) }
}

watch(video, (v) => { if (v?.lines.length && !v.lines.some(l => l.id === selected.value)) selected.value = v.lines[0]!.id })
const line = computed(() => video.value?.lines.find(l => l.id === selected.value))
const working = computed(() => video.value?.job?.state === 'working')

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

// A script run that failed can be started again, from the saved request or an edited one.
const retryTask = ref('')
watch(video, (v) => { if (v && !retryTask.value) retryTask.value = v.task }, { immediate: true })
async function retry() {
  problem.value = ''
  try {
    await $fetch(`${base}/retry`, { method: 'POST', body: { task: retryTask.value } })
    load()
  } catch (e) { problem.value = errorText(e) }
}

const redo = ref(false)
const picking = computed(() => !working.value && !redo.value && !!video.value?.outline && !video.value.outline.chosen && video.value.job?.state !== 'error')
async function choose(angle: number, steps: string[]) {
  problem.value = ''
  try {
    await $fetch(`${base}/outline`, { method: 'POST', body: { angle, steps } })
    load()
  } catch (e) { problem.value = errorText(e) }
}
async function retryAndClose() {
  await retry()
  if (!problem.value) redo.value = false
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

    <p v-if="error || problem || (video?.job?.state === 'error' && video.lines.length)" class="m-0 border-b border-line px-4 py-2 text-rec" role="alert">{{ problem || error || video?.job?.error }}</p>
    <p v-else-if="video?.status === 'changed'" class="m-0 border-b border-line px-4 py-2 text-muted">The script changed after filming. Record again to update the video.</p>
    <div v-else-if="working && video?.job && video.lines.length" class="border-b border-line px-4 py-2"><JobProgress compact :job="video.job" /></div>
    <p v-else-if="view?.stale" class="m-0 flex items-center gap-3 border-b border-line px-4 py-2 text-muted">The look or marks changed. The video still has the old ones.<button type="button" class="btn btn-secondary h-7" @click="restyle">Make the video again</button></p>

    <div class="flex min-h-0 flex-1">
      <section class="w-[42%] min-w-[380px] max-w-[520px] flex-none overflow-y-auto border-r border-line" :aria-label="tab === 'look' ? 'Look' : 'Script'">
        <div v-if="video?.lines.length" class="mx-4 mt-3 flex gap-6 border-b border-line" role="tablist">
          <button
            v-for="t in (['script', 'look'] as const)" :key="t" type="button" role="tab" :aria-selected="tab === t"
            class="cursor-pointer border-0 bg-transparent px-0 pb-2.5 font-medium" :class="tab === t ? 'text-ink shadow-[inset_0_-2px_0_var(--text)]' : 'text-muted hover:text-ink'"
            @click="tab = t"
          >{{ t === 'script' ? 'Script' : 'Look' }}</button>
        </div>
        <template v-if="tab === 'look' && video?.lines.length">
          <p v-if="!video.recorded" class="m-0 p-4 text-muted">Record the video first. Then you can change how captions and the cursor look.</p>
          <p v-else-if="!view?.restyle" class="m-0 p-4 text-muted">This video was filmed before looks could change. Record it again to change its look.</p>
          <LookPanel
            v-else :look="view.look" :scope="view.scope" :choices="view.choices" :backgrounds="view.backgrounds" :app-name="video.app.name" :busy="working" :stale="view.stale"
            @change="saveLook" @render="restyle"
          />
        </template>
        <div v-if="video && !video.lines.length" class="flex flex-col gap-2 p-4" aria-live="polite">
          <OutlinePicker v-if="picking" :outline="video.outline!" :busy="working" @choose="choose" @redo="redo = true" />
          <JobProgress v-else-if="video.job && !redo" :job="video.job" />
          <p v-else-if="!redo" class="m-0 font-medium">No script yet</p>
          <form v-if="!working && (video.job?.state === 'error' || redo)" class="mt-4 flex flex-col gap-2" @submit.prevent="retryAndClose">
            <label for="retry-task" class="font-medium">What the video should show</label>
            <textarea id="retry-task" v-model="retryTask" rows="3" maxlength="500" required class="field h-auto resize-none py-2 leading-[1.4]" />
            <div class="flex gap-2">
              <button class="btn btn-primary"><PhArrowClockwise :size="16" />{{ redo || !video.outline?.chosen || retryTask !== video.outline?.task ? 'Draft outlines again' : 'Write the script again' }}</button>
              <button v-if="redo" type="button" class="btn btn-plain" @click="redo = false">Back to the outlines</button>
            </div>
          </form>
        </div>
        <template v-else-if="video && tab === 'script'">
          <ScriptLines :lines="video.lines" :selected="selected" :one-way="oneWayLines" :editable="!working" @select="selected = $event" @save="saveLine">
            <template v-if="view?.restyle" #selected="{ id }">
              <PinsEditor :line="id" :targets="view.lines[id]?.targets ?? []" :pins="view.pins" :disabled="working" @save="savePins" />
            </template>
          </ScriptLines>
        </template>
      </section>

      <main class="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-6">
        <div class="flex w-full max-w-[860px] flex-col gap-3">
          <StageFrame :src="line ? frame(line.id) : null" :subtitle="view?.restyle ? undefined : line?.voice" :full="view?.restyle" :on-screen="line?.screen" :alt="line ? `Shot ${line.id.replace(/^L/, '')}` : ''">
            <OverlayLayer
              v-if="view?.restyle && line && view.lines[line.id] && view.size" :html="view.lines[line.id]!.html" :size="view.size" :color="view.look.cursor.color ?? '#1E97F1'"
            />
          </StageFrame>
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
