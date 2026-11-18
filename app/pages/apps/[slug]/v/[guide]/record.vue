<script setup lang="ts">
const { slug, guide, data: video, error, frame } = useVideo()
const steps = computed(() => video.value?.job?.steps ?? [])
const state = computed(() => video.value?.job?.kind === 'record' ? video.value.job.state : null)

// Filming is one agent run: the strip fills in when the cut video exists.
watch(state, (s) => { if (s === 'done') navigateTo(`/apps/${slug}/v/${guide}/review`, { replace: true }) })

const PHASES = ['Making the voice', 'Writing', 'Filming the take', 'Cutting and checking the video']
const phase = computed(() => {
  const last = [...steps.value].reverse().find(s => PHASES.some(p => s.startsWith(p)))
  return last ?? steps.value.at(-1) ?? 'Starting…'
})
</script>

<template>
  <div class="flex h-screen min-h-[640px] flex-col overflow-hidden">
    <TopBar :crumbs="[{ label: video?.app.name ?? '', to: `/apps/${slug}` }, { label: video?.title ?? '' }]">
      <span v-if="state === 'working'" class="inline-flex items-center gap-2 font-medium"><span class="size-2 animate-pulse rounded-full bg-rec" />Recording</span>
      <NuxtLink :to="`/apps/${slug}/v/${guide}`" class="inline-flex h-8 items-center rounded-lg border border-edge px-3.5 font-medium text-fg no-underline">{{ state === 'working' ? 'Back to script' : 'Edit script' }}</NuxtLink>
    </TopBar>

    <main class="flex min-h-0 flex-1 flex-col items-center justify-center gap-[22px] px-10 pt-1" aria-live="polite">
      <p v-if="error" class="m-0 text-rec">{{ error }}</p>
      <div class="grid aspect-[1440/750] w-full max-w-[860px] place-items-center rounded-[10px] bg-[#141418] shadow-[0_0_0_2px_rgba(229,72,77,.45),0_30px_60px_-10px_rgba(0,0,0,.7)]">
        <div class="flex max-w-[520px] flex-col items-center gap-2 px-6 text-center">
          <template v-if="state === 'error'">
            <p class="m-0 text-[22px] font-medium">Filming stopped</p>
            <p class="m-0 text-rec">{{ video?.job?.error }}</p>
          </template>
          <template v-else>
            <p class="m-0 text-[24px] leading-[1.35] font-medium tracking-[-0.01em]">{{ phase }}</p>
            <p v-for="(s, i) in steps.slice(-4, -1)" :key="i" class="m-0 text-dim">{{ s }}</p>
          </template>
        </div>
      </div>
      <p class="m-0 font-mono text-xs text-faint">{{ video?.lines.length ?? 0 }} lines · nothing real is being saved</p>
    </main>

    <FrameStrip v-if="video?.lines.length" :lines="video.lines" :src="frame" mode="record" :done-up-to="0" />
  </div>
</template>
