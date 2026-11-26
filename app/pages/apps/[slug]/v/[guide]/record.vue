<script setup lang="ts">
import { PhWarningCircle } from '@phosphor-icons/vue'

const { slug, guide, data: video, error, frame, lengths, load } = useVideo()
const state = computed(() => ['record', 'remake'].includes(video.value?.job?.kind ?? '') ? video.value!.job!.state : null)

// Filming is one agent run, so the strip fills in when the cut video exists; then Review opens.
watch(state, (s) => { if (s === 'done') setTimeout(() => navigateTo(`/apps/${slug}/v/${guide}/review`, { replace: true }), 1200) })

const filmed = computed(() => state.value === 'done' ? video.value?.lines.length ?? 0 : 0)
</script>

<template>
  <div class="flex h-screen min-h-[640px] flex-col overflow-hidden">
    <TopBar :crumbs="[{ label: video?.app.name ?? '', to: `/apps/${slug}` }, { label: video?.title ?? '' }]">
      <span v-if="state === 'working'" class="pill pill-working"><span class="rec-dot pulse" />Recording</span>
      <span v-else-if="state === 'error'" class="pill pill-failed"><PhWarningCircle :size="14" />{{ video?.job?.error === 'Stopped.' ? 'Stopped' : 'Failed' }}</span>
      <NuxtLink :to="`/apps/${slug}/v/${guide}`" class="btn btn-secondary">Back to the script</NuxtLink>
    </TopBar>
    <p v-if="error" class="m-0 border-b border-line px-4 py-2 text-rec" role="alert">{{ error }}</p>

    <div class="flex min-h-0 flex-1">
      <section class="w-[42%] min-w-[380px] max-w-[520px] flex-none overflow-y-auto border-r border-line" aria-label="Script">
        <ScriptLines v-if="video" :lines="video.lines" :done="filmed" />
      </section>
      <main class="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-6" aria-live="polite">
        <div class="flex w-full max-w-[860px] flex-col gap-3">
          <div class="frame unfilmed grid aspect-[1440/750] w-full place-items-center px-10">
            <div class="w-full max-w-[480px] border border-line bg-page p-5">
              <JobProgress v-if="video?.job" :job="video.job" :stop-url="`/api/apps/${slug}/videos/${guide}/stop`" @stopped="load" />
            </div>
          </div>
          <p class="meta m-0 text-center">{{ video?.lines.length ?? 0 }} lines · saves are answered in the browser, so nothing real changes</p>
          <FrameStrip v-if="video?.lines.length" :lines="video.lines" :src="filmed ? frame : () => null" :lengths="filmed ? lengths : undefined" arriving />
        </div>
      </main>
    </div>
  </div>
</template>
