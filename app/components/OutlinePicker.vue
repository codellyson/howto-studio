<script setup lang="ts">
// Before a script is written: the videos the request could be, each as a short outline. One is picked, its steps
// can be edited, and the script is written from it.
import { PhPencilSimple } from '@phosphor-icons/vue'

export type Angle = { title: string, who: string, after: string, steps: string[] }
const props = defineProps<{ outline: { task: string, clear: boolean, angles: Angle[] }, busy?: boolean }>()
const emit = defineEmits<{ choose: [angle: number, steps: string[]], redo: [] }>()

const picked = ref(0)
const text = ref('')
const editing = ref(false)
watch(picked, (i) => { text.value = props.outline.angles[i]?.steps.join('\n') ?? ''; editing.value = false }, { immediate: true })
const steps = computed(() => text.value.split('\n').map(s => s.trim()).filter(Boolean))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="m-0 font-serif text-[20px] leading-tight font-medium">{{ outline.clear ? 'Check the outline' : 'Pick what this video shows' }}</h2>
      <p class="meta m-0 mt-1">{{ outline.clear ? 'Edit the steps if something is missing. The script follows them.' : `"${outline.task}" could be more than one video. Each one shows one task.` }}</p>
    </div>

    <fieldset v-if="outline.angles.length > 1" class="m-0 flex flex-col gap-2 border-0 p-0">
      <legend class="sr-only">Videos to choose from</legend>
      <label
        v-for="(a, i) in outline.angles" :key="i"
        class="flex cursor-pointer gap-3 border p-3" :class="picked === i ? 'border-ink' : 'border-line hover:border-muted'"
      >
        <input v-model="picked" type="radio" name="angle" :value="i" class="mt-1 flex-none accent-[var(--text)]">
        <span class="flex flex-col gap-0.5">
          <span class="font-medium">{{ a.title }}</span>
          <span class="text-[13px] text-muted">For {{ a.who }}. {{ a.after }}</span>
        </span>
      </label>
    </fieldset>
    <p v-else class="m-0 flex flex-col gap-0.5">
      <span class="font-medium">{{ outline.angles[0]?.title }}</span>
      <span class="text-[13px] text-muted">For {{ outline.angles[0]?.who }}. {{ outline.angles[0]?.after }}</span>
    </p>

    <form class="flex flex-col gap-2" @submit.prevent="emit('choose', picked, steps)">
      <div class="flex items-center justify-between">
        <label for="outline-steps" class="font-medium">{{ editing ? 'Steps, one per line' : 'Steps' }}</label>
        <button v-if="!editing" type="button" class="btn btn-plain h-7" @click="editing = true"><PhPencilSimple :size="15" />Edit</button>
      </div>
      <textarea v-if="editing" id="outline-steps" v-model="text" :rows="Math.max(6, steps.length * 2)" class="field h-auto resize-y py-2 leading-[1.5]" />
      <ol v-else class="m-0 flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-[1.45]">
        <li v-for="(s, i) in steps" :key="i">{{ s }}</li>
      </ol>
      <p class="meta m-0">{{ steps.length }} steps · about {{ Math.round(steps.length * 5) }} s</p>
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-primary" :disabled="busy || steps.length < 2">Write the script</button>
        <button type="button" class="btn btn-plain" :disabled="busy" @click="emit('redo')">None of these</button>
      </div>
    </form>
  </div>
</template>
