import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

// The likely dev command and address for a code folder, to prefill "On this Mac".
export default defineEventHandler(async (event) => {
  const raw = String((await readBody<{ repo?: string }>(event))?.repo ?? '').trim()
  const repo = resolve(raw.replace(/^~(?=\/|$)/, homedir()))
  if (!raw || !existsSync(repo)) return null
  return detectLocal(repo)
})
