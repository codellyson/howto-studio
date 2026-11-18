import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'

// The Mac's own folder dialog, shown by the frontmost app (the studio window or the browser).
// Answers { path: null } when the person cancels.
export default defineEventHandler(async (event) => {
  const start = String((await readBody<{ start?: string }>(event))?.start ?? '')
  const from = start && existsSync(start) ? ` default location POSIX file ${JSON.stringify(start)}` : ''
  const script = `tell application (path to frontmost application as text) to POSIX path of (choose folder with prompt "Choose the app's code folder"${from})`
  return await new Promise<{ path: string | null }>((resolve, reject) => {
    execFile('osascript', ['-e', script], (err, stdout, stderr) => {
      if (!err) return resolve({ path: stdout.trim().replace(/\/$/, '') || null })
      if (/-128|cancel/i.test(stderr)) return resolve({ path: null })
      reject(createError({ statusCode: 500, statusMessage: `The folder window could not open. ${stderr.trim().split('\n').at(-1) ?? ''}`.trim() }))
    })
  })
})
