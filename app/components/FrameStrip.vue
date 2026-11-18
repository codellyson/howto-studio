<script setup lang="ts">
// The timing strip: one frame per line, each as wide as its line plays. Before filming, even empty slots.
const props = defineProps<{
  lines: { id: string }[]
  src: (id: string) => string | null
  lengths?: Record<string, number>
  selected?: string
  oneWay?: string[]
  times?: Record<string, string>
  arriving?: boolean
}>()
const emit = defineEmits<{ pick: [id: string] }>()

const items = computed(() => props.lines.map((l, i) => ({
  id: l.id,
  src: props.src(l.id),
  grow: props.lengths?.[l.id] ? Math.round(props.lengths[l.id]! * 100) : 300,
  current: l.id === props.selected,
  oneWay: props.oneWay?.includes(l.id),
  time: props.times?.[l.id],
  delay: `${i * 380}ms`,
})))
</script>

<template>
  <nav aria-label="Timing strip" class="flex w-full items-start gap-0.5">
    <button
      v-for="f in items" :key="f.id" type="button" :aria-label="`Line ${f.id.replace(/^L/, '')}${f.time ? `, ${f.time}` : ''}`"
      class="flex min-w-0 cursor-pointer flex-col gap-1 border-0 bg-transparent p-0 text-left"
      :style="{ flex: `${f.grow} 1 0` }"
      @click="emit('pick', f.id)"
    >
      <span
        class="relative block h-10 w-full overflow-hidden"
        :class="f.current ? 'border border-ink opacity-100 outline outline-1 outline-ink' : f.src ? 'border border-line-strong opacity-55 hover:opacity-80' : 'unfilmed border border-line-strong'"
      >
        <img v-if="f.src" :src="f.src" alt="" class="block size-full object-cover" :class="{ 'pop-in': arriving }" :style="arriving ? { animationDelay: f.delay } : undefined">
        <span v-if="f.oneWay" class="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-oneway" />
      </span>
      <span v-if="f.time" class="meta">{{ f.time }}</span>
    </button>
  </nav>
</template>
