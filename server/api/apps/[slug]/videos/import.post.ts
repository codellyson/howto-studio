import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// A script written elsewhere. A skill table (rows starting "| L01 |") is used as it is. A plain list of lines
// becomes the voice, one line each, and the agent writes what happens on screen from the code.
export default defineEventHandler(async (event) => {
  const app = appOr404(getRouterParam(event, 'slug'))
  const body = await readBody<{ text?: string, name?: string }>(event)
  const text = String(body?.text ?? '').replace(/\r\n?/g, '\n').trim()
  if (text.length > 20000) throw createError({ statusCode: 400, statusMessage: 'Keep the script under 20,000 characters' })
  const rows = text.split('\n').filter(l => /^\|\s*L\d+\s*\|/.test(l))
  const heading = text.match(/^#\s+(.+)$/m)?.[1]?.split(' / ').pop()?.trim()
  if (rows.length) {
    if (rows.some(r => r.split('|').length < 4)) throw createError({ statusCode: 400, statusMessage: 'Each row needs a line number, what is on screen, and the voice line' })
    const name = String(body?.name ?? '').trim() || heading || 'Imported script'
    const guide = newGuide(app.slug, name)
    const doc = /^#\s/m.test(text) ? text : `# ${app.name} / ${name}\n\n| Line | On screen | Voice |\n|---|---|---|\n${rows.join('\n')}`
    writeFileSync(join(appDir(app.slug), 'scripts', guide, 'script.md'), doc + '\n')
    writeFileSync(join(appDir(app.slug), 'scripts', guide, 'task.txt'), name)
    return { guide }
  }
  // Plain lines: drop bullets, numbers and blank lines.
  const lines = text.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)]|L\d+[:.)]?)\s*/i, '').trim()).filter(Boolean)
  if (lines.length < 2) throw createError({ statusCode: 400, statusMessage: 'Paste at least two lines, one per step' })
  if (lines.length > 30) throw createError({ statusCode: 400, statusMessage: 'Keep it to 30 lines or fewer' })
  if (busy(key(app.slug))) throw createError({ statusCode: 409, statusMessage: 'The code is still being read. Try again in a moment.' })
  const name = String(body?.name ?? '').trim() || lines[0]!
  const guide = newGuide(app.slug, name)
  writeFileSync(join(appDir(app.slug), 'scripts', guide, 'task.txt'), name)
  startScript(app, guide, `${name}
Imported script. Use these voice lines as written, in this order, one script line each. Change a line only where it breaks a script rule (for example, longer than one caption line), and say what you changed in notes.md. Write the On screen column from the code.
${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`)
  return { guide }
})
