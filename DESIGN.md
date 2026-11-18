# How-to Studio design

The look of How-to Studio, decided one question at a time. Every entry says what was chosen, the exact values, and what was rejected.

Status: **all eleven locked on 2026-11-18.** Boards are kept in the session scratchpad; the decisions below are the source of truth.

In short: black on white, with Newsreader for the words a person reads and Inter for everything else. Square, hairline outlines, no shadows. A two-column script and stage, where the script uses film slates, the frame carries its line as a subtitle, and a timing strip sits under the frame. Things that arrive spring in, and the app talks like a reporter.

Already tried during the mock (2026-11-18), before this walkthrough: a flat light screen ("plain, looks flat"), a colourful wallpaper look ("too colourful"), and an editor with an agent panel and a three-track timeline ("too busy"). The Storyboard editor (one big frame, its line as a subtitle, a strip of frames sized by line length) was picked over a teleprompter and a contact sheet.

## 1. Colour (locked)

**Black on white.** The page is white, actions are black, and everything else is grey. The footage is the only full colour on screen.

Light (default):

| Token | Hex | Use |
|---|---|---|
| page | `#FFFFFF` | window background |
| surface | `#F2F2F3` | pills, chips, a selected row |
| text | `#111111` | titles, subtitles, line text |
| muted | `#6B6B70` | crumbs, meta, secondary text |
| line | `#E2E2E5` | borders, frame edges |
| line-strong | `#C4C4C8` | separators like the crumb slash |
| primary | `#111111` on `#FFFFFF` text | the one primary button per view, the selected-frame ring |
| record | `#DC2626` | the record dot, the "Recording" mark, failed status |
| one-way | `#B45309` | the mark on lines that can't be undone, and their meta text |

Dark (follows the macOS setting, uses the mock's graphite values): page `#0E0E10`, surface `#1C1C20`, text `#ECECEE`, muted `#8A8A93`, line `#2A2A30`, line-strong `#45454C`, primary `#ECECEE` on `#0E0E10` text, record `#E5484D`, one-way `#E3B66A`.

Rules:
- Statuses: only **failed** gets colour (record red). Up to date, script changed and filming are text in muted or text colour. Red therefore means two things only: recording, and something went wrong.
- Amber means only "this click can't be undone". It is never used for warnings or emphasis.
- No other hues anywhere in the chrome. No gradients.

Rejected: 1 Graphite as the default (it stays as the dark mode), 3 Warm paper, 4 Graphite with red as the brand.

## 2. Typography (locked)

**Newsreader for titles and the spoken line, Inter for everything else.** The script is the product, so the words the voice says are set like a script. The chrome stays in plain sans.

| Level | Face | Size / weight / tracking | Line height |
|---|---|---|---|
| Page title (video or app name) | Newsreader | 30px / 500 / -0.01em | 1.15 |
| Spoken line, editor subtitle | Newsreader | 24px / 500 / -0.005em | 1.3 |
| Spoken line in lists and the strip | Newsreader | 15px / 400 | 1.4 |
| Section heading | Inter | 15px / 600 | 1.4 |
| Body, buttons, fields | Inter | 14px / 400 (buttons 500–600) | 1.5 |
| Rows (video list, settings) | Inter | 14px / 500 title, 13px / 400 meta | 1.4 |
| Meta (line number, length, status) | Inter | 12px / 400, muted | 1.4 |

Rules:
- Load Newsreader (opsz 6–72, weights 400 and 500) and Inter (400, 500, 600) from Google Fonts. The Mac app bundles both.
- No monospace anywhere. Line numbers, lengths and times use Inter with `font-variant-numeric: tabular-nums`. File and code names (`takes.cjs`, routes) sit in a chip: Inter 12px, surface background, 4px radius, 1px 6px padding.
- Newsreader is only for things a person reads as words: titles and spoken lines. It is never used on buttons, meta, numbers or settings.

Rejected: 1 Inter + JetBrains Mono, 2 SF Pro, 3 Geist + Geist Mono.

## 3. Layout (locked)

**Script and stage.** The editor is two columns. On the left is the whole script as a list of lines in Newsreader. On the right is the stage: the selected line's frame, with its meta under it.

- Header (52px): breadcrumb on the left (`App / Video title`); actions on the right, with the secondary actions first and the one primary button last (Watch, then **Record**). "Ask for a change" is a field in the header, before the actions.
- Script column: 42% of the width, clamped to 380–520px, with a 1px `line` divider on its right. Each line shows its number (Inter 12px, muted, tabular) and its words. The selected line gets the `surface` background. Clicking a line selects it, and clicking a selected line edits its words in place.
- Stage: fills the rest. The frame is centred, as wide as the stage allows up to 860px. Its meta sits centred under it (`08 · 2.4 s` and any one-way note).
- Navigation: the breadcrumb only. There is no sidebar. Home and Library are their own screens.
- Same layout on the other video screens:
  - Recording: the left column ticks lines off as they are filmed; the stage shows what the agent is doing.
  - Review: the left column becomes chapters with timestamps; the stage is the video player.
- States:
  - Writing the script: the script column shows the agent's progress lines, and the stage shows an empty frame.
  - Failed: one line of red text under the header, with what went wrong.
  - Not filmed yet: the stage shows an empty frame with the line's "On screen" text in muted.

Rejected: 1 Stage and strip (the strip is reconsidered as the signature, question 7), 3 Storyboard cards, 4 Three panes.

## 4. Shape (locked)

**Square.** It looks like a printed shooting script: square corners, hairline rules, no shadows.

- Radius: `0` on everything, including buttons, fields, pills, chips, rows, frames, dialogs and menus. The only round things are the record dot and other status dots (`50%`).
- Rules (light; in dark mode `text` replaces `#111111`):
  - Objects you act on or look at have a `1px solid #111111` outline: secondary buttons, fields, status pills, frames, dialogs and menus.
  - Layout dividers (between header and body, between script and stage, between list groups) are `1px solid #E2E2E5`, so the page structure stays quieter than the objects.
- Fills: the primary button is solid `#111111`. A selected row or line is `#F2F2F3` with no outline. Hover is `#F7F7F8`.
- Shadows: none, anywhere. A dialog sits on a backdrop of `rgba(255,255,255,0.85)` (dark: `rgba(14,14,16,0.85)`) with its black outline.
- Focus: `2px solid #111111` outline, offset 2px, square.

Rejected: 1 Sharp (4px, grey borders), 2 Soft (8/12px with a shadow), 3 Round (pills, 16px cards).

## 5. Spacing and density (locked)

**Comfortable, with 8px between lines.** Each script line reads as its own shot.

- Scale: `4, 8, 12, 16, 24, 32, 48` px. Nothing outside it.
- Header: 52px tall, 16px side padding.
- Controls (buttons, fields, pills): 32px tall, 12px side padding. Small chips are 20px.
- Script lines: at least 36px tall, 8px top and bottom padding, 10px sides, 10px between the number and the words.
- **The gap between sibling lines and rows is 8px.** Selected and hover fills never touch.
- The gap between groups is 24px, with a grey divider line.
- Panel padding: 16px. The stage has 24px around the frame.
- Menus: 28px items with 2px between them. Menus are tighter than content lists.

Rejected: 1 Compact (2px gap, fills touch), 2 Comfortable with a 4px gap, 4 Airy (12px gap; a 9-line script no longer fits).

## 6. Icons (locked)

**Phosphor, regular weight** (`@phosphor-icons/vue`, or `ph:` names through Iconify).

| Use | Icon |
|---|---|
| Watch / play | `ph:play` |
| Edit a line | `ph:pencil-simple` |
| Ask for a change | `ph:chat-circle` |
| Settings | `ph:gear-six` |
| Back | `ph:caret-left` |
| Add (connect an app, new video) | `ph:plus` |
| Show in Finder | `ph:folder-open` |
| Up to date | `ph:check` |
| Failed | `ph:warning-circle` (in record red) |
| Script changed | `ph:clock` |
| Sign-in | `ph:lock-simple` |
| Code folder | `ph:code` |
| Site | `ph:globe-simple` |
| Record again | `ph:arrow-counter-clockwise` |
| Remove | `ph:trash` |
| Voice | `ph:waveform` |
| Working | `ph:circle-notch`, spinning |
| Listened | `ph:headphones` |

Rules:
- Record is never an icon. It is the 8px red dot.
- Sizes: 16px in buttons and rows, 15px beside status text, 20px when an icon stands alone (an icon-only button is 32×32).
- Colour is always `currentColor`. The only exception is failed, which takes record red with its text.
- The fill weight is used only for a selected, toggled state. Nothing is filled by default.
- An icon-only button always has an `aria-label`.

Rejected: 1 Lucide, 3 Heroicons outline, 4 Phosphor thin (too faint at 15–16px).

## 7. Signature element (locked)

**Slates, subtitles and the timing strip together.** The editor looks like a shooting script with its film beside it.

- **Slates.** Every line number is a slate: Inter 600, 11px, +0.04em tracking, tabular figures, 1px `#111111` outline, `2px 6px` padding, square. The selected line's slate is solid black with white figures. The meta under the frame says `SHOT 08 · 2.4 s`.
- **Subtitle.** The frame carries its spoken line as a burned-in subtitle: Newsreader 500, 16px at a 860px frame (it scales with the frame), white on `rgba(17,17,17,0.88)`, square, `4px 10px` padding, centred, 12px from the bottom. It is the same caption the finished video shows.
- **Timing strip.** One frame per line, under the stage, each as wide as its line plays (`flex-grow` = seconds). Unselected frames are at 55% opacity with a 1px `#C4C4C8` outline; the selected one is at 100% with a 1px `#111111` outline plus a 1px outer ring. Lines that can't be undone carry the 6px amber dot in the corner.

Where:
- In the Editor, Recording and Review screens only.
  - Recording: slates tick off, and the strip fills in as frames arrive.
  - Review: the strip is the chapters, with a timestamp under each frame.
- Never on Home, Connect, Library or Settings. Library cards show one cover frame, not a strip.

Data it needs: frames and lengths come from `final/<video>.lines.json` and the finished MP4. Before a video is filmed, the strip shows evenly sized empty slots and the stage shows an empty frame with the subtitle. Lengths are never guessed.

Rejected: 0 nothing, A the strip alone, B slates and subtitles alone.

## 8. Motion (locked)

**Lively.** Things that arrive or get chosen spring into place with a small overshoot. Everything else stays quick and still.

- The spring: `cubic-bezier(0.34, 1.56, 0.64, 1)` at 400ms. It is for selection and arrivals only.
- Selecting a line: the grey highlight springs to the new line, its slate pulses (scale 1, then 1.25, then 1, over 400ms), the old frame dips to 30% and back, and the subtitle swaps.
- Working (filming, writing a script): the record dot or the `ph:circle-notch` pulses or spins (1s loop). Nothing else moves.
- Frames arriving in the strip pop in one by one: scale 0.6 → 1 and opacity 0 → 1 over 400ms on the spring, 380ms apart.
- A result landing (Up to date, Failed, a finished video): it rises 6px and scales 0.8 → 1 on the spring.
- Everyday interactions (hover, focus, menus opening, fields): 150ms `ease` fades only. Nothing moves or springs.
- Pressed buttons scale to 0.96 for 100ms.
- Reduce Motion: every spring and scale becomes a 150ms fade, and pulses stop.

Rejected: 1 Quiet (fades only), 2 Alive (200ms without overshoot).

## 9. Voice (locked)

**Reporter.** Plain statements about the video and the work, with no "I", no "we" and no character. It says what happened and, when it matters, why.

| Moment | Length | Example |
|---|---|---|
| Video finished | 1–2 sentences, past tense | 39 seconds, 9 lines. Filmed on the live site; both saves were answered in the browser, so the album is unchanged. |
| Filming failed | 1–2 sentences: where, then why | Filming stopped at line 6. The Approve album button never appeared, so the take could not go on. |
| Couldn't run | 1 sentence plus the step to take | This video is behind Smalbum's sign-in. Sign in once in Settings, then record. |
| Progress line | A verb in -ing plus its object, no full stop | Reading `decision.post.ts` |
| Empty state | 1–2 sentences, present tense | No videos yet. Describe one task and a script is written from the code. |
| Error | 1 sentence, the fact only | There is no folder at `~/projects/smalbum`. |

Rules:
- Buttons and labels are verbs or nouns in sentence case: "Record", "Record again", "Show in Finder", "Ask for a change…". They are never questions.
- Banned: praise ("Great", "Perfect"), verdicts about the person, exclamation marks, "successfully", "please", "oops", "simply", "just", "AI", "magic", and emoji.
- Numbers are digits; times are `0:39` or `2.4 s`.
- The voice in the videos themselves (the scripts) is a separate thing, set by the skill, and is not covered here.

Change needed outside the UI: the agent's final message is shown when a run fails (`The agent said: …`), and today it speaks in the first person. The prompts in `server/utils/prompts.ts` must ask for a one- or two-sentence reporter-style summary of any failure, and the UI should show that instead of the raw text.

Rejected: 1 First person, 3 Terse log.

## 10. Imagery (locked)

**Plain frame.** The frame as filmed, with a `1px solid #111111` outline, square, no shadow and no browser chrome. The subtitle (section 7) sits on it.

- Videos filmed since 2026-11-18 have a clean take: the editor shows the whole 1440×900 frame and draws the video's own look over it (see "Look tab" in section 11), so the preview is the video.
- Older videos: frames are cropped above the burned-in caption (the bottom 150px of a 1440×900 frame), so the subtitle is never doubled.
- Under the frame, centred: `SHOT 08 · 2.4 s`, plus `· can't be undone` in amber when it applies. Inter 12px, muted.
- Library cards show the last line's frame with the same outline. Home shows the first video's.
- Not filmed yet: an empty frame of the same size, with diagonal stripes (`#FFFFFF` and `#F4F4F5`, 8px bands), "Not filmed yet" and the line's "On screen" text centred in muted. The subtitle still shows.
- Where the data comes from: frames are taken from the finished MP4 at 75% through each line, using `final/<video>.lines.json`. Nothing is shown that the recording did not produce.

Later, if wanted: a zoom on the clicked element (option 3) needs `record.cjs` to log each click's position per line.

Rejected: 2 Square browser frame, 3 Zoom on the click (needs click positions from the recorder), 4 Matted print.

## 11. Components (locked)

The sheet that combines everything above.

- **Buttons.**
  - Primary: `#111111` fill, white Inter 600 14px, 32px tall. The record dot comes first when the button records. Hover is `#2A2A2E`; pressed scales to 0.96 for 100ms. **One primary button per view.**
  - Secondary: white with a 1px `#111111` outline, Inter 500, and an optional 16px icon first.
  - Plain: no outline; `#F7F7F8` on hover. Used for Cancel and quiet actions.
  - Icon-only: 32×32 with an `aria-label`.
  - Disabled: 40% opacity.
- **Status pills.**
  - All are 24px tall, square, with a 1px outline, a 14px icon and Inter 12px text.
  - Settled (Up to date `ph:check`, Script changed `ph:clock`, Not filmed yet): muted text, `#C4C4C8` outline.
  - Working (Writing the script with a spinning `ph:circle-notch`; Recording with the red dot): black text and outline.
  - Failed (`ph:warning-circle`): record red for text and outline.
- **Fields.** 32px tall, a 1px black outline and a muted placeholder. On focus, a 2px black outline offset 2px.
- **Script lines.** As in sections 5 and 7: hover `#F7F7F8`, selected `#F2F2F3` with a black slate, and the amber dot for one-way lines.
- **Video rows.** Inter 14px/500 titles, truncated with an ellipsis; status on the right never wraps.
  - Where the icon already says the status, the row keeps only the extra fact (✓ `0:39`, not "✓ Up to date · 0:39"). Screen readers still get the full status as a label.
  - Failed rows keep their words, in red.
- **Signature block.** The frame with its subtitle, the meta line and the timing strip (section 7).
- **Empty state.**
  - A 1px black-outlined box with a Newsreader 18px headline ("No videos yet."), one muted sentence in reporter voice, and one primary button.
  - The box shows only when there is nothing at all.
- **Confirm dialog.** Used for every confirmation; the browser's `confirm()` and `prompt()` are never used.
  - The box: a 1px black outline, 16px padding, a 15px/600 title asked as a question, and one muted sentence on what happens.
  - Buttons: plain Cancel, then a primary button that repeats the action ("Record again", never "OK").
  - It sits on a backdrop of white at 85%.
- **Look tab.** Beside Script, at the top of the script column; Inter 500 tabs, the active one underlined 2px black.
  - Rows 40px tall: a muted label on the left, a segmented control on the right (1px black outline, 30px options, the chosen one filled black).
  - Sections in order: Capture (frame Full / Framed / Browser, then padding, corners, shadow and background only when framed; zoom on click), Captions, Cursor.
  - Colour: six 22px square swatches; the chosen one has a 2px black outline offset 2px. The colour is used for the cursor and for marks.
  - "Use for": every video of the app, or this one. A pick saves at once and the stage preview follows; "Make the video again" redraws the video in seconds with no new filming.
  - The video's look itself (captions, cursor, marks) belongs to the app being filmed, not to the studio: it is not bound by this file's colour rules.
  - The stage preview is built on the server by the skill's own overlay.cjs, so frame, zoom, marks, cursor and caption match the video at that still's moment.
- **Marks on the screen.** Under the selected script line: "On screen in this line", one 36px outlined row per mark (icon, kind, what it is pinned to, remove), then plain-outlined + Ring, + Label, + Arrow buttons.
  - Marks pin to an element the line clicks. A line that clicks nothing says so instead of offering buttons.
  - When the look or marks changed after the video was made, a muted bar under the top bar says so, with a "Make the video again" button.
- **Menu.**
  - A 1px black outline, 4px padding, 28px items 2px apart, and a 15px icon first.
  - Hover is `#F2F2F3`.
  - Destructive items go last, in record red, after a 1px `#E2E2E5` rule.
- **Toast.** Black fill, white Inter 13px text, a 15px icon, and an underlined action link. It is used only for work that finished while the person was on another screen (for example, a video finishing while they browse the Library). Never for something they just did and can see.

Changes needed outside the design: Settings currently uses `window.prompt` and `window.confirm`, and both must become the confirm dialog and an inline field.

Rejected: nothing on the sheet was turned down.

## Landing page (site/)

The landing page does not follow this file. On 2026-11-18 the user asked for it to follow the layout of the Moonjar home page: a warm off-white page, centred sections in dashed rounded cards, Inter Tight headings with tight tracking, pill buttons and chips, and a green squiggle under one key phrase. It shares only the app icon and real screenshots with the app.
