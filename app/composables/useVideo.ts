export type Line = { id: string, screen: string, voice: string }
export type Overlay = {
  restyle: boolean
  look: { caption: Record<string, string>, cursor: Record<string, string>, frame: Record<string, string> }
  scope: 'app' | 'video'
  choices: Record<string, Record<string, string[]>>
  pins: { line: string, kind: 'ring' | 'label' | 'arrow', target: number, text: string }[]
  css: string
  size: [number, number] | null
  backgrounds: Record<string, string>
  lines: Record<string, { html: string, targets: string[] }>
  stale?: boolean
}
export type Video = {
  app: { slug: string, name: string }
  guide: string
  title: string
  lines: Line[]
  recorded: { duration: number, lines: { id: string, t: number, len: number }[] } | null
  status: string
  notes: string
  job: { kind: string, state: string, steps: string[], error?: string } | null
  overlay?: Overlay
}

// The video a page shows, refreshed while the agent works on it.
export function useVideo() {
  const route = useRoute()
  const slug = String(route.params.slug)
  const guide = String(route.params.guide)
  const base = `/api/apps/${slug}/videos/${guide}`
  const poll = usePoll<Video>(() => base, v => !v || v.job?.state === 'working')
  const frame = (id: string) => poll.data.value?.recorded?.lines.some(l => l.id === id) ? `${base}/frame/${id}.jpg?v=${poll.data.value.recorded.duration}` : null
  const lengths = computed(() => Object.fromEntries((poll.data.value?.recorded?.lines ?? []).map(l => [l.id, l.len])))
  // The script marks lines that click a control which can't be undone with "(one-way)" in its On screen cell.
  const oneWayLines = computed(() => (poll.data.value?.lines ?? []).filter(l => /one-way/i.test(l.screen)).map(l => l.id))
  return { slug, guide, base, ...poll, frame, lengths, oneWayLines }
}
