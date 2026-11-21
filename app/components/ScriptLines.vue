<script setup lang="ts">
// The script column: every line with its slate. The grey highlight springs to the selected line.
const props = defineProps<{
  lines: { id: string, voice: string }[]
  selected?: string
  oneWay?: string[]
  editable?: boolean
  times?: Record<string, string>
  done?: number
  flags?: Record<string, string[]>
}>()
const emit = defineEmits<{ select: [id: string], save: [id: string, text: string], fix: [id: string, flag: string], keep: [id: string, flag: string] }>()

const list = ref<HTMLElement>()
const box = reactive({ top: 0, height: 0, shown: false })
const editing = ref('')
const draft = ref('')
const pulse = ref('')

function place() {
  const el = list.value?.querySelector<HTMLElement>(`[data-id="${props.selected}"]`)
  if (!el) { box.shown = false; return }
  box.top = el.offsetTop
  box.height = el.offsetHeight
  box.shown = true
}
watch(() => props.selected, (id, old) => {
  if (old && id) pulse.value = id
  nextTick(place)
})
watch(() => props.lines, () => nextTick(place), { deep: true })
onMounted(() => {
  nextTick(place)
  window.addEventListener('resize', place)
})
onBeforeUnmount(() => window.removeEventListener('resize', place))
// Content under the selected line (its marks) can change its height.
let ro: ResizeObserver | undefined
onMounted(() => { ro = new ResizeObserver(place); if (list.value) ro.observe(list.value) })
onBeforeUnmount(() => ro?.disconnect())

function click(id: string) {
  if (props.editable && id === props.selected && !editing.value) {
    draft.value = props.lines.find(l => l.id === id)?.voice ?? ''
    editing.value = id
    nextTick(() => {
      const t = list.value?.querySelector<HTMLTextAreaElement>('textarea')
      t?.focus()
      place()
    })
    return
  }
  emit('select', id)
}
function save() {
  if (!editing.value) return
  const id = editing.value
  editing.value = ''
  const line = props.lines.find(l => l.id === id)
  if (line && draft.value.trim() && draft.value.trim() !== line.voice) emit('save', id, draft.value.trim())
  nextTick(place)
}
const num = (id: string) => id.replace(/^L/, '')
</script>

<template>
  <ol ref="list" class="relative m-0 flex list-none flex-col gap-2 p-4" aria-label="Script">
    <li
      aria-hidden="true" class="pointer-events-none absolute right-4 left-4 bg-surface"
      :style="{ top: `${box.top}px`, height: `${box.height}px`, opacity: box.shown ? 1 : 0, transition: 'top 400ms var(--spring), height 400ms var(--spring), opacity 150ms ease' }"
    />
    <li v-for="(l, i) in lines" :key="l.id" :data-id="l.id" class="relative">
      <textarea
        v-if="editing === l.id" v-model="draft" rows="2" maxlength="400" :aria-label="`Line ${num(l.id)}`"
        class="block w-full resize-none border border-ink bg-page px-[10px] py-2 font-serif text-[15px] leading-[1.4] text-ink"
        @blur="save" @keydown.enter.prevent="save" @keydown.esc="editing = ''"
      />
      <button
        v-else type="button"
        class="flex min-h-9 w-full cursor-pointer items-start gap-[10px] border-0 bg-transparent px-[10px] py-2 text-left font-serif text-[15px] leading-[1.4] hover:bg-hover"
        :class="[l.id === selected ? 'text-ink hover:bg-transparent' : done !== undefined && i >= done ? 'text-muted' : 'text-ink/80']"
        :aria-current="l.id === selected ? 'true' : undefined"
        @click="click(l.id)"
      >
        <span class="slate mt-0.5" :class="[{ 'slate-on': l.id === selected }, { bump: pulse === l.id }]" @animationend="pulse = ''">{{ num(l.id) }}</span>
        <span class="min-w-0 flex-1">{{ l.voice }}</span>
        <span v-if="times?.[l.id]" class="meta mt-0.5 flex-none font-sans">{{ times[l.id] }}</span>
        <span v-if="done !== undefined && i < done" class="meta mt-0.5 flex-none font-sans" aria-label="Filmed">✓</span>
        <span v-if="oneWay?.includes(l.id)" class="mt-2 size-1.5 flex-none rounded-full bg-oneway" title="Can't be undone. Answered in the browser while filming." />
      </button>
      <ul v-if="flags?.[l.id]?.length && editing !== l.id" class="m-0 ml-[46px] flex list-none flex-col gap-0.5 p-0 pr-[10px] pb-1.5 font-sans text-[13px] leading-[1.35] text-oneway">
        <li v-for="f in flags[l.id]" :key="f" class="flex items-start gap-2">
          <span class="min-w-0 flex-1">{{ f }}</span>
          <span v-if="editable" class="flex flex-none gap-1">
            <button type="button" class="btn btn-plain h-6 px-1.5 text-[12px] text-ink" :aria-label="`Fix line ${num(l.id)}: ${f}`" @click="emit('fix', l.id, f)">Fix</button>
            <button type="button" class="btn btn-plain h-6 px-1.5 text-[12px] text-muted" :aria-label="`Keep line ${num(l.id)} as it is`" title="The line is right as it is. Stop flagging it." @click="emit('keep', l.id, f)">Keep</button>
          </span>
        </li>
      </ul>
      <slot v-if="l.id === selected && editing !== l.id" name="selected" :id="l.id" />
    </li>
  </ol>
</template>
