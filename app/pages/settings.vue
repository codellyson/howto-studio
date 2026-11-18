<script setup lang="ts">
type App = { slug: string, name: string, repo: string, site: string, voice: string, fakeSaves: boolean, signedIn?: boolean, summary?: { signIn: string } }

const route = useRoute()
const apps = ref<App[]>([])
const current = computed(() => apps.value.find(a => a.slug === route.query.app) ?? apps.value[0])
const problem = ref('')
const signin = ref<{ state: string, error?: string } | null>(null)
const VOICES = ['Michael', 'Adam', 'Heart', 'Bella', 'George', 'Emma']

async function load() {
  const list = await $fetch<{ slug: string }[]>('/api/apps')
  apps.value = await Promise.all(list.map(a => $fetch<App>(`/api/apps/${a.slug}`)))
}
onMounted(load)

async function save(patch: Partial<App>) {
  if (!current.value) return
  problem.value = ''
  try {
    const url: string = `/api/apps/${current.value.slug}`
    const next = await $fetch<App>(url, { method: 'PATCH', body: patch })
    Object.assign(current.value, next)
  } catch (e) { problem.value = errorText(e) }
}

function change(field: 'repo' | 'site', label: string) {
  const v = window.prompt(label, current.value?.[field])
  if (v && v !== current.value?.[field]) save({ [field]: v })
}

let timer: ReturnType<typeof setTimeout> | undefined
async function pollSignin() {
  if (!current.value) return
  signin.value = await $fetch(`/api/apps/${current.value.slug}/signin`)
  if (signin.value?.state === 'working') timer = setTimeout(pollSignin, 1500)
  else if (signin.value?.state === 'done') load()
}
async function signIn() {
  problem.value = ''
  try {
    await $fetch(`/api/apps/${current.value!.slug}/signin`, { method: 'POST' })
    pollSignin()
  } catch (e) { problem.value = errorText(e) }
}
onBeforeUnmount(() => clearTimeout(timer))

async function remove() {
  const app = current.value
  if (!app || !window.confirm(`Remove ${app.name} from the studio? Its folder is kept on disk, renamed, so its videos can still be found.`)) return
  try {
    await $fetch(`/api/apps/${app.slug}`, { method: 'DELETE' })
    await navigateTo('/')
  } catch (e) { problem.value = errorText(e) }
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <TopBar :crumbs="[{ label: 'Your apps', to: '/' }, { label: 'Settings' }]" />
    <div class="mx-auto flex w-full max-w-[980px] flex-1 flex-wrap items-start gap-12 px-8 py-12 max-sm:px-4">
      <nav aria-label="Apps" class="flex max-w-[180px] flex-[1_1_160px] flex-col gap-0.5">
        <NuxtLink v-for="a in apps" :key="a.slug" :to="`/settings?app=${a.slug}`" class="rounded-lg px-3 py-2 no-underline" :class="a.slug === current?.slug ? 'bg-raise font-medium text-fg' : 'text-muted hover:text-fg'">{{ a.name }}</NuxtLink>
      </nav>

      <main v-if="current" class="flex min-w-0 flex-[999_1_520px] flex-col">
        <h1 class="m-0 mb-2 text-[22px] font-semibold tracking-[-0.01em]">{{ current.name }}</h1>

        <div class="flex items-center gap-4 border-b border-line py-4">
          <div class="flex min-w-0 flex-1 flex-col"><span>Code folder</span><span class="truncate font-mono text-[12.5px] text-muted">{{ current.repo }}</span></div>
          <button class="h-[34px] rounded-lg border border-edge bg-transparent px-3.5 text-fg hover:bg-raise" @click="change('repo', 'Code folder')">Change</button>
        </div>
        <div class="flex items-center gap-4 border-b border-line py-4">
          <div class="flex min-w-0 flex-1 flex-col"><span>Site to film</span><span class="truncate font-mono text-[12.5px] text-muted">{{ current.site }}</span></div>
          <button class="h-[34px] rounded-lg border border-edge bg-transparent px-3.5 text-fg hover:bg-raise" @click="change('site', 'Site to film')">Change</button>
        </div>
        <div class="flex items-center gap-4 border-b border-line py-4">
          <div class="flex min-w-0 flex-1 flex-col">
            <span>Sign-in</span>
            <span class="text-muted">{{ signin?.state === 'working' ? 'Sign in in the window that opened.' : current.signedIn ? 'Signed in. The session is kept for filming.' : `Not signed in. ${current.summary?.signIn ?? ''} Needed only for videos behind the login.` }}</span>
          </div>
          <button :disabled="signin?.state === 'working'" class="h-[34px] rounded-lg border-0 bg-fg px-3.5 font-semibold text-ink disabled:opacity-50" @click="signIn">{{ current.signedIn ? 'Sign in again' : 'Sign in' }}</button>
        </div>
        <div class="flex items-center gap-4 border-b border-line py-4">
          <div class="flex min-w-0 flex-1 flex-col"><span id="fake-label">Answer saves in the browser</span><span class="text-muted">Nothing real changes while filming. Keep on for live sites.</span></div>
          <button
            role="switch" :aria-checked="current.fakeSaves" aria-labelledby="fake-label"
            class="flex h-6 w-[42px] rounded-xl border-0 p-[3px]" :class="current.fakeSaves ? 'justify-end bg-fg' : 'justify-start bg-edge'"
            @click="save({ fakeSaves: !current.fakeSaves })"
          ><span class="size-[18px] rounded-full" :class="current.fakeSaves ? 'bg-ink' : 'bg-muted'" /></button>
        </div>
        <div class="flex items-center gap-4 border-b border-line py-4">
          <div class="flex min-w-0 flex-1 flex-col"><span>Voice</span><span class="text-muted">Made on this Mac. Script text never leaves it.</span></div>
          <label for="voice" class="sr-only">Voice</label>
          <select id="voice" :value="current.voice" class="h-[34px] rounded-lg border border-edge bg-field px-2.5 text-fg" @change="save({ voice: ($event.target as HTMLSelectElement).value })">
            <option v-for="v in VOICES" :key="v">{{ v }}</option>
          </select>
        </div>
        <p v-if="problem || signin?.state === 'error'" class="m-0 mt-4 text-rec">{{ problem || signin?.error }}</p>
        <div class="pt-5">
          <button class="h-[34px] border-0 bg-transparent p-0 text-rec" @click="remove">Remove {{ current.name }} from the studio</button>
        </div>
      </main>
      <main v-else class="flex-1 text-muted">No apps yet. <NuxtLink to="/connect" class="text-fg">Connect one</NuxtLink>.</main>
    </div>
  </div>
</template>
