<script setup lang="ts">
// One way to show an agent job everywhere: what is running, for how long, the steps done, and where it stopped.
import { PhCheck, PhCircleNotch, PhWarningCircle, PhX } from '@phosphor-icons/vue'

export type JobView = { kind: string, state: string, steps: string[], at?: number[], error?: string, started?: number, ended?: number }
const props = defineProps<{ job: JobView, compact?: boolean }>()

const TITLES: Record<string, [string, string]> = {
  connect: ['Reading the code', 'Code read'],
  plan: ['Drafting outlines', 'Outlines ready'],
  script: ['Writing the script', 'Script written'],
  fakes: ['Preparing the demo data', 'Demo data ready'],
  change: ['Changing the script', 'Script changed'],
  record: ['Filming', 'Filmed'],
  render: ['Making the video again', 'Video made again'],
  signin: ['Waiting for sign-in', 'Signed in'],
}
const working = computed(() => props.job.state === 'working')
const failed = computed(() => props.job.state === 'error')
const title = computed(() => {
  const [doing, done] = TITLES[props.job.kind] ?? ['Working', 'Done']
  return failed.value ? `${doing} stopped` : working.value ? doing : done
})
const steps = computed(() => props.job.steps.slice(-6))

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
watch(working, (w) => {
  clearInterval(timer)
  if (w) timer = setInterval(() => { now.value = Date.now() }, 1000)
}, { immediate: true })
onBeforeUnmount(() => clearInterval(timer))
const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const elapsed = computed(() => props.job.started ? clock((working.value ? now.value : props.job.ended ?? now.value) - props.job.started) : '')
// How long each shown step took: until the next step started, or until the job ended.
const took = computed(() => {
  const at = props.job.at ?? []
  const shown = props.job.steps.length - steps.value.length
  return steps.value.map((_, i) => {
    const a = at[shown + i], b = at[shown + i + 1] ?? (working.value ? now.value : props.job.ended)
    return a && b ? `${Math.max(0, Math.round((b - a) / 1000))}s` : ''
  })
})
</script>

<template>
  <div v-if="compact" class="flex min-w-0 items-center gap-2" :class="failed ? 'text-rec' : 'text-ink'" role="status" aria-live="polite">
    <PhCircleNotch v-if="working" :size="15" class="spin flex-none" />
    <PhWarningCircle v-else-if="failed" :size="15" class="flex-none" />
    <PhCheck v-else :size="15" class="flex-none" />
    <span class="flex-none font-medium">{{ title }}</span>
    <span v-if="steps.length && working" class="min-w-0 truncate text-muted">· {{ steps.at(-1) }}</span>
    <span v-if="working && elapsed" class="meta flex-none tabular-nums">{{ elapsed }}</span>
  </div>

  <section v-else class="flex flex-col gap-3" role="status" aria-live="polite">
    <div class="flex items-center gap-2" :class="failed ? 'text-rec' : 'text-ink'">
      <PhCircleNotch v-if="working" :size="18" class="spin flex-none" />
      <PhWarningCircle v-else-if="failed" :size="18" class="flex-none" />
      <PhCheck v-else :size="18" class="flex-none" />
      <h2 class="m-0 font-serif text-[20px] leading-tight font-medium">{{ title }}</h2>
      <span v-if="elapsed" class="meta ml-auto tabular-nums">{{ elapsed }}</span>
    </div>
    <ol v-if="steps.length" class="m-0 flex list-none flex-col gap-1.5 p-0">
      <li v-for="(s, i) in steps" :key="`${i}-${s}`" class="land flex items-start gap-2 text-[14px]">
        <template v-if="i < steps.length - 1 || job.state === 'done'">
          <PhCheck :size="14" class="mt-[3px] flex-none text-muted" />
          <span class="min-w-0 flex-1 text-muted">{{ s }}</span>
          <span v-if="took[i]" class="meta flex-none tabular-nums">{{ took[i] }}</span>
        </template>
        <template v-else-if="failed">
          <PhX :size="14" class="mt-[3px] flex-none text-rec" />
          <span class="text-rec">{{ s }}</span>
        </template>
        <template v-else>
          <span class="mt-[6px] size-2 flex-none rounded-full bg-ink pulse" />
          <span class="min-w-0 flex-1 text-ink">{{ s }}</span>
          <span v-if="took[i]" class="meta flex-none tabular-nums">{{ took[i] }}</span>
        </template>
      </li>
    </ol>
    <p v-if="failed && job.error" class="m-0 text-[14px] text-rec">{{ job.error }}</p>
  </section>
</template>
