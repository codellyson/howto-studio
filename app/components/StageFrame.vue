<script setup lang="ts">
// One shot on the stage: the frame with its line as a subtitle, or an empty striped frame before filming.
// A clean take shows the whole frame, and the default slot draws the look over it.
defineProps<{ src?: string | null, subtitle?: string, onScreen?: string, alt?: string, full?: boolean }>()
</script>

<template>
  <div class="frame w-full overflow-hidden">
    <Transition mode="out-in" enter-active-class="transition-opacity duration-150" enter-from-class="opacity-30" leave-active-class="transition-opacity duration-150" leave-to-class="opacity-30">
      <img v-if="src" :key="src" :src="src" :alt="alt ?? ''" class="block w-full object-cover" :class="full ? 'aspect-[1440/900]' : 'aspect-[1440/750]'">
      <div v-else key="empty" class="unfilmed grid aspect-[1440/750] w-full place-items-center px-10 pb-12 text-center">
        <span class="flex max-w-[460px] flex-col gap-1 text-muted"><span>Not filmed yet</span><span>{{ onScreen }}</span></span>
      </div>
    </Transition>
    <slot />
    <span v-if="subtitle" class="subtitle">{{ subtitle }}</span>
  </div>
</template>
