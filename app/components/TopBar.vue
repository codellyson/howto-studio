<script setup lang="ts">
defineProps<{ crumbs?: { label: string, to?: string }[] }>()
</script>

<template>
  <header class="flex h-[52px] flex-none items-center gap-2 border-b border-line px-4">
    <NuxtLink to="/" class="font-semibold no-underline">How-to Studio</NuxtLink>
    <template v-for="c in crumbs" :key="c.label">
      <span class="text-line-strong">/</span>
      <NuxtLink v-if="c.to" :to="c.to" class="truncate text-muted no-underline hover:text-ink">{{ c.label }}</NuxtLink>
      <span v-else class="truncate font-medium">{{ c.label }}</span>
    </template>
    <div class="ml-auto flex flex-none items-center gap-2">
      <slot />
    </div>
  </header>
</template>
