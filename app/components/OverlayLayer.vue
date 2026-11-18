<script setup lang="ts">
// The video's still as the skill's dress.cjs will draw it (frame, capture, marks, cursor, caption), scaled to fit.
const props = defineProps<{ html: string, size: [number, number], color: string }>()
const box = ref<HTMLElement>()
const scale = ref(0)
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(() => { scale.value = (box.value?.clientWidth ?? 0) / props.size[0] })
  if (box.value) ro.observe(box.value)
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <div ref="box" class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div class="g-layer origin-top-left" :style="{ width: `${size[0]}px`, height: `${size[1]}px`, transform: `scale(${scale})`, '--g-color': color }" v-html="html" />
  </div>
</template>
