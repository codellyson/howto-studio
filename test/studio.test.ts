import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.STUDIO_HOME = mkdtempSync(join(tmpdir(), 'studio-test-'))
const { readScript, setLineVoice, appDir, slugify, videoStatus, jobs, HOME } = await import('../server/utils/studio.ts')

const SCRIPT = `# Smalbum / Review and approve your album

## Script

| Shot | On screen | Voiceover |
|---|---|---|
| L01 | Album open. | Your photographer sent you a link. |
| L09 | Approve album in the question. (one-way) | Click Approve album again to confirm. |
`

test('reads the title and lines of a skill script', () => {
  const dir = join(appDir('smalbum'), 'scripts', 'review')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'script.md'), SCRIPT)
  const s = readScript('smalbum', 'review')
  assert.equal(s.title, 'Review and approve your album')
  assert.deepEqual(s.lines.map(l => l.id), ['L01', 'L09'])
  assert.equal(s.lines[1]!.screen, 'Approve album in the question. (one-way)')
  assert.equal(s.lines[1]!.voice, 'Click Approve album again to confirm.')
  assert.equal(videoStatus('smalbum', 'review'), 'draft')
})

test('rewrites only the voice cell of one line, keeping the table valid', () => {
  setLineVoice('smalbum', 'review', 'L01', 'Your photographer | sent\na link.')
  const text = readFileSync(join(appDir('smalbum'), 'scripts', 'review', 'script.md'), 'utf8')
  assert.match(text, /^\| L01 \| Album open\. \| Your photographer sent a link\. \|$/m)
  assert.match(text, /^\| L09 \| Approve album in the question\. \(one-way\) \| Click Approve album again to confirm\. \|$/m)
})

test('a job left running by an earlier studio ends when its process is gone', () => {
  mkdirSync(join(HOME, '.jobs'), { recursive: true })
  const stale = { kind: 'record', state: 'working', steps: ['Filming the take'], started: 1, pid: 2 ** 22 + 7, detached: true }
  writeFileSync(join(HOME, '.jobs', 'smalbum__review.json'), JSON.stringify(stale))
  const job = jobs.get('smalbum/review')!
  assert.equal(job.state, 'error')
  assert.match(job.error!, /restarted/)
  const live = { ...stale, pid: process.pid }
  writeFileSync(join(HOME, '.jobs', 'smalbum__other.json'), JSON.stringify(live))
  assert.equal(jobs.get('smalbum/other')!.state, 'working')
})

test('a job another studio already finished is not marked as interrupted', async () => {
  const { spawn } = await import('node:child_process')
  const child = spawn('sleep', ['0.3'])
  const k = 'smalbum/shared'
  const running = { kind: 'connect', state: 'working', steps: [], started: 1, pid: child.pid, detached: true }
  writeFileSync(join(HOME, '.jobs', 'smalbum__shared.json'), JSON.stringify(running))
  assert.equal(jobs.get(k)!.state, 'working')
  // The other studio sees the run end and writes that down; then this one notices the process is gone.
  writeFileSync(join(HOME, '.jobs', 'smalbum__shared.json'), JSON.stringify({ ...running, state: 'done' }))
  await new Promise(r => child.on('exit', r))
  assert.equal(jobs.get(k)!.state, 'done')
})

test('slugs are safe folder names', () => {
  assert.equal(slugify('  How a client approves!! '), 'how-a-client-approves')
  assert.equal(slugify('***'), 'item')
})
