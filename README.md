# Repo Dashboard for GitHub

A Chrome extension that opens a big dashboard window showing every
repo in your GitHub account — public, private, forked, original —
with an AI-written 3-4 sentence summary for each one, so you can tell
what's actually there without clicking into every fork you made six
months ago.

## Install (load unpacked)

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder (`repo-dashboard/`)
5. Click the extension's icon in your toolbar — a large dashboard
   window opens

## First-time setup

The dashboard needs two things, both entered once and stored only in
your browser (`chrome.storage.local` — never sent anywhere except
GitHub and whichever AI provider you pick):

**1. A GitHub personal access token**
- GitHub → Settings → Developer settings → Personal access tokens →
  Generate new token
- Needs the `repo` scope so it can also see private repos

**2. An AI provider + API key (optional, but this is where the
   summaries come from)**
Pick one from the dropdown:
- **OpenAI** — platform.openai.com/api-keys
- **Anthropic (Claude)** — console.anthropic.com
- **Google Gemini** — aistudio.google.com/apikey (this one has a free
  tier with daily quotas on the Flash / Flash-Lite models — the
  cheapest way to run this if you don't already have a paid key
  elsewhere)

You can leave the AI provider set to "None" and still get the full
stats + repo list; you'll just skip the generated descriptions.

## How it keeps AI costs down

- Descriptions are generated **once per repo** and cached
  (`chrome.storage.local`), keyed to that repo's last-pushed
  timestamp — so reopening the dashboard tomorrow doesn't
  regenerate anything unless the repo actually changed.
- Only 3 AI requests run at a time, so a big batch of forks doesn't
  fire hundreds of simultaneous requests at your provider.
- A repo's README is only fetched right before generating its
  description — never upfront for repos that already have a cached one.

Use **Settings → Clear AI cache** if you ever want to force everything
to regenerate.

## Project layout

```
manifest.json                     Extension config (MV3)
background/background.js          Opens the dashboard window on icon click
overlay/overlay.html               Dashboard page shell
overlay/overlay.css                All styling
overlay/overlay.js                 Entry point — orchestrates everything below
overlay/modules/storage.js         Settings + AI-description cache (chrome.storage)
overlay/modules/github-api.js      All GitHub REST API calls
overlay/modules/concurrency.js     Throttles AI requests
overlay/modules/format.js          Small string/date helpers
overlay/modules/ai/openai.js       OpenAI provider
overlay/modules/ai/anthropic.js    Anthropic provider
overlay/modules/ai/gemini.js       Gemini provider
overlay/modules/ai/index.js        Picks a provider + builds the prompt
overlay/modules/render/statsBar.js      Public/private/fork counts
overlay/modules/render/repoCard.js      One repo card
overlay/modules/render/controls.js      Search / sort / filter
overlay/modules/render/settingsPanel.js Settings form
```

## What "Untouched" means on a card

A fork is flagged **Untouched** when its last-pushed timestamp is
identical to when you forked it — i.e. you've never committed to it
since. This is a free signal (no extra API calls); it doesn't try to
calculate exact commits-ahead/behind vs. the upstream repo, which
would cost one extra GitHub API call per fork.

## Known limitations / possible next steps

- The GitHub token is stored in plain `chrome.storage.local`, which
  is fine for a personal tool on your own machine but isn't encrypted
  at rest — don't share your profile/extension data.
- No exact "commits ahead of upstream" count yet — the "Untouched"
  badge is a lightweight heuristic instead (see above).
- Only repos you *own* are fetched (not repos you collaborate on),
  matching "how many repos are public/private/forks" for your own
  account.
