---
name: howto-video
description: Make short narrated how-to videos of a web app for non-technical users, recorded from the real app with a computer voice, burned-in captions and a visible cursor. Use whenever someone wants a tutorial, walkthrough, training clip, screencast, help-centre video, onboarding video or "show them how to do X" video of their own product or dashboard, or wants existing how-to videos re-recorded after the app changed, even if they don't say "video skill". Not for promos or launch videos of a website, or explainers with invented visuals; those go to the HyperFrames skills.
---

# How-to videos from the real app

Each video is real screen footage of one task, with one voice line per step. The pipeline is:

1. Write a script table per video. The user approves it.
2. Generate the voice, which fixes how long each line lasts.
3. Record: a Playwright take drives the app and holds each step for the length of its line.
4. Cut: remove loading stretches, mix in the voice, check the timing.
5. Review frames, then deliver.

Scripts live in `scripts/` beside this file. Below, `$SKILL` means this skill's directory.

## Before you start, establish these

Get what you can from the request and the code. Ask only for what is left.

- **Who watches** and what job they do. Everything is worded for them.
- **Which tasks.** Use the tasks the audience actually asks about, one task per video.
- **Which build and environment.** Film the build the audience will really use, and say which commit you filmed. An out-of-date local checkout is an easy mistake and forces a full re-record. Fetch and use a fresh worktree of the right branch rather than whatever happens to be checked out. When you film a deployed site but read local code, check the code matches the deploy (the deploy log, a version endpoint, or a label you can see on both); if you can't, say so in the report.
- **What may be written to.** Takes really click Save. Use a test account on a non-production environment. Before recording anything against shared data, tell the user what the takes will create and how they get removed.
- **Where the app's code is.** With the repository you can write the takes from the code and fake every write (see "Write the takes from the repository" below), which also makes filming against production safe. Look for it nearby before asking.

## Project layout

Make one folder per set of videos, outside the app's repository unless the user wants it there. Never overwrite videos the user already has; use a new folder.

```
<project>/
  package.json            playwright dev dependency
  takes.cjs               the recording code; copy references/takes-template.cjs
  scripts/<guide>/script.md
  assets/                 example pictures and files the takes upload
  audio/<guide>/          generated
  out/                    working files and frame sheets, generated
  final/<guide>.mp4       generated
```

Setup, once per machine or project:

```bash
python3 -m venv ~/.cache/howto-video/kvenv && ~/.cache/howto-video/kvenv/bin/pip install kokoro-onnx soundfile
```

```bash
pnpm init && pnpm add -D playwright && pnpm exec playwright install chromium
```

The app must already be running. Start dev servers the way the session normally does.

## 1. Write the scripts

If you have the repository, work through "Write the takes from the repository" (in section 4) before writing a script. The labels, confirm dialogs and required fields it turns up decide what the script can say.

Copy `references/script-template.md` to `scripts/<guide>/script.md`. A row counts as a line when it starts with `| L`, and the last cell becomes both the voice and the caption, so don't use `|` inside it.

Write for someone who is not technical and is slightly nervous about breaking something:

- One action per line, in the words on the screen. Say "click Save", not "persist your changes".
- Short sentences, with no jargon. Read each one aloud in your head.
- Say what happens next when it matters: "Visitors don't see it yet."
- Aim for 30 to 60 seconds. Longer means two tasks.
- Start moving in the first line. Don't open on a busy page where nothing happens for several seconds.
- Every line that says "click X" really clicks X on camera. If the video only points at something, say "this is X", not "click X".
- Keep each line short enough for one caption line: about 70 characters. Split longer lines.
- When the video switches to another person's view, make the change visible (their name or page) and say whose view it is.
- A vague request ("introduce the app") is not one task. Pick one task, or ask which, before writing.

Then check the script against these rules:

```bash
node $SKILL/scripts/check.cjs <project> <guide>
```

Fix what it flags. If a flag is wrong for this video (a pause that really is needed), leave it and say why in the notes.
- **End by showing the result from the other side**: the page as the customer, visitor or recipient gets it, without editing controls, and how the viewer can check it themselves. People want to see that it worked. This is easy to forget, and it is usually the most reassuring shot in the video. When the viewer already is the other side (a client replying to a review link, say), end on the confirmation they see, and say what happens next for the other person.

Use `probe.cjs` to read the real labels before writing them into a script:

```bash
GUIDE_PROFILE=$GUIDE_PROFILE node $SKILL/scripts/probe.cjs <project> <url> <project>/out/probe.png
```

It blocks all writes, and prints the page's accessibility tree, frames and hosts. Where the app's wording contradicts the voice, note it under "Watch out" and tell the user.

Show the scripts to the user and wait for approval before recording; re-recording is what's expensive. Offer to film one video first so they can judge the voice and pace before you do the rest.

## 2. Generate the voice

```bash
python3 $SKILL/scripts/voice.py <project> <guide> [voice]
```

The default voice is `am_michael`. Kokoro runs locally, so script text leaves no machine and there's no per-use cost. To let the user choose, generate the same sentence with a few voices: `am_michael`, `am_adam`, `af_heart`, `af_bella`, `bm_george`, `bf_emma`. Re-run this for a guide whenever its script text changes.

## 3. Sign in

If the app needs a login, the user signs in. Never type a password yourself, and don't ask for one.

```bash
export GUIDE_PROFILE=$(mktemp -d)
```

```bash
GUIDE_PROFILE=$GUIDE_PROFILE node $SKILL/scripts/login.cjs <project> <login-or-app-url> '<regex matching the signed-in URL>'
```

This opens a window and waits up to 10 minutes. Keep `GUIDE_PROFILE` outside the project, since it holds a signed-in session, and delete it when finished. Shell variables don't always persist between tool calls, so use the literal path. `GUIDE_PROFILE` is required even without a login.

## 4. Write the takes

### Write the takes from the repository

When you have the app's code, read it before writing a take, not after a take fails. Work through these in order and note the answers at the top of `takes.cjs`:

1. **Find the page.** Find the route file for each page the video shows (`pages/`, `app/`, `src/routes/`). Read its template for the real labels: `aria-label`, button text, placeholders. These become your locators (`getByRole(..., { name })`). Check them against `probe.cjs` output, since components can rename things.
2. **List the writes.** Run:

   ```bash
   node $SKILL/scripts/repo-writes.cjs <repo> [filter]
   ```

   It prints every POST, PUT, PATCH and DELETE endpoint, its handler file, and the client files that call it. Keep the ones the video's page calls. Read each handler, and mark any write that can't be undone (an approval, a send, a payment, a delete). Read the caller too: what body it sends, and what it does afterwards (often it fetches the data again).
3. **Decide per write: fake it or let it through.** Fake every write when filming shared or production data, and every one-way write wherever you film. Let a write through only on a test environment, with an `afterTake` that undoes it.
4. **Check how the page gets its data.** A fake only shows on screen if the browser fetches the data. A client-rendered page (`ssr: false`, a SPA, data loaded in `onMounted` or `useEffect`) is fully fakeable. Data that a server-rendered page puts into the HTML is not. For those, fake only the writes, and film from a test record.
5. **Hide leftovers.** If the real record already holds test junk that would show in the shot (old comments, "test 123" rows), filter it out of the faked GET rather than deleting real data.
6. **Read the page's guards.** Find what disables a button or blocks an action: required fields, `:disabled` conditions, checks at the top of a handler. Also find what the page keeps in `localStorage` or cookies. A fresh profile starts empty, so a remembered name or setting the script assumes won't be there. Clear it off camera, or film the step that fills it.
7. **Find the dialogs.** The recorder accepts only native `window.confirm`. An in-app modal (a dialog component, `useDialogs`, a toast with Undo) is part of the take: click its button yourself, and scope the locator to it with `p.getByRole('dialog').getByRole('button', { name })`, since its button often has the same name as the one that opened it.
8. **Canvas content.** Anything drawn on a `<canvas>` has no role or label. Work out where to click from the layout data the page draws from, check it on the probe screenshot, and click with `p.mouse` relative to the canvas's bounding box.

The fake pattern: one state object per take, a GET route that fetches the real data and merges the state into it, and one route per write that updates the state and returns what the client expects. Page routes take precedence over `blockWrites`, so everything else to that host stays blocked:

```js
const state = { added: [], status: null };
await p.route(/\/api\/thing\/123(\?.*)?$/, async (r) => {
  if (r.request().method() !== 'GET') return r.abort();
  const res = await r.fetch();
  const data = await res.json();
  data.items = [...state.added];               // hides old junk; keep real items with [...data.items, ...state.added]
  if (state.status) data.status = state.status;
  return r.fulfill({ response: res, json: data });
});
await p.route(/\/api\/thing\/123\/items$/, async (r) => {
  const body = r.request().postDataJSON();
  state.added.push({ id: `fake${state.added.length + 1}`, ...body, created_at: Date.now() }); // shape: see below
  return r.fulfill({ json: { ok: true } });   // the handler's real return value
});
```

The contract for a faked record is the client's own type for it and every filter the page runs over it, not only the handler's INSERT. A field the UI filters on (a version number, an owner flag) decides whether the record shows or a button enables.

The `called` column of `repo-writes.cjs` is approximate. Confirm in the page's code which writes it really makes.

After the take, confirm the real record has not changed (fetch it with curl and compare), and tell the user. The `WRITES` list still shows the faked requests; the `BLOCKED` list must be empty.

### Helpers

Copy `references/takes-template.cjs` to `<project>/takes.cjs` and write one function per guide, with one `t.say('Lnn', action)` per script line. The helpers are:

| Helper | Use |
|---|---|
| `say(id, act)` | Starts the line's time and runs `act`. It holds until both the voice and `act` are finished. The caption is drawn later, by `dress.cjs`. |
| `offCamera(work)` | Everything in `work` is cut from the video. Use it for loading, navigation and preparing data. |
| `click(loc, {pause})` | Moves the visible cursor to the element, then clicks. Use it for everything on camera; `loc.click()` teleports. |
| `button(name)` | An exact-name button locator. |
| `pickFile(loc, files)` | Clicks a control that opens a file picker and supplies the files. |
| `clickLinkToNewTab(loc)` | Clicks a link that opens a tab, closes that tab and returns its address. Only one tab is filmed. Follow it with `offCamera(() => visit(url, ready))`. |
| `visit(url, ready, frame)` | Loads a page, reloading until `ready()` is true in the page. |
| `waitForImages(frame)`, `waitForFonts(fonts, frame)` | Keep half-loaded pages and fallback fonts out of the shot. |
| `afterTake(fn)` | Removes what the take created. It runs after the end of the video, including after a failed take. |
| `asset(name)`, `sleep(ms)`, `page`, `ctx` | The rest. |

Things that have gone wrong before:

- **Protect real data.** List production API hosts in `blockWrites`. Every non-GET request to them is aborted, and `cut.py` refuses the take if one was tried. Check the `WRITES` list that each recording prints.
- **Unique test records.** Name records with a suffix such as `Date.now() % 10000`. Two records with one name can behave differently from one, and the video then shows a bug or the wrong record.
- **Clean up.** Register `afterTake` as soon as a take creates something. When the videos are done, confirm no test records remain and report what you removed. If removal writes to shared data, get the user's approval first.
- **No real personal data.** Make example pictures and example names. Generated pictures should look plausible for the product and be easy to tell apart, such as numbered, because the viewer has to see which one changed.
- **Unstable pages.** Use `domcontentloaded`, wait for the specific element you need, and retry on an error page. Prepare slow pages inside `offCamera` by loading them once first, so they aren't compiled on camera.
- **Cuts between lines only.** A cut inside a line fails the checks. Put each `offCamera` between two `say` calls.
- **Timing inside a line.** Add `sleep` before a click so the voice names the thing before the cursor gets there. An `act` that outlasts its voice makes silence, so split the line or shorten it.
- **File pickers don't appear in the recording**, only their result. Have the voice say "pick one from your computer".
- **Sticky headers intercept clicks.** Scroll the target clear of them, and click a small element rather than a tall list.
- **Reveal the result fully.** After a click that loads content, wait until it has loaded and hold a moment, or the shot shows blanks.
- **Native confirm dialogs** (`window.confirm`) are accepted automatically after a short pause. In-app modals are not; click them in the take.

## 5. Record and cut

Film, then cut. Run long batches in the background.

```bash
GUIDE_PROFILE=$GUIDE_PROFILE node $SKILL/scripts/record.cjs <project> <guide>
```

```bash
python3 $SKILL/scripts/cut.py <project> <guide>
```

Takes fail for ordinary reasons such as timeouts. A failed take is not thrown away: `record.cjs` prints `RESUME` with the line that broke. Run `cut.py` anyway; it keeps the lines before the failure and exits with code 2. Then film the rest from that line, and cut again, which splices it on. Try up to three times.

```bash
GUIDE_PROFILE=$GUIDE_PROFILE node $SKILL/scripts/record.cjs <project> <guide> --from L06
```

**Changing part of a video.** After a script edit, run `voice.py` again (it only remakes lines whose words changed), then film from the first changed line with `--from` and run `cut.py`. The lines before it stay as they were filmed. `--from` replays the earlier lines off camera to reach the same state, so the take function must still run every line in order. When the change is in an earlier line's actions, not just its words, film from that line instead.

A failed take leaves `out/<guide>-error.png`. Look at it before you retry something that fails the same way twice.

`cut.py` checks that every line was spoken, that lines don't overlap or run past the end, that no cut falls inside a line, and that nothing tried to write to a protected host. If it stops on one of these, fix the take rather than the check.

If white flashes appear while the app reloads an embedded frame, add `--deflash TOP HEIGHT` to cover them with the next frame. `TOP` and `HEIGHT` give the pixel band to test, usually the content area between the app's header and the caption. It treats a band that is at least 90% white as blank, so on a sparse white page it freezes the picture for the rest of the video. Use it only for real flashes, and read the `covered` times it prints: each stretch should last well under a second.

### Captions, cursor and marks: the look

The take films the page clean. It logs where the mouse went and the box of every element `click` touched, per line. `cut.py` then runs `dress.cjs`, which draws the captions, the cursor, click ripples and any pinned marks over the clean cut, in the style set by:

- `<project>/look.json` for every video, or `scripts/<guide>/look.json` for one video (it wins). Shape: `{"caption": {"font": "serif|sans|rounded", "size": "s|m|l", "box": "dark|light|none", "place": "bottom|top"}, "cursor": {"shape": "ring|arrow|dot", "color": "#RRGGBB", "click": "ripple|none"}, "frame": {"style": "full|framed|browser", "background": "sand|sky|mist|graphite", "padding": "s|m|l", "corners": "none|s|l", "shadow": "on|off", "zoom": "off|on"}}`. Missing values use the default (full bleed, no zoom).
- `frame.style`: `full` fills the video with the page; `framed` puts it on a background with padding, corners and a shadow; `browser` adds a browser bar showing the address the take opened. `zoom` pushes in on the first element each line clicks, then out before the next line. Captions sit on the whole video, outside the frame and the zoom.
- `scripts/<guide>/pins.json`: marks pinned to what a line clicked, `[{"line": "L02", "kind": "ring|label|arrow", "target": 0, "text": "Next spread"}]`. `target` is the index of the clicked element within that line; `text` is for labels and defaults to the element's name. A mark sits where the element was when clicked, for the whole line.

To change the look or the marks, edit those files and run `python3 $SKILL/scripts/cut.py <project> <guide> --redress`. It takes seconds and needs no new filming. Videos filmed before this existed have no clean cut and must be recorded again. `scripts/overlay.css` and `scripts/overlay.cjs` hold the styles and markup; How-to Studio uses the same two files for its preview.

## 6. Review and deliver

Open `out/<guide>-sheet.png`, which has two frames per line, and read it against the script. Look for a caption that doesn't match the action, half-loaded pages, wrong fonts, leftover dev tools, real personal data, and a final shot that really shows the change. Pull individual frames with ffmpeg if something is unclear.

Check the file: 

```bash
ffprobe -v error -show_entries stream=codec_type,width,height,duration -of csv=p=0 <project>/final/<guide>.mp4
```

For sending over chat apps, also make one zip per video with `zip -j`, and test it with `unzip -t`.

Finish by removing the signed-in profile directory and stopping servers you started. Tell the user:

- the videos, with lengths
- which build and commit was filmed, and how it differs from production if it does
- any real personal data still visible
- any app wording that differs from the voice, and bugs you noticed while filming
- that you checked frames but nobody has listened to the audio, unless someone has
