<script setup lang="ts">
import { PhCircleNotch, PhCode, PhDesktop, PhFolderOpen, PhGlobeSimple, PhLockSimple, PhCheck, PhTerminal } from '@phosphor-icons/vue'

type Summary = { framework: string, clientRendered: boolean, signIn: string, pages: string[], saves: { oneWay: boolean }[] }
type App = { slug: string, name: string, summary?: Summary, job: { state: string, steps: string[], error?: string } | null }

const route = useRoute()
const repo = ref('')
const picking = ref(false)
async function choose() {
  picking.value = true
  try { const p = await pickFolder(repo.value); if (p) repo.value = p } catch (e) { problem.value = errorText(e) } finally { picking.value = false }
}
const site = ref('')
// Where the app is filmed: its live site, or its dev server on this Mac, which the studio starts when needed.
const mode = ref<'live' | 'local'>('live')
const start = ref('')
const localUrl = ref('')
// The dev command and address are read from package.json; anything typed by hand is kept.
async function detect() {
  if (mode.value !== 'local' || !repo.value.trim()) return
  const found = await $fetch<{ command: string, url: string } | null>('/api/detect-local', { method: 'POST', body: { repo: repo.value } }).catch(() => null)
  if (found) { start.value ||= found.command; localUrl.value ||= found.url }
}
watch([repo, mode], () => { start.value = ''; localUrl.value = ''; detect() })
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
    const body = mode.value === 'local'
      ? { repo: repo.value, mode: 'local', site: localUrl.value, start: start.value }
      : { repo: repo.value, site: site.value }
    const r = await $fetch<{ slug: string }>('/api/apps', { method: 'POST', body })
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
const steps = computed(() => app.value?.job?.steps.slice(-6) ?? [])
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <TopBar :crumbs="[{ label: 'Your apps', to: '/' }, { label: 'Connect an app' }]" />
    <main class="mx-auto flex w-full max-w-[620px] flex-1 flex-col gap-6 px-6 py-12">
      <div class="flex flex-col gap-2">
        <h1 class="m-0 font-serif text-[30px] leading-[1.15] font-medium tracking-[-0.01em]">{{ app ? `Connect ${app.name}` : 'Connect an app' }}</h1>
        <p class="m-0 text-muted">The code is read first, so what is safe to click is known before anything is filmed.</p>
      </div>

      <form v-if="!slug" class="flex flex-col gap-4" @submit.prevent="connect">
        <div class="flex flex-col gap-1.5">
          <label for="repo" class="flex items-center gap-1.5"><PhCode :size="16" />Code folder</label>
          <div class="flex gap-2">
            <input id="repo" v-model="repo" required placeholder="~/projects/my-app" class="field min-w-0 flex-1">
            <button type="button" class="btn btn-secondary h-8" :disabled="picking" @click="choose"><PhFolderOpen :size="16" />Choose…</button>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <span id="where" class="flex items-center gap-1.5">Film it on</span>
          <span class="flex self-start border border-ink" role="radiogroup" aria-labelledby="where">
            <button
              v-for="m in (['live', 'local'] as const)" :key="m" type="button" role="radio" :aria-checked="mode === m"
              class="flex h-[30px] cursor-pointer items-center gap-1.5 border-0 border-l border-ink px-3 text-[13px] first:border-l-0"
              :class="mode === m ? 'bg-ink text-page' : 'bg-page text-ink hover:bg-hover'" @click="mode = m"
            ><component :is="m === 'live' ? PhGlobeSimple : PhDesktop" :size="15" />{{ m === 'live' ? 'Live site' : 'This Mac' }}</button>
          </span>
        </div>
        <label v-if="mode === 'live'" class="flex flex-col gap-1.5">
          <span class="flex items-center gap-1.5"><PhGlobeSimple :size="16" />Site to film</span>
          <input v-model="site" required type="url" placeholder="https://app.example.com" class="field">
        </label>
        <template v-else>
          <label class="flex flex-col gap-1.5">
            <span class="flex items-center gap-1.5"><PhTerminal :size="16" />Command that starts it</span>
            <input v-model="start" required placeholder="pnpm dev" class="field font-mono text-[13px]">
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="flex items-center gap-1.5"><PhDesktop :size="16" />Address on this Mac</span>
            <input v-model="localUrl" required type="url" placeholder="http://localhost:3000" class="field">
          </label>
          <p class="meta m-0">The studio runs this command in the code folder before writing or filming, and stops it after. If something already answers at the address, that is used as it is.</p>
        </template>
        <button :disabled="sending" class="btn btn-primary mt-2 self-start">{{ sending ? 'Starting' : 'Read the code' }}</button>
      </form>

      <section v-if="working" class="flex flex-col gap-2" aria-live="polite">
        <p class="m-0 flex items-center gap-2 font-medium"><PhCircleNotch :size="16" class="spin" />Reading the code</p>
        <p v-for="(step, i) in steps" :key="i" class="m-0" :class="i === steps.length - 1 ? 'text-ink' : 'text-muted'">{{ step }}</p>
      </section>

      <section v-if="s && !working" class="land flex flex-col border-t border-line">
        <div class="flex gap-4 border-b border-line py-3.5">
          <span class="flex w-[110px] flex-none items-center gap-1.5 self-start text-muted"><PhCheck :size="15" />Safety</span>
          <span>{{ s.clientRendered ? 'Pages load their data in the browser, so every save can be answered there. The live site is safe to film.' : 'Pages are built on the server, so only saves can be answered in the browser. Film from a test record.' }}</span>
        </div>
        <div class="flex gap-4 border-b border-line py-3.5">
          <span class="flex w-[110px] flex-none items-center gap-1.5 self-start text-muted"><PhLockSimple :size="15" />Sign-in</span>
          <span>{{ s.signIn }}</span>
        </div>
        <div class="flex gap-4 border-b border-line py-3.5">
          <span class="flex w-[110px] flex-none items-center gap-1.5 self-start text-muted"><PhCode :size="15" />Found</span>
          <span>{{ s.pages.length }} pages and {{ s.saves.length }} saves. <span :class="oneWay ? 'text-oneway' : ''">{{ oneWay }} can't be undone.</span></span>
        </div>
      </section>

      <p v-if="problem || app?.job?.state === 'error'" class="m-0 text-rec" role="alert">{{ problem || app?.job?.error }}</p>
      <div class="flex gap-2">
        <NuxtLink v-if="s && !working" :to="`/apps/${slug}`" class="btn btn-primary">Continue</NuxtLink>
        <button v-if="app?.job?.state === 'error'" type="button" class="btn btn-secondary" @click="retry">Read the code again</button>
      </div>
    </main>
  </div>
</template>
