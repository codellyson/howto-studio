<script setup lang="ts">
// Caption and cursor styles. Each pick saves at once and the stage preview follows; the video changes on "Make the video again".
type Look = { caption: Record<string, string>, cursor: Record<string, string>, frame: Record<string, string> }
const props = defineProps<{ look: Look, scope: 'app' | 'video', appName: string, choices: Record<string, Record<string, string[]>>, backgrounds: Record<string, string>, busy?: boolean, stale?: boolean }>()
const emit = defineEmits<{ change: [look: Look, scope: 'app' | 'video'], render: [] }>()

const COLOURS = ['#1E97F1', '#111111', '#FFFFFF', '#DC2626', '#16A34A', '#F59E0B']
const NAMES: Record<string, string> = { full: 'Full', framed: 'Framed', browser: 'Browser', on: 'On', off: 'Off', serif: 'Serif', sans: 'Sans', rounded: 'Rounded', s: 'S', m: 'M', l: 'L', bar: 'Bar + step', dark: 'Dark', light: 'Light', none: 'None', below: 'Below', bottom: 'Bottom', top: 'Top', ring: 'Ring', arrow: 'Arrow', dot: 'Dot', ripple: 'Ripple' }
const ROWS = {
  caption: [['font', 'Font'], ['size', 'Size'], ['box', 'Box'], ['place', 'Place']],
  cursor: [['shape', 'Shape'], ['click', 'On click']],
  frame: [['style', 'Frame'], ['padding', 'Padding'], ['corners', 'Corners'], ['shadow', 'Shadow'], ['zoom', 'Zoom on click']],
} as const
const TITLE = { frame: 'Capture', caption: 'Captions', cursor: 'Cursor' }
// Padding, corners and shadow only mean something around a framed capture.
const shown = (part: string, k: string) => part !== 'frame' || k === 'style' || k === 'zoom' || props.look.frame.style !== 'full'

function pick(part: 'caption' | 'cursor' | 'frame', k: string, v: string, scope = props.scope) {
  const next = JSON.parse(JSON.stringify(props.look)) as Look
  next[part][k] = v
  emit('change', next, scope)
}
</script>

<template>
  <div class="flex flex-col gap-1 p-4">
    <template v-for="part in (['frame', 'caption', 'cursor'] as const)" :key="part">
      <h3 class="m-0 mb-2 font-serif text-[20px] leading-tight font-medium" :class="{ 'mt-5 border-t border-line pt-5': part !== 'frame' }">{{ TITLE[part] }}</h3>
      <div v-for="[k, label] in ROWS[part].filter(([k]) => shown(part, k))" :key="k" class="flex h-10 items-center justify-between gap-4" role="radiogroup" :aria-label="label">
        <span class="text-muted">{{ label }}</span>
        <span class="flex border border-ink">
          <button
            v-for="v in choices[part]![k]" :key="v" type="button" role="radio" :aria-checked="look[part][k] === v"
            class="h-[30px] cursor-pointer border-0 border-l border-ink px-[11px] text-[13px] first:border-l-0"
            :class="look[part][k] === v ? 'bg-ink text-page' : 'bg-page text-ink hover:bg-hover'"
            @click="pick(part, k, v)"
          >{{ NAMES[v] ?? v }}</button>
        </span>
      </div>
      <div v-if="part === 'frame' && look.frame.style !== 'full'" class="flex h-10 items-center justify-between gap-4" role="radiogroup" aria-label="Background">
        <span class="text-muted">Background</span>
        <span class="flex gap-1.5">
          <button
            v-for="b in choices.frame!.background" :key="b" type="button" role="radio" :aria-checked="look.frame.background === b" :aria-label="b"
            class="size-[22px] cursor-pointer border border-line-strong" :class="{ 'outline-2 outline-offset-2 outline-ink': look.frame.background === b }"
            :style="{ background: backgrounds[b] }" @click="pick('frame', 'background', b)"
          />
        </span>
      </div>
      <div v-if="part === 'cursor'" class="flex h-10 items-center justify-between gap-4" role="radiogroup" aria-label="Colour">
        <span class="text-muted">Colour</span>
        <span class="flex gap-1.5">
          <button
            v-for="c in COLOURS" :key="c" type="button" role="radio" :aria-checked="look.cursor.color?.toUpperCase() === c" :aria-label="c"
            class="size-[22px] cursor-pointer border border-line-strong" :class="{ 'outline-2 outline-offset-2 outline-ink': look.cursor.color?.toUpperCase() === c }"
            :style="{ background: c }" @click="pick('cursor', 'color', c)"
          />
        </span>
      </div>
    </template>
    <p class="meta m-0 mt-1">The colour is used for the cursor and for marks on the screen.</p>

    <div class="mt-5 flex h-10 items-center justify-between gap-4 border-t border-line pt-5" role="radiogroup" aria-label="Use for">
      <span class="text-muted">Use for</span>
      <span class="flex border border-ink">
        <button
          v-for="s in (['app', 'video'] as const)" :key="s" type="button" role="radio" :aria-checked="scope === s"
          class="h-[30px] cursor-pointer border-0 border-l border-ink px-[11px] text-[13px] first:border-l-0"
          :class="scope === s ? 'bg-ink text-page' : 'bg-page text-ink hover:bg-hover'"
          @click="emit('change', look, s)"
        >{{ s === 'app' ? `Every ${appName} video` : 'This one' }}</button>
      </span>
    </div>
    <div class="mt-6 flex items-center gap-3">
      <button type="button" class="btn btn-primary" :disabled="busy" @click="emit('render')">Make the video again</button>
      <span class="meta">{{ stale ? 'The video still has the old look.' : 'No new filming needed.' }}</span>
    </div>
  </div>
</template>
