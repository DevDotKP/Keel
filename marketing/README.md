# marketing/

Tooling and output for Keel demo assets: a seeded demo account, high-resolution screenshots, and a walkthrough video. Everything here runs against the **local** database only and uses fictional data (Akhil and Priya). It never touches production or real user data.

## What is here

| Path | What it is |
|---|---|
| `demo-seed.sql` | Deterministic demo dataset for the local D1 (the dev preview user). |
| `capture-screenshots.mjs` | Playwright script: high-res screenshots of every screen. |
| `capture-video.mjs` | Playwright script: a scripted walkthrough video. |
| `STORYBOARD.md` | Shot list, captions, screenshot index, brand palette. |
| `assets/screenshots/` | PNG output (mobile 3x, plus two desktop shots). |
| `assets/video/` | `keel-walkthrough.webm`. |

## Regenerate from scratch

Run from the repo root. This resets the local DB, so only do it on a machine where the local data is disposable.

```sh
# 1. Reset the local D1 and apply migrations
rm -rf .wrangler/state/v3/d1
npx wrangler d1 migrations apply keel-prod --local

# 2. Load the demo dataset
npx wrangler d1 execute keel-prod --local --file marketing/demo-seed.sql

# 3. Start the dev server (auto-logs in as the seeded preview user)
npm run dev -- --port 5180

# 4. In another shell, capture
node marketing/capture-screenshots.mjs
node marketing/capture-video.mjs
```

Set `BASE_URL` if the dev server runs on a different port.

## Notes

- **Why dev mode.** `hooks.server.ts` auto-logs in as `dev-preview-user` only in dev. The production build gates on real auth, so capture must run against `npm run dev`.
- **The greeting splash.** The dashboard shows a ~1.5s "Hey Akhil." splash on load. The screenshot script waits it out for clean stills; the video keeps it as the intro. Change the name in `demo-seed.sql` (and re-run step 2) to re-cast the demo.
- **MP4.** The video is WebM. Playwright's bundled ffmpeg is a VP8-only build and cannot mux MP4. To produce an MP4 for wider sharing, install a full ffmpeg and convert:

  ```sh
  brew install ffmpeg
  ffmpeg -i assets/video/keel-walkthrough.webm -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart assets/video/keel-walkthrough.mp4
  ```

- **Editing.** The video is raw screen capture (no music, voiceover, or device frame). `STORYBOARD.md` has timecodes and captions to finish it in any editor.
