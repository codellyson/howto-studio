# How-to Studio

A Mac app for making narrated how-to videos of your own web app. You give it the app's code and the site to film. An agent reads the code, writes a script you edit as a storyboard, and films the real site with a computer voice. Every save is answered inside the browser, so live data never changes.

It is a front end for the `howto-video` skill (`~/.claude/skills/howto-video`). Each step is a headless `claude -p` run with that skill.

## Needs

- Node 22+, pnpm, Python 3, ffmpeg
- Claude Code (`claude`) signed in
- The howto-video skill, with its Kokoro voice venv (see the skill's setup)

## Run

```bash
pnpm install
pnpm dev            # http://localhost:4700
pnpm test
```

Mac app: `cd desktop && cargo tauri build --bundles app`. The app bundles the built server and starts it on port 4700.

## Where things live

- `~/HowtoStudio/apps/<app>/` holds one skill project per connected app: `app.json`, `scripts/<video>/script.md` and `notes.md`, `takes.cjs`, `audio/`, `out/`, and `final/<video>.mp4` plus `.lines.json`.
- `~/HowtoStudio/profiles/<app>/` holds the browser profile with the saved sign-in.
- `~/HowtoStudio/.jobs/` records running and finished agent runs, so a restart knows what is still going.

Set `STUDIO_HOME`, `HOWTO_SKILL` or `STUDIO_MODEL` to change these defaults.
