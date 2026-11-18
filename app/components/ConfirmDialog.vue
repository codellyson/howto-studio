<script setup lang="ts">
// The only confirmation the app uses: a question, what happens, Cancel and a button that repeats the action.
const props = defineProps<{ open: boolean, title: string, body?: string, action: string, danger?: boolean }>()
const emit = defineEmits<{ confirm: [], cancel: [] }>()
const dialog = ref<HTMLDialogElement>()
watch(() => props.open, (o) => {
  if (o) dialog.value?.showModal()
  else dialog.value?.close()
})
</script>

<template>
  <dialog
    ref="dialog" class="m-auto w-[420px] max-w-[calc(100vw-32px)] border border-ink bg-page p-4 text-ink backdrop:bg-[var(--backdrop)]"
    :aria-label="title" @cancel.prevent="emit('cancel')"
  >
    <div class="land flex flex-col gap-2.5">
      <p class="m-0 text-[15px] font-semibold">{{ title }}</p>
      <p v-if="body" class="m-0 text-[13.5px] text-muted">{{ body }}</p>
      <div class="mt-1 flex justify-end gap-2">
        <button type="button" class="btn btn-plain" @click="emit('cancel')">Cancel</button>
        <button type="button" class="btn btn-primary" :style="danger ? { background: 'var(--rec)', borderColor: 'var(--rec)', color: '#fff' } : undefined" autofocus @click="emit('confirm')">{{ action }}</button>
      </div>
    </div>
  </dialog>
</template>
