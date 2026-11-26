<script setup lang="ts">
import { PhCode, PhDesktop, PhFolderOpen, PhGlobeSimple, PhTerminal, PhLockSimple, PhTrash, PhWaveform, PhCheck, PhSpeakerHigh, PhX } from '@phosphor-icons/vue'

type App = { slug: string, name: string, repo: string, site: string, mode?: 'live' | 'local', start?: string, build?: string, serve?: string, voice: string, say?: Record<string, string>, fakeSaves: boolean, signedIn?: boolean, summary?: { signIn: string } }

const route = useRoute()
const apps = ref<App[] | null>(null)
const current = computed(() => apps.value?.find(a => a.slug === route.query.app) ?? apps.value?.[0])
const problem = ref('')
const signin = ref<{ state: string, steps?: string[], error?: string } | null>(null)
type Field = 'repo' | 'site' | 'start' | 'build' | 'serve'
const editing = ref<Field | ''>('')
const draft = ref('')
const confirmRemove = ref(false)
// An app filmed on this Mac also has the commands that build and serve its production version, and its dev command.
const fields = computed(() => (current.value?.mode === 'local' ? ['repo', 'build', 'serve', 'start', 'site'] : ['repo', 'site']) as Field[])
const LABELS = computed(() => ({ repo: 'Code folder', build: 'Production build', serve: 'Serve the build (on {port})', start: 'Dev command, used when there is no build', site: current.value?.mode === 'local' ? 'Address on this Mac' : 'Site to film' }))
const ICONS = computed(() => ({ repo: PhCode, build: PhTerminal, serve: PhTerminal, start: PhTerminal, site: current.value?.mode === 'local' ? PhDesktop : PhGlobeSimple }))
const EMPTY: Partial<Record<Field, string>> = { build: 'Not set. The dev server is filmed instead.', serve: 'Not set. The dev server is filmed instead.' }
const VOICES = ['Heart', 'Bella', 'Emma', 'Michael', 'George', 'Adam']

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

function edit(field: Field) {
  draft.value = current.value?.[field] ?? ''
  editing.value = field
}
async function commit() {
  const field = editing.value
  if (!field) return
  if (draft.value.trim() === current.value?.[field]) { editing.value = ''; return }
  if (await save({ [field]: draft.value.trim() })) editing.value = ''
}

// Pronunciations: how the voice says a word, kept per app. Captions keep the real spelling.
const word = ref('')
const sound = ref('')
const hearing = ref('')
let clip: HTMLAudioElement | undefined
async function hear(text: string) {
  if (!current.value || !text.trim()) return
  problem.value = ''
  hearing.value = text
  try {
    const blob = await $fetch<Blob>(`/api/apps/${current.value.slug}/say`, { method: 'POST', body: { text }, responseType: 'blob' })
    clip?.pause()
    clip = new Audio(URL.createObjectURL(blob))
    await clip.play()
  } catch (e) { problem.value = errorText(e) } finally { hearing.value = '' }
}
async function addSay() {
  if (!word.value.trim() || !sound.value.trim()) return
  if (await save({ say: { ...current.value?.say, [word.value.trim()]: sound.value.trim() } })) { word.value = ''; sound.value = '' }
}
async function dropSay(w: string) {
  const say = { ...current.value?.say }
  delete say[w]
  await save({ say })
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

        <div v-for="f in fields" :key="f" class="flex items-center gap-4 border-b border-line py-4">
          <component :is="ICONS[f]" :size="16" class="flex-none" />
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <span>{{ LABELS[f] }}</span>
            <form v-if="editing === f" class="flex gap-2" @submit.prevent="commit">
              <input v-model="draft" class="field min-w-0 flex-1" :aria-label="LABELS[f]" autofocus @keydown.esc="editing = ''">
              <button v-if="f === 'repo'" type="button" class="btn btn-secondary" @click="chooseRepo"><PhFolderOpen :size="16" />Choose…</button>
              <button class="btn btn-primary">Save</button>
              <button type="button" class="btn btn-plain" @click="editing = ''">Cancel</button>
            </form>
            <span v-else class="truncate text-[13px] text-muted" :class="{ 'font-mono': f !== 'repo' && f !== 'site' && current[f] }">{{ current[f] || EMPTY[f] }}</span>
          </div>
          <button v-if="editing !== f" type="button" class="btn btn-secondary" @click="edit(f)">Change</button>
        </div>

        <div class="flex items-center gap-4 border-b border-line py-4">
          <PhLockSimple :size="16" class="flex-none" />
          <div class="flex min-w-0 flex-1 flex-col">
            <span>Sign-in</span>
            <span class="text-[13px] text-muted">{{ signin?.state === 'working' ? (signin.steps?.at(-1)?.startsWith('Starting') ? `${signin.steps.at(-1)}…` : 'A browser window is open. Sign in there.') : current.signedIn ? 'Signed in. The session is kept for filming.' : `Not signed in. ${current.summary?.signIn ?? ''} Needed only for videos behind the sign-in.` }}</span>
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

        <div class="flex flex-col gap-3 border-b border-line py-4">
          <div class="flex items-center gap-4">
            <PhSpeakerHigh :size="16" class="flex-none" />
            <div class="flex min-w-0 flex-1 flex-col"><span>Pronunciations</span><span class="text-[13px] text-muted">Words the voice says wrong, spelt the way they sound. Captions keep the real spelling. Remake a video to hear it there.</span></div>
          </div>
          <ul v-if="Object.keys(current.say ?? {}).length" class="m-0 ml-8 flex list-none flex-col p-0">
            <li v-for="(v, w) in current.say" :key="w" class="flex h-9 items-center gap-3 text-[14px]">
              <span class="w-40 truncate font-medium">{{ w }}</span>
              <span class="min-w-0 flex-1 truncate text-muted">said “{{ v }}”</span>
              <button type="button" class="btn btn-plain btn-icon h-7 w-7" :aria-label="`Hear ${w}`" title="Hear it" :disabled="!!hearing" @click="hear(v)"><PhSpeakerHigh :size="14" /></button>
              <button type="button" class="btn btn-plain btn-icon h-7 w-7" :aria-label="`Remove ${w}`" title="Remove" @click="dropSay(String(w))"><PhX :size="14" /></button>
            </li>
          </ul>
          <form class="ml-8 flex flex-wrap gap-2" @submit.prevent="addSay">
            <label for="say-word" class="sr-only">Word</label>
            <input id="say-word" v-model="word" maxlength="40" placeholder="Word, e.g. Khaime" class="field w-40">
            <label for="say-sound" class="sr-only">Said as</label>
            <input id="say-sound" v-model="sound" maxlength="60" placeholder="Said as, e.g. Kai-mee" class="field min-w-0 flex-1">
            <button type="button" class="btn btn-secondary" :disabled="!sound.trim() || !!hearing" @click="hear(sound)"><PhSpeakerHigh :size="16" />{{ hearing === sound && sound ? 'Playing' : 'Hear' }}</button>
            <button class="btn btn-primary" :disabled="!word.trim() || !sound.trim()">Add</button>
          </form>
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
