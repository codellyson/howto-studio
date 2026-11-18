<script setup lang="ts">
type Summary = { framework: string, clientRendered: boolean, signIn: string, pages: string[], saves: { oneWay: boolean }[] }
type App = { slug: string, name: string, summary?: Summary, job: { state: string, steps: string[], error?: string } | null }

const route = useRoute()
const repo = ref('')
const site = ref('')
const sending = ref(false)
const problem = ref('')
const slug = computed(() => String(route.query.app ?? ''))
const app = ref<App | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

async function poll() {
  clearTimeout(timer)
  if (!slug.value) return
  try { app.value = await $fetch<App>(`/api/apps/${slug.value}`) } catch (e) { problem.value = errorText(e) }
  if (app.value?.job?.state === 'working') timer = setTimeout(poll, 1000)
}
watch(slug, poll, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

async function connect() {
  sending.value = true
  problem.value = ''
  try {
    const r = await $fetch<{ slug: string }>('/api/apps', { method: 'POST', body: { repo: repo.value, site: site.value } })
    await navigateTo({ query: { app: r.slug } })
  } catch (e) { problem.value = errorText(e) } finally { sending.value = false }
}

async function retry() {
  problem.value = ''
  try { await $fetch(`/api/apps/${slug.value}/reconnect`, { method: 'POST' }); poll() } catch (e) { problem.value = errorText(e) }
}

const working = computed(() => app.value?.job?.state === 'working')
const s = computed(() => app.value?.summary)
const oneWay = computed(() => s.value?.saves.filter(x => x.oneWay).length ?? 0)
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <TopBar :crumbs="[{ label: 'Your apps', to: '/' }, { label: 'Connect an app' }]" />
    <main class="mx-auto flex w-full max-w-[620px] flex-1 flex-col gap-7 px-6 py-16">
      <div class="flex flex-col gap-2">
        <h1 class="m-0 text-[28px] font-semibold tracking-[-0.02em]">{{ app ? `Connect ${app.name}` : 'Connect an app' }}</h1>
        <p class="m-0 text-muted">The agent reads the code first, so it knows what's safe to click before it films anything.</p>
      </div>

      <form v-if="!slug" class="flex flex-col gap-4" @submit.prevent="connect">
        <div class="flex flex-col gap-1.5">
          <label for="repo" class="text-soft">Code folder</label>
          <input id="repo" v-model="repo" required placeholder="~/projects/my-app" class="h-[42px] rounded-[10px] border border-[#26262C] bg-field px-3.5 font-mono text-[13px] text-fg placeholder:text-dim">
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="site" class="text-soft">Site to film</label>
          <input id="site" v-model="site" required type="url" placeholder="https://app.example.com" class="h-[42px] rounded-[10px] border border-[#26262C] bg-field px-3.5 font-mono text-[13px] text-fg placeholder:text-dim">
        </div>
        <button :disabled="sending" class="mt-2 h-[42px] self-start rounded-[10px] border-0 bg-fg px-5 font-semibold text-ink disabled:opacity-50">{{ sending ? 'Starting…' : 'Read the code' }}</button>
      </form>

      <section v-if="working" class="flex flex-col gap-2" aria-live="polite">
        <p class="m-0 font-medium">Reading the code…</p>
        <p v-for="(step, i) in app!.job!.steps.slice(-6)" :key="i" class="m-0 text-muted" :class="{ 'text-dim': i < app!.job!.steps.slice(-6).length - 1 }">{{ step }}</p>
      </section>

      <section v-if="s && !working" class="flex flex-col border-t border-line">
        <div class="flex gap-4 border-b border-line py-3.5">
          <span class="w-[110px] flex-none text-muted">Safety</span>
          <span>{{ s.clientRendered ? 'Pages load their data in the browser, so every save can be answered there. Safe to film the live site.' : 'Pages are built on the server, so only saves can be faked. Film from a test record.' }}</span>
        </div>
        <div class="flex gap-4 border-b border-line py-3.5">
          <span class="w-[110px] flex-none text-muted">Sign-in</span>
          <span>{{ s.signIn }}</span>
        </div>
        <div class="flex gap-4 border-b border-line py-3.5">
          <span class="w-[110px] flex-none text-muted">Found</span>
          <span>{{ s.pages.length }} pages, {{ s.saves.length }} saves. {{ oneWay }} can't be undone.</span>
        </div>
      </section>

      <p v-if="problem || app?.job?.state === 'error'" class="m-0 text-rec">{{ problem || app?.job?.error }}</p>
      <div class="flex gap-3">
        <NuxtLink v-if="s && !working" :to="`/apps/${slug}`" class="inline-flex h-[42px] items-center rounded-[10px] bg-fg px-5 font-semibold text-ink no-underline">Continue</NuxtLink>
        <button v-if="app?.job?.state === 'error'" class="h-[42px] rounded-[10px] border border-edge bg-transparent px-5 text-fg" @click="retry">Try again</button>
      </div>
    </main>
  </div>
</template>
