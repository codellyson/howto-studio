<script setup lang="ts">
// Marks on the screen for one line: a ring, label or arrow pinned to an element the line clicks.
import { PhCircleDashed, PhTagSimple, PhArrowDown, PhPlus, PhX } from '@phosphor-icons/vue'

export type Pin = { line: string, kind: 'ring' | 'label' | 'arrow', target: number, text: string }
const props = defineProps<{ line: string, targets: string[], pins: Pin[], disabled?: boolean }>()
const emit = defineEmits<{ save: [pins: Pin[]] }>()

const ICON = { ring: PhCircleDashed, label: PhTagSimple, arrow: PhArrowDown }
const NAME = { ring: 'Ring', label: 'Label', arrow: 'Arrow' }
const mine = computed(() => props.pins.map((p, i) => ({ ...p, i })).filter(p => p.line === props.line))

function add(kind: Pin['kind']) {
  emit('save', [...props.pins, { line: props.line, kind, target: 0, text: kind === 'label' ? props.targets[0] ?? '' : '' }])
}
function change(i: number, patch: Partial<Pin>) {
  emit('save', props.pins.map((p, j) => (j === i ? { ...p, ...patch } : p)))
}
const remove = (i: number) => emit('save', props.pins.filter((_, j) => j !== i))
</script>

<template>
  <div class="ml-[46px] flex flex-col gap-1.5 pr-[10px] pb-3 font-sans" @click.stop>
    <p class="meta m-0">On screen in this line</p>
    <p v-if="!targets.length" class="meta m-0">This line clicks nothing, so there is nothing to pin a mark to.</p>
    <template v-else>
      <div v-for="p in mine" :key="p.i" class="flex h-9 items-center gap-2.5 border border-line bg-page px-2.5 text-[13px]">
        <component :is="ICON[p.kind]" :size="16" />
        <span class="w-11 flex-none font-semibold">{{ NAME[p.kind] }}</span>
        <input
          v-if="p.kind === 'label'" :value="p.text" maxlength="60" :aria-label="`Words on the label`" :disabled="disabled"
          class="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-ink outline-offset-0"
          @change="change(p.i, { text: ($event.target as HTMLInputElement).value })"
        >
        <span v-else class="min-w-0 flex-1 truncate text-muted">{{ targets[p.target] ?? 'Gone from this take' }}</span>
        <select
          v-if="targets.length > 1" :value="p.target" :disabled="disabled" aria-label="Pinned to"
          class="max-w-[120px] border-0 bg-transparent text-[13px] text-muted" @change="change(p.i, { target: Number(($event.target as HTMLSelectElement).value) })"
        >
          <option v-for="(t, ti) in targets" :key="ti" :value="ti">{{ t }}</option>
        </select>
        <button type="button" class="btn btn-plain btn-icon h-7 w-7" :disabled="disabled" :aria-label="`Remove ${NAME[p.kind].toLowerCase()}`" @click="remove(p.i)"><PhX :size="14" /></button>
      </div>
      <div class="flex gap-1.5">
        <button v-for="k in (['ring', 'label', 'arrow'] as const)" :key="k" type="button" class="btn btn-secondary border-line" :disabled="disabled" @click="add(k)"><PhPlus :size="14" />{{ NAME[k] }}</button>
      </div>
      <p v-if="targets.length === 1" class="meta m-0">Pinned to <span class="text-ink">{{ targets[0] }}</span>, the one thing this line clicks. Placed where it was when clicked.</p>
    </template>
  </div>
</template>
