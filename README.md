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
  - Google Gemini: aistudio.google.com/apikey — auto-selects the latest cost-effective Flash models (e.g. `gemini-3.8-flash`, `gemini-3.7-flash`), has a generous free tier
  - OpenRouter: openrouter.ai/keys — unified access to 300+ models, auto-prioritizes high-speed, low-cost options (`gemini-2.0-flash`, `deepseek-chat`, `gpt-4o-mini`, `claude-3.5-haiku`, `llama-3.3-70b:free`)
  - Anthropic: console.anthropic.com — auto-selects lightweight Claude 3.5 Haiku models (no expensive Sonnet or Opus)
  - OpenAI: platform.openai.com/api-keys — auto-selects fast, low-token `gpt-4o-mini`

Both are stored only in `chrome.storage.local`, on your machine —
never sent to us or any third party. This extension has no backend of
its own; the only network calls it ever makes are straight from your
browser to GitHub (with your token) and to whichever AI provider you
pick (with that key), exactly like you typing your key into their own
website.

## How it works

- **Apple Human Interface Guidelines (HIG)**: Sleek design system based on Apple `DESIGN.md`: deep obsidian canvas (`#0b0c0e`), genuine macOS traffic lights, frosted glass vibrancy chrome (`blur(30px) saturate(190%)`), hairline specular borders, and SF Pro typography with optical tracking.
- **macOS Window Controls**: Native traffic light buttons (Close, Minimize, Zoom to Tab) with interactive hover micro-glyphs (`×`, `–`, `+`).
- **Floor Tiles (Bento Grid) View**: Browse 200+ repositories effortlessly across an auto-fitting floor grid with 3D card lift on hover, specular hairline borders, ambient language glows, and one-click clone/open actions.
- **Finder View Switcher**: Instant toggling between **`⊞ Tiles`** and **`≡ List`** view modes, remembered across sessions.
- **Smart Grouping for 200+ Repos**: Group repositories by *Language*, *Type* (Originals, Active Forks, Untouched), or *Year Updated* with sticky category headers and count badges.
- **Collapsible Detail Inspector**: Toggle the details inspector panel (`I` key) to expand floor tiles across 100% of your display.
- **Spotlight Search & Segmented Controls**: Capsule search bar with `<kbd>/</kbd>` shortcut and pill filter tabs.
- **Apple Intelligence Card**: Luminous subtle gradient card showcasing AI-generated repository summaries.
- Click any tile or row to view its full details and AI summary in the inspector.
- Descriptions are generated once per repo and cached against its last-pushed timestamp, so reopening the dashboard doesn't regenerate anything unless the repo actually changed.
- At most 3 AI requests run at once, to stay under free-tier rate limits.
- **Untouched** on a fork means it's never been pushed to since you forked it (a free signal — no extra API call, and not the same as an exact commits-ahead count).
- **Pin Repositories & Folders for Maximum Efficiency**:
  - **Pin Repositories (`P` key)**: Pin essential repositories with 1 click on any tile, row, or detail panel. Pinned repos float to the top of any sort, display a gold pin badge and halo, and are accessible via the dedicated `📌 Pinned` pill.
  - **Custom Folders**: Create custom folders with custom names and accent colors.
  - **Store & Manage Repos in Folders**: Assign or remove repositories into folders directly from the Detail Inspector or tile cards.
  - **Horizontal Folder Navigation Bar**: Instant 1-click filtering between `All Repos`, `📌 Pinned`, and your custom folders with live repository counters.
  - **Group by Folder**: Visual section grouping in both Floor Tiles and List views separating custom folders, unfiled pinned repos, and unfiled repositories.
- **Recently Edited Repos & Live Commits Panel**: Quick-filter your dashboard to recently edited repositories, and pop up an interactive macOS Sheet (`C` key) displaying the latest commits across repositories. Each commit clearly shows the repository it belongs to (with language indicator and one-click repo isolation), author avatar, relative timestamp, short SHA link, verified badge, and live commit search.
- **In-Extension Trending Discovery & Topic Explorer (`T` key)**: Discover breakout projects, search good repositories by topics, star favorite topics, and sort category-only repositories without leaving the extension:
  - **Topic Explorer & Starred Topics Hub**:
    - **Topic-Based Search**: Search good GitHub repositories by specific topics (e.g. `ai-agents`, `model-classifier`, `rag`, `fine-tuning`, `rust`, `devtools`).
    - **Curated Trending Topics Catalog (60+ Topics)**: Browse curated categories covering AI & Autonomous Agents, Model Classification & Vision, LLMs, GenAI & RAG, DevTools, Systems/Rust, Modern Web, Cybersecurity, and Data Science.
    - **Starred Topics (Favorites Shelf)**: Star (`★`) any topic to save it to your persistent favorites shelf for 1-click access. Quick-button to filter all starred topics at once.
    - **Category-Only Filtering**: Select one or multiple topics simultaneously to isolate repositories belonging exclusively to those categories.
    - **Category Sorters & Quality Thresholds**:
      - Sort category-only repositories by **Trending Velocity** (+stars/day in Today, Week, Month timeframes), **Most Stars** (all-time), **Most Forks**, or **Recently Updated**.
      - Set **Minimum Stars** quality filters (`>100 ★ (Good Repos)`, `>500 ★`, `>1,000 ★`, `>5,000 ★`) to filter out noise.
    - **Interactive Topic Tag Pivoting**: Click any topic tag on any repository card to instantly filter into that topic.
  - **Trending Feeds (Breakout & Surging)**:
    - Global breakout launches and surging active repositories across GitHub.
    - Flexible timeframes: `Today`, `This Week`, `This Month`.
  - **Why It's Trending Deep-Dive**: Explains why developers are buzzing about each repository using dual-tier analysis (instant star-velocity & momentum heuristics + background LLM synthesis when an AI provider is configured).
  - **Seamless Actions**: Pin (`📌`) or assign trending repositories directly to custom folders from inside the discovery sheet.
- **10-Minute Seamless Background Auto-Refresh**:
  - Automatically queries GitHub every 10 minutes (`10 * 60 * 1000` ms) in the background, or whenever you click the refresh icon.
  - **Zero UI State Disruption**: Preserves your active search input query, typing focus, active filter pill, folder selection, view mode, selected repository card, and exact scroll positions in both Floor Tiles and List views.
  - **In-Place Reconciliation**: Star counts, fork counts, descriptions, and relative timestamps update dynamically without DOM destruction or screen flicker.
  - Keeps any open modal sheets (Commits, Trending Hub, Settings, Folder Modals) completely undisturbed.
- **Developer Workflow & Fast Code Navigation**:
  - **1-Click VS Code & github.dev**: Open any repository directly in your local desktop VS Code (`vscode://vscode.git/clone?url=...`) or instant in-browser web editor (`github.dev/...`) with one click from tile action buttons or the Detail Inspector.
  - **Latest Commit Preview in Inspector**: Detail Inspector shows the repository's latest commit with commit message, author avatar, relative timestamp, and short SHA link.
  - **Has Issues Filter & Sorter**: Dedicated `Has Issues` filter chip and `Most open issues` sorting to quickly spot repositories needing maintenance.
- **API Health & Sync Controls**:
  - **Live GitHub API Rate-Limit Monitor**: Real-time remaining quota tracking in both the status bar footer (`<N> API calls left`) and Settings panel with a visual progress bar and reset countdown timer.
  - **Configurable Auto-Refresh Cadence**: Select between `5m`, `10m`, `30m`, `1h`, or `Manual only` in Settings.
- **Bulk Organization & Multi-Repo Management**:
  - **Multi-Select Batch Mode (`M` key)**: Toggle multi-select mode from the controls bar or keyboard shortcut. Checkboxes appear on every row and card.
  - **Floating Frosted Glass Action Bar**: Capsule toolbar displays live selection counter, `Select All`, `Clear`, `📌 Pin / Unpin`, `Move to Folder…` dropdown, and `✕ Done`.
  - **Configuration Backup & Restore**: Export all your custom folders, repository folder assignments, pinned repos, and starred topics to a standalone `.json` backup file, and import it anytime with instant reconciliation.
- **In-Extension README & Interactive File Tree Viewer**:
  - **Full README Markdown Tab**: Read any repository's `README.md` in full directly inside the extension with GitHub-styled typography, formatted tables, syntax code blocks with 1-click code copying, blockquotes, and link resolution.
  - **Interactive File Tree Explorer**: Browse the repository directory structure without opening GitHub. Navigate directories with dynamic breadcrumbs, see file sizes, file types, and direct GitHub links.
- **Multi-Language Composition Bar**:
  - Multi-colored segmented language distribution bar showing byte-level breakdown across all repository languages (Python, TypeScript, Rust, Go, C++, etc.).
  - Legend displays individual percentages and language swatches.
- **One-Click Git Clone & CLI Capsule**:
  - Switch seamlessly between `HTTPS`, `SSH`, and `GitHub CLI` (`gh repo clone ...`).
  - 1-click clipboard copy button with visual `✓ Copied` feedback.
- **Recent Issues & Pull Requests Drawer**:
  - Dedicated inspector tab listing recent open issues and pull requests.
  - Shows issue/PR numbers, status badges, author avatars, relative update timestamps, and GitHub label pills.
- **12-Week Commit Activity Sparkline**:
  - Interactive SVG bar chart showing the last 12 weeks of commit activity.
  - Hover over any bar to view the exact weekly commit count and velocity pulse.
- **Multi-Tag System**:
  - Custom color tags per repository to categorize projects across multiple dimensions.
  - Create new tags on the fly, assign or remove tags in the Detail Inspector.
  - Dedicated Tag Filter dropdown in the controls bar to quickly view all repositories with a specific tag.
  - Batch tag assignment in the floating batch action bar.
- **Stale / Dormant Repository Cleanup Filter**:
  - One-click `Dormant (>1 yr)` filter chip to instantly isolate inactive repositories that haven't been pushed to in over 365 days.
  - Combine with batch selection mode to review and clean up old projects.
- **Repository Catalog Export**:
  - Export your entire repository catalog with languages, stars, forks, custom folders, tags, and AI summaries with 1 click.
  - Supports 3 formats from Settings and the Command Palette:
    - **Markdown Table (`.md`)**: GitHub-ready formatted markdown table.
    - **CSV Spreadsheet (`.csv`)**: Excel / Google Sheets compatible spreadsheet.
    - **JSON Data (`.json`)**: Structured catalog data for scripting and backup.
- **Spotlight Command Palette (`Cmd+K` / `Ctrl+K`)**:
  - Instant command launcher and fuzzy repository jump list. Navigate with `↑`/`↓` and `Enter` to switch views, filter repos (including dormant repos), open trending, toggle inspector, trigger refresh, export catalog as Markdown/CSV/JSON, export configuration, or jump directly to any repository.
- **Keyboard Shortcuts**: `⌘K` / `Ctrl+K` for Command Palette, `M` for Multi-Select, `←`/`↑`/`↓`/`→` to navigate across grid or list, `Enter` to open on GitHub, `P` to pin/unpin, `I` to toggle inspector, `C` to view recent commits, `T` to discover trending repositories & topic explorer, `/` to search, `Esc` to close.

## Project layout

```
manifest.json                            Extension config (MV3)
background/background.js                 Opens the dashboard window
overlay/overlay.html / .css / .js        Dashboard page + entry point
overlay/modules/storage.js               Settings + UI prefs + pin/folder/tag/starred topics storage + cache + export/import
overlay/modules/github-api.js            GitHub REST API calls (repos, commits, languages, activity, readme, files, issues, trending)
overlay/modules/topics-data.js           Curated catalog of trending GitHub topics
overlay/modules/catalogExport.js         Catalog export generators (Markdown, CSV, JSON)
overlay/modules/concurrency.js           Throttles AI requests
overlay/modules/format.js                String/date helpers
overlay/modules/ai/*.js                  One file per AI provider
overlay/modules/render/statsBar.js       Public/private/fork counts (compact, centered)
overlay/modules/render/folderBar.js      Horizontal folder nav bar + folder modal
overlay/modules/render/repoRow.js        One row in the ledger list (with batch selection)
overlay/modules/render/repoTile.js       One bento card in the floor tiles grid (with batch selection + VS Code / web editor)
overlay/modules/render/detailPanel.js    Tabs (Overview, README, Files, Issues), Clone capsule, Language bar, Sparkline, Tags
overlay/modules/render/markdown.js       Lightweight zero-dependency markdown renderer
overlay/modules/render/commitsPanel.js   Recent commits popup sheet
overlay/modules/render/trendingPanel.js  Trending & Topic Explorer discovery hub
overlay/modules/render/commandPalette.js Spotlight Command Palette (Cmd+K / Ctrl+K)
overlay/modules/ai/trendingWhy.js        Momentum & AI "Why It's Trending" analyzer
overlay/modules/render/controls.js       Search / sort / group / view switcher / dormant & tag filter / select mode toggle
overlay/modules/render/settingsPanel.js  Settings modal + rate-limit monitor + refresh cadence + catalog export + backup & restore
```

## Notes

- Token is stored unencrypted in `chrome.storage.local` — fine for
  personal use on your own machine, don't share your profile data.
- Only repos you *own* are fetched, not ones you just collaborate on.

