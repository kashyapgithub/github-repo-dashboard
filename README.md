# Repo Dashboard for GitHub

A Chrome extension that opens a big window listing every repo in your
GitHub account — public, private, forked, original — with an
AI-written summary for each one.

## Install

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the extension icon to open the dashboard

## Setup

On first open, enter:

- **GitHub personal access token** — needs the `repo` scope (for
  private repos). Create one at GitHub → Settings → Developer
  settings → Personal access tokens.
- **AI provider + key** (optional — skip for stats only, no summaries)
  - OpenAI: platform.openai.com/api-keys
  - Anthropic: console.anthropic.com
  - Gemini: aistudio.google.com/apikey — has a free tier, the
    cheapest way to run this

Both are stored only in `chrome.storage.local`, on your machine —
never sent to us or any third party. This extension has no backend of
its own; the only network calls it ever makes are straight from your
browser to GitHub (with your token) and to whichever AI provider you
pick (with that key), exactly like you typing your key into their own
website.

## How it works

- **Apple Human Interface Guidelines (HIG)**: Sleek design system based on Apple `DESIGN.md`: deep obsidian canvas (`#0b0c0e`), genuine macOS traffic lights, frosted glass vibrancy chrome (`blur(30px) saturate(190%)`), hairline specular borders, and SF Pro typography with optical tracking.
- **macOS Window Controls**: Native traffic light buttons (Close, Minimize, Zoom to Tab) with interactive hover micro-glyphs (`×`, `–`, `+`).
- **Spotlight Search & Segmented Controls**: Capsule search bar with `<kbd>/</kbd>` shortcut and pill filter tabs.
- **Apple Intelligence Card**: Luminous subtle gradient card showcasing AI-generated repository summaries.
- Click a repo in the list to see its full details and AI summary on the right.
- Descriptions are generated once per repo and cached against its last-pushed timestamp, so reopening the dashboard doesn't regenerate anything unless the repo actually changed.
- At most 3 AI requests run at once, to stay under free-tier rate limits.
- **Untouched** on a fork means it's never been pushed to since you forked it (a free signal — no extra API call, and not the same as an exact commits-ahead count).
- Keyboard: `↑`/`↓` to move selection, `Enter` to open the selected repo, `/` to jump to search, `Esc` to close.

## Project layout

```
manifest.json                            Extension config (MV3)
background/background.js                 Opens the dashboard window
overlay/overlay.html / .css / .js        Dashboard page + entry point
overlay/modules/storage.js               Settings + description cache
overlay/modules/github-api.js            GitHub REST API calls
overlay/modules/concurrency.js           Throttles AI requests
overlay/modules/format.js                String/date helpers
overlay/modules/ai/*.js                  One file per AI provider
overlay/modules/render/statsBar.js       Public/private/fork counts
overlay/modules/render/repoRow.js        One row in the repo list
overlay/modules/render/detailPanel.js    Selected repo's full details
overlay/modules/render/controls.js       Search / sort / filter
overlay/modules/render/settingsPanel.js  Settings modal
```

## Notes

- Token is stored unencrypted in `chrome.storage.local` — fine for
  personal use on your own machine, don't share your profile data.
- Only repos you *own* are fetched, not ones you just collaborate on.
