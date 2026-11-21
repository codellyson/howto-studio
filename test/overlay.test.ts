import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

// The skill's overlay module draws both the studio preview and the video.
const O = createRequire(import.meta.url)(join(process.env.HOWTO_SKILL || join(homedir(), '.claude/skills/howto-video'), 'scripts', 'overlay.cjs'))

test('a look keeps known choices and drops the rest', () => {
  const look = O.cleanLook({ caption: { font: 'rounded', size: 'huge' }, cursor: { color: '#dc2626', shape: '<b>' } })
  assert.equal(look.caption.font, 'rounded')
  assert.equal(look.caption.size, 'm')
  assert.equal(look.cursor.color, '#dc2626')
  assert.equal(look.cursor.shape, 'arrow')
})

test('marks sit on the element the line clicked, and text is escaped', () => {
  const look = O.cleanLook({})
  const targets = [{ name: 'Next spread', box: { x: 100, y: 200, w: 30, h: 30 } }]
  const html = O.layerHtml(look, 'Click <here>', [{ line: 'L02', kind: 'ring', target: 0, text: '' }, { line: 'L02', kind: 'label', target: 0, text: '' }, { line: 'L02', kind: 'ring', target: 5, text: '' }], targets)
  assert.match(html, /Click &lt;here&gt;/)
  assert.match(html, /class="g-ring" style="left:94px;top:194px;width:42px;height:42px"/)
  assert.match(html, /class="g-label" style="left:115px;top:186px">Next spread</)
  assert.equal(html.match(/g-ring/g)?.length, 1)
})

test('pins with an unknown kind or line are dropped', () => {
  assert.deepEqual(O.cleanPins([{ line: 'L01', kind: 'ring' }, { line: 'x', kind: 'ring' }, { line: 'L02', kind: 'blur' }]), [{ line: 'L01', kind: 'ring', target: 0, text: '' }])
})

test('a framed capture keeps its shape and leaves room for the browser bar', () => {
  const look = O.cleanLook({ frame: { style: 'browser', padding: 'm' } })
  const b = O.frameBox(look, [1440, 900])
  assert.ok(Math.abs(b.w / b.h - 1.6) < 0.01)
  assert.equal(b.bar, 40)
  assert.ok(b.y - b.bar >= 0 && b.y + b.h <= 900)
  assert.deepEqual(O.frameBox(O.cleanLook({}), [1440, 900]), { x: 0, y: 0, w: 1440, h: 900, bar: 0, radius: 0 })
})

test('zoom eases in on a small clicked element, out just after the click, and stays inside the capture', () => {
  const look = O.cleanLook({ frame: { zoom: 'on' } })
  const lines = [{ id: 'L01', t: 0, len: 2 }, { id: 'L02', t: 3, len: 6 }]
  const w = O.zoomWindows(look, lines, [{ line: 'L02', t: 5, box: { x: 1400, y: 880, w: 20, h: 20 } }])
  assert.equal(w.length, 1)
  assert.equal(O.zoomAt(w, 1, [1440, 900]).z, 1)
  const mid = O.zoomAt(w, 4.9, [1440, 900])
  assert.equal(mid.z, 1.4)
  assert.equal(Math.round(mid.x + 1440 / mid.z), 1440)
  // The click changes the page, so the zoom is gone well before the line ends.
  assert.equal(O.zoomAt(w, 6.5, [1440, 900]).z, 1)
  // A big target (a text box) is readable already.
  assert.equal(O.zoomWindows(look, lines, [{ line: 'L02', t: 5, box: { x: 0, y: 0, w: 700, h: 300 } }]).length, 0)
  assert.equal(O.zoomWindows(O.cleanLook({}), [{ id: 'L02', t: 3, len: 4 }], [{ line: 'L02', box: { x: 0, y: 0, w: 1, h: 1 } }]).length, 0)
})

test('the bar caption shows the step and lines up with the framed capture', () => {
  const look = O.cleanLook({ frame: { style: 'framed', padding: 'm' } })
  const html = O.captionHtml(look, 'Click New.', { n: 3, of: 10 }, [1280, 800])
  assert.match(html, /<span class="g-step">3 \/ 10<\/span><span>Click New.<\/span>/)
  assert.match(html, new RegExp(`left:${O.frameBox(look, [1280, 800]).x + 16}px`))
})
