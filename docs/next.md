# What slows a video down, and what to build next

Written 2026-11-21 from the Passalong runs ("File your first request": outline, script about 5 min, filming about 7 min with two failed takes). The script check is built: `skill/scripts/check.cjs`, flags in the editor, and the writer runs it before handing over. These are the bottlenecks left, biggest first.

## 1. Film from any line

**Problem.** Any script edit, and any failed take, means filming every line again from line 1. In the Passalong run, takes 1 and 2 died at line 4 and each restart re-filmed lines 1 to 3.

**Approach: fast-forward, then film.** `takes.cjs` already runs one `say()` per line and can mark work as off camera. Filming from line N runs lines 1 to N−1 off camera with no voice holds, so the app reaches the same state, then films from N as usual. `cut.py` keeps the old clean take up to line N and splices the new one after it. Fixtures are deterministic, so the page at line N matches the old take.

Pieces:
- `record.cjs --from Lnn`: wraps earlier lines in `offCamera` and skips their holds.
- `cut.py --from Lnn`: splices the old `silent.mp4` up to the start of line N with the new take from N, then dresses and mixes as now.
- `voice.py`: only makes the lines whose text changed (cache by text).
- Retries: when a take fails at line N, the next try starts from N, not 1.
- Studio: "Film from this line" on the selected line. After a script change, offer "Film from line 7" (the first line whose text differs from the filmed one).

**Size:** medium. **Risk:** a page whose state depends on timing (a toast, a timer) can look different at the splice. The checks in `cut.py` should compare the frame before and after the splice and fall back to a full take when they differ a lot.

## 2. Takes that break

**Problem.** Each app has one hand-written `takes.cjs` (347 lines for Passalong) holding every video's take. Locators break (a hidden copy of a title), and the agent repairs them by trial.

**Approach.**
- One file per video (`takes/<guide>.cjs`) plus a shared `takes/app.cjs` for sign-in, fixtures and helpers, so a fix to one video can't break another.
- A `t.find(text)` helper that picks the visible match by default, since that was the cause of both Passalong failures.
- With item 1, a failure costs one line, not the whole take.

**Size:** small to medium. Do it with item 1.

## 3. Faked data

**Problem.** To keep real data safe, the agent invents the app's whole API in the browser (`fixtures.cjs` plus a story per video). That is a lot of work per app, and it can't work for pages built on the server, where the data is already in the HTML.

**Approach for apps filmed on this Mac: throwaway data.** Before a job, copy the app's local database; point the dev server the studio starts at the copy; throw it away after. Writes become real but harmless, server-rendered pages work, and no faking is needed. How to point an app at a copy depends on its stack (local D1/SQLite file, Prisma SQLite, Postgres in Docker), so the connect step would detect it and save it per app. Live sites keep faking.

**Size:** large, per stack. Start with SQLite and local D1, which covers Passalong and Smalbum.

## 4. Agent time

**Problem.** About 15 minutes of waiting per new video, and it isn't known which steps take the time.

**Approach.** Measure first: stamp each job step with its time, and show the slowest steps after a job. Then the likely wins:
- The script writer re-reads code the connect step already summarised. Pass it the summary and the pages it needs.
- Item 1 removes most of the filming time lost to failed takes.
- The outline step is small enough for a faster model.

**Size:** small to measure. The rest depends on what the numbers show.

## 5. Checks the agent can't run

**Problem.** The filming agent wasn't allowed to run `git` or `sqlite3` in the app's repository, so the filmed commit wasn't recorded and the data wasn't compared before and after.

**Approach.** The studio does both itself, without the agent: it records `git rev-parse HEAD` and the branch of the app's repository when filming starts, and shows them with the video. The before-and-after data comparison goes away with item 3, because the data is a copy.

**Size:** small.

## Suggested order

1. Film from any line, with one takes file per video (items 1 and 2).
2. Record the filmed commit, and time every step (items 5 and 4's measuring).
3. Throwaway data for SQLite and local D1 (item 3).
