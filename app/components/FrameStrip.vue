<script setup lang="ts">
// The storyboard strip: one frame per line, each as wide as its line plays.
const props = defineProps<{
  lines: { id: string }[]
  src: (id: string) => string | null
  lengths?: Record<string, number>
  selected?: string
  mode?: 'edit' | 'record' | 'chapters'
  doneUpTo?: number
  oneWay?: string[]
  times?: Record<string, string>
}>()
const emit = defineEmits<{ pick: [id: string] }>()

const items = computed(() => props.lines.map((l, i) => {
  const src = props.src(l.id)
  const recording = props.mode === 'record'
  const filmed = recording ? i < (props.doneUpTo ?? 0) : !!src
  return {
    id: l.id,
    n: l.id.replace(/^L/, ''),
    src: filmed ? src : null,
    grow: Math.round((props.lengths?.[l.id] ?? 3) * 100),
    current: l.id === props.selected,
    dim: props.mode === 'edit' && l.id !== props.selected,
    oneWay: props.oneWay?.includes(l.id),
    label: props.mode === 'chapters' ? props.times?.[l.id] ?? '' : recording && i < (props.doneUpTo ?? 0) ? `${l.id.replace(/^L/, '')} ✓` : l.id.replace(/^L/, ''),
  }
}))
</script>

<template>
  <nav aria-label="Lines" class="flex flex-none items-end gap-1.5 px-6 pt-[18px] pb-[22px]">
    <button
      v-for="f in items" :key="f.id" type="button"
      class="flex min-w-0 flex-col gap-1.5 border-0 bg-transparent p-0 text-left"
      :style="{ flex: `${f.grow} 1 0`, opacity: f.dim ? 0.55 : 1 }"
      :aria-label="`Line ${f.n}`" :aria-current="f.current ? 'true' : undefined"
      @click="emit('pick', f.id)"
    >
      <span
        class="relative block h-16 w-full overflow-hidden rounded-md bg-[#17171B]"
        :class="f.current ? (mode === 'record' ? 'ring-2 ring-rec' : 'ring-2 ring-fg') : 'ring-1 ring-white/5'"
      >
        <img v-if="f.src" :src="f.src" alt="" class="block h-16 w-full object-cover">
        <span
          v-if="f.oneWay" title="Can't be undone. Answered in the browser while filming."
          class="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber shadow-[0_0_0_2px_rgba(14,14,16,.8)]"
        />
      </span>
      <span class="font-mono text-[11px]" :class="f.current ? 'text-fg' : 'text-faint'">{{ f.label }}</span>
    </button>
  </nav>
</template>
