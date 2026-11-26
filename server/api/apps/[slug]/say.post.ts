import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A short clip of the app's voice saying some words, to hear a pronunciation before saving it.
export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const text = String((await readBody<{ text?: string }>(event))?.text ?? '').replace(/[\n\r]/g, ' ').trim().slice(0, 120)
  if (!text) throw createError({ statusCode: 400, statusMessage: 'Type how it should sound' })
  const dir = mkdtempSync(join(tmpdir(), 'howto-say-'))
  try {
    execFileSync('python3', [join(SKILL, 'scripts', 'voice.py'), '--sample', text, VOICES[app.voice] ?? 'af_heart', join(dir, 'say.wav')], { timeout: 60000 })
    setHeader(event, 'content-type', 'audio/wav')
    return readFileSync(join(dir, 'say.wav'))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
