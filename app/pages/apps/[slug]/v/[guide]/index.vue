<script setup lang="ts">
const { slug, guide, base, data: video, error, load, frame, lengths, oneWayLines } = useVideo()
const selected = ref('')
const editing = ref(false)
const draft = ref('')
const ask = ref('')
const problem = ref('')
const showNotes = ref(false)

watch(video, (v) => { if (v?.lines.length && !v.lines.some(l => l.id === selected.value)) selected.value = v.lines[0]!.id })
const line = computed(() => video.value?.lines.find(l => l.id === selected.value))
const index = computed(() => video.value?.lines.findIndex(l => l.id === selected.value) ?? -1)
const working = computed(() => video.value?.job?.state === 'working')
const steps = computed(() => video.value?.job?.steps.slice(-5) ?? [])

function move(by: number) {
  const lines = video.value?.lines ?? []
  const next = lines[index.value + by]
  if (next) selected.value = next.id
}
function onKey(e: KeyboardEvent) {
  if (editing.value || (e.target as HTMLElement).closest('input, textarea, select')) return
  if (e.key === 'ArrowRight') move(1)
  if (e.key === 'ArrowLeft') move(-1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function edit() {
  if (working.value || !line.value) return
  draft.value = line.value.voice
  editing.value = true
  nextTick(() => (document.getElementById('line-text') as HTMLTextAreaElement | null)?.focus())
}
async function saveLine() {
  if (!editing.value || !line.value) return
  editing.value = false
  if (draft.value.trim() === line.value.voice) return
  problem.value = ''
  try {
    const r = await $fetch<{ lines: Line[] }>(`${base}/lines/${line.value.id}`, { method: 'PATCH', body: { voice: draft.value } })
    if (video.value) video.value.lines = r.lines
    load()
  } catch (e) { problem.value = errorText(e) }
}

async function sendAsk() {
  problem.value = ''
  try {
    await $fetch(`${base}/ask`, { method: 'POST', body: { request: ask.value } })
    ask.value = ''
    load()
  } catch (e) { problem.value = errorText(e) }
}

async function record() {
  problem.value = ''
  try {
    await $fetch(`${base}/record`, { method: 'POST' })
    await navigateTo(`/apps/${slug}/v/${guide}/record`)
  } catch (e) { problem.value = errorText(e) }
}

const len = computed(() => line.value && lengths.value[line.value.id] ? `${lengths.value[line.value.id]!.toFixed(1)} s` : '')
</script>

<template>
  <div class="flex h-screen min-h-[640px] flex-col overflow-hidden">
    <TopBar :crumbs="[{ label: video?.app.name ?? '', to: `/apps/${slug}` }, { label: video?.title ?? '' }]">
      <form v-if="video?.lines.length" class="max-md:hidden" @submit.prevent="sendAsk">
        <label for="ask" class="sr-only">Ask for a change</label>
        <input id="ask" v-model="ask" :disabled="working" placeholder="Ask for a change…" class="h-8 w-[280px] rounded-lg border border-[#26262C] bg-field px-3 text-fg placeholder:text-dim disabled:opacity-50">
      </form>
      <button v-if="video?.notes" class="h-8 rounded-lg border-0 bg-transparent px-2.5 text-muted hover:text-fg" :aria-expanded="showNotes" @click="showNotes = !showNotes">Notes</button>
      <NuxtLink v-if="video?.recorded" :to="`/apps/${slug}/v/${guide}/review`" class="inline-flex h-8 items-center rounded-lg border border-edge px-3.5 font-medium text-fg no-underline">Watch</NuxtLink>
      <button :disabled="working || !video?.lines.length" class="inline-flex h-8 items-center gap-2 rounded-lg border-0 bg-fg px-3.5 font-semibold text-ink disabled:opacity-50" @click="record">
        <span class="size-2 rounded-full bg-rec" />{{ video?.recorded ? 'Record again' : 'Record' }}
      </button>
    </TopBar>

    <main class="flex min-h-0 flex-1 flex-col items-center justify-center gap-[22px] px-10 pt-1 max-sm:px-4">
      <p v-if="error" class="m-0 text-rec">{{ error }}</p>

      <template v-if="video && !video.lines.length">
        <div class="flex max-w-[560px] flex-col items-center gap-2 text-center" aria-live="polite">
          <p class="m-0 text-[22px] font-medium">{{ working ? 'Writing the script…' : 'No script yet' }}</p>
          <p v-for="(s, i) in steps" :key="i" class="m-0" :class="i === steps.length - 1 ? 'text-muted' : 'text-dim'">{{ s }}</p>
          <p v-if="video.job?.state === 'error'" class="m-0 text-rec">{{ video.job.error }}</p>
        </div>
      </template>

      <template v-else-if="line">
        <div class="w-full max-w-[860px] overflow-hidden rounded-[10px] shadow-[0_0_0_1px_rgba(255,255,255,.06),0_30px_60px_-10px_rgba(0,0,0,.7)]">
          <img v-if="frame(line.id)" :src="frame(line.id)!" :alt="`Line ${line.id}`" class="block aspect-[1440/750] w-full object-cover">
          <div v-else class="grid aspect-[1440/750] w-full place-items-center bg-[#141418] px-10 text-center text-muted">
            <span class="flex max-w-[520px] flex-col gap-2"><span class="text-dim">Not filmed yet</span>{{ line.screen }}</span>
          </div>
        </div>

        <textarea
          v-if="editing" id="line-text" v-model="draft" rows="2" maxlength="400"
          class="w-full max-w-[760px] resize-none rounded-lg border border-edge bg-field px-3 py-2 text-center text-[24px] leading-[1.35] font-medium tracking-[-0.01em] text-fg"
          @blur="saveLine" @keydown.enter.prevent="saveLine" @keydown.esc="editing = false"
        />
        <button v-else class="max-w-[760px] cursor-text border-0 bg-transparent p-0 text-center text-[24px] leading-[1.35] font-medium tracking-[-0.01em] text-fg disabled:cursor-default" :disabled="working" @click="edit">{{ line.voice }}</button>

        <p v-if="working" class="-mt-2.5 m-0 text-muted" aria-live="polite">{{ steps.at(-1) ?? 'Working…' }}</p>
        <p v-else class="-mt-2.5 m-0 font-mono text-xs text-faint">
          {{ line.id.replace('L', '') }}<template v-if="len"> · {{ len }}</template> · click the line to edit it<template v-if="oneWayLines.includes(line.id)"> · <span class="text-amber">can't be undone, answered in the browser</span></template>
        </p>
        <p v-if="problem || video?.job?.state === 'error'" class="m-0 text-rec">{{ problem || video?.job?.error }}</p>
        <p v-if="video?.status === 'changed'" class="m-0 text-muted">The script changed since filming. Record again to update the video.</p>
      </template>
    </main>

    <aside v-if="showNotes && video?.notes" class="absolute top-[60px] right-5 max-h-[60vh] w-[380px] overflow-auto rounded-xl bg-raise p-4 text-[13px] whitespace-pre-wrap text-soft shadow-[0_0_0_1px_#2A2A30,0_20px_40px_rgba(0,0,0,.6)]">{{ video.notes }}</aside>

    <FrameStrip v-if="video?.lines.length" :lines="video.lines" :src="frame" :lengths="lengths" :selected="selected" :one-way="oneWayLines" mode="edit" @pick="selected = $event" />
  </div>
</template>
