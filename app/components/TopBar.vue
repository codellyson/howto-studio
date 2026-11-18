<script setup lang="ts">
defineProps<{ crumbs?: { label: string, to?: string }[] }>()
</script>

<template>
  <header class="flex h-[52px] flex-none items-center gap-3 px-5">
    <NuxtLink to="/" class="font-semibold text-fg no-underline">How-to Studio</NuxtLink>
    <template v-for="c in crumbs" :key="c.label">
      <span class="text-dim">/</span>
      <NuxtLink v-if="c.to" :to="c.to" class="text-muted no-underline hover:text-fg">{{ c.label }}</NuxtLink>
      <span v-else class="font-medium">{{ c.label }}</span>
    </template>
    <div class="ml-auto flex items-center gap-2">
      <slot />
    </div>
  </header>
</template>
