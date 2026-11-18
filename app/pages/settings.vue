<script setup lang="ts">
import { PhCode, PhFolderOpen, PhGlobeSimple, PhLockSimple, PhTrash, PhWaveform, PhCheck } from '@phosphor-icons/vue'

type App = { slug: string, name: string, repo: string, site: string, voice: string, fakeSaves: boolean, signedIn?: boolean, summary?: { signIn: string } }

const route = useRoute()
const apps = ref<App[] | null>(null)
const current = computed(() => apps.value?.find(a => a.slug === route.query.app) ?? apps.value?.[0])
const problem = ref('')
const signin = ref<{ state: string, error?: string } | null>(null)
const editing = ref<'repo' | 'site' | ''>('')
const draft = ref('')
const confirmRemove = ref(false)
const VOICES = ['Michael', 'Adam', 'Heart', 'Bella', 'George', 'Emma']

async function load() {
  const list = await $fetch<{ slug: string }[]>('/api/apps')
  apps.value = await Promise.all(list.map(a => $fetch<App>(`/api/apps/${a.slug}`)))
}
onMounted(load)
watch(() => route.query.app, () => { editing.value = ''; signin.value = null })

async function save(patch: Partial<App>) {
  if (!current.value) return false
  problem.value = ''
  try {
    const url: string = `/api/apps/${current.value.slug}`
    Object.assign(current.value, await $fetch<App>(url, { method: 'PATCH', body: patch }))
    return true
  } catch (e) { problem.value = errorText(e); return false }
}

// The code folder changes through the Mac's folder dialog; typing a path stays possible.
async function chooseRepo() {
  try {
    const p = await pickFolder(current.value?.repo)
    if (p) { draft.value = p; await commit() }
  } catch (e) { problem.value = errorText(e) }
}

function edit(field: 'repo' | 'site') {
  draft.value = current.value?.[field] ?? ''
  editing.value = field
}
async function commit() {
  const field = editing.value
  if (!field) return
  if (draft.value.trim() === current.value?.[field]) { editing.value = ''; return }
  if (await save({ [field]: draft.value.trim() })) editing.value = ''
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
  confirmRemove.value = false
  if (!app) return
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
        <NuxtLink
          v-for="a in apps ?? []" :key="a.slug" :to="`/settings?app=${a.slug}`"
          class="flex h-7 items-center px-2 text-[13px] no-underline hover:bg-hover" :class="a.slug === current?.slug ? 'bg-surface font-medium' : 'text-muted'"
        >{{ a.name }}</NuxtLink>
      </nav>

      <main v-if="current" class="flex min-w-0 flex-[999_1_520px] flex-col">
        <h1 class="m-0 mb-2 font-serif text-[30px] leading-[1.15] font-medium tracking-[-0.01em]">{{ current.name }}</h1>

        <div v-for="f in (['repo', 'site'] as const)" :key="f" class="flex items-center gap-4 border-b border-line py-4">
          <component :is="f === 'repo' ? PhCode : PhGlobeSimple" :size="16" class="flex-none" />
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <span>{{ f === 'repo' ? 'Code folder' : 'Site to film' }}</span>
            <form v-if="editing === f" class="flex gap-2" @submit.prevent="commit">
              <input v-model="draft" class="field min-w-0 flex-1" :aria-label="f === 'repo' ? 'Code folder' : 'Site to film'" autofocus @keydown.esc="editing = ''">
              <button v-if="f === 'repo'" type="button" class="btn btn-secondary" @click="chooseRepo"><PhFolderOpen :size="16" />Choose…</button>
              <button class="btn btn-primary">Save</button>
              <button type="button" class="btn btn-plain" @click="editing = ''">Cancel</button>
            </form>
            <span v-else class="truncate text-[13px] text-muted">{{ current[f] }}</span>
          </div>
          <button v-if="editing !== f" type="button" class="btn btn-secondary" @click="edit(f)">Change</button>
        </div>

        <div class="flex items-center gap-4 border-b border-line py-4">
          <PhLockSimple :size="16" class="flex-none" />
          <div class="flex min-w-0 flex-1 flex-col">
            <span>Sign-in</span>
            <span class="text-[13px] text-muted">{{ signin?.state === 'working' ? 'A browser window is open. Sign in there.' : current.signedIn ? 'Signed in. The session is kept for filming.' : `Not signed in. ${current.summary?.signIn ?? ''} Needed only for videos behind the sign-in.` }}</span>
          </div>
          <span v-if="current.signedIn && signin?.state !== 'working'" class="pill" aria-label="Signed in"><PhCheck :size="14" /></span>
          <button type="button" class="btn btn-secondary" :disabled="signin?.state === 'working'" @click="signIn">{{ current.signedIn ? 'Sign in again' : 'Sign in' }}</button>
        </div>

        <div class="flex items-center gap-4 border-b border-line py-4">
          <PhCheck :size="16" class="flex-none" />
          <div class="flex min-w-0 flex-1 flex-col"><span id="fake-label">Answer saves in the browser</span><span class="text-[13px] text-muted">Nothing real changes while filming. Keep this on for live sites.</span></div>
          <button
            type="button" role="switch" :aria-checked="current.fakeSaves" aria-labelledby="fake-label"
            class="flex h-[22px] w-10 cursor-pointer items-center border border-ink p-0.5" :class="current.fakeSaves ? 'justify-end bg-ink' : 'justify-start bg-page'"
            @click="save({ fakeSaves: !current.fakeSaves })"
          ><span class="size-4" :class="current.fakeSaves ? 'bg-page' : 'bg-ink'" style="transition: none" /></button>
        </div>

        <div class="flex items-center gap-4 border-b border-line py-4">
          <PhWaveform :size="16" class="flex-none" />
          <div class="flex min-w-0 flex-1 flex-col"><span>Voice</span><span class="text-[13px] text-muted">Made on this Mac. The script never leaves it.</span></div>
          <label for="voice" class="sr-only">Voice</label>
          <select id="voice" :value="current.voice" class="field pr-8" @change="save({ voice: ($event.target as HTMLSelectElement).value })">
            <option v-for="v in VOICES" :key="v">{{ v }}</option>
          </select>
        </div>

        <p v-if="problem || signin?.state === 'error'" class="m-0 mt-4 text-rec" role="alert">{{ problem || signin?.error }}</p>
        <div class="mt-6 border-t border-line pt-6">
          <button type="button" class="btn btn-plain px-0 text-rec hover:bg-transparent" @click="confirmRemove = true"><PhTrash :size="16" />Remove {{ current.name }} from the studio</button>
        </div>
      </main>
      <main v-else-if="apps" class="flex-1 text-muted">No apps yet. <NuxtLink to="/connect">Connect one</NuxtLink>.</main>
    </div>

    <ConfirmDialog
      :open="confirmRemove" :title="`Remove ${current?.name} from the studio?`"
      body="Its folder is kept on disk, renamed, so its videos can still be found." action="Remove" danger
      @confirm="remove" @cancel="confirmRemove = false"
    />
  </div>
</template>
