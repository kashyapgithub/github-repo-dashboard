// overlay/overlay.js
//
// Entry point for the dashboard window. Orchestrates: fetch repos,
// render the list + detail panel, run AI description generation in
// the background, and wire up selection (click or keyboard).
// The actual rendering logic lives in modules/render/*.js — this file
// just wires state to those functions.

import { getSettings, getCachedDescription, setCachedDescription } from './modules/storage.js';
import { fetchAllRepos } from './modules/github-api.js';
import { generateDescription } from './modules/ai/index.js';
import { runWithConcurrency } from './modules/concurrency.js';
import { renderSettingsPanel } from './modules/render/settingsPanel.js';
import { renderStatsBar } from './modules/render/statsBar.js';
import { renderControls } from './modules/render/controls.js';
import { createRepoRow, setRowStatus } from './modules/render/repoRow.js';
import { renderDetailPanel } from './modules/render/detailPanel.js';

// How many AI description requests are allowed to be in flight at
// once. Kept low so a free-tier provider (e.g. Gemini) doesn't get
// hit with a burst of simultaneous requests when you have hundreds of
// repos — see modules/concurrency.js.
const AI_REQUEST_CONCURRENCY = 3;

const app = document.getElementById('app');

// Keydown listener is attached to `document`, which outlives any one
// call to init() (init() re-runs after Settings is saved). Tracking
// the current handler lets us remove the old one before adding a new
// one, instead of stacking duplicate listeners on every save.
let activeKeydownHandler = null;

init();

async function init() {
  const settings = await getSettings();

  if (!settings.githubToken) {
    showFirstRunSetup(settings);
    return;
  }

  const shell = renderShell();
  renderSettingsPanel(shell.settingsSlot, { settings, onSaved: init, forceOpen: false });

  let repos;
  try {
    repos = await fetchAllRepos(settings.githubToken);
  } catch (error) {
    shell.mainArea.innerHTML = `
      <div class="error-state">
        <p>${error.message}</p>
        <p>Open settings (top right) and double-check the token.</p>
      </div>
    `;
    return;
  }

  if (repos.length === 0) {
    shell.mainArea.innerHTML = '<div class="empty-state"><p>No repositories found for this account.</p></div>';
    return;
  }

  runDashboard(shell, repos, settings);
}

function showFirstRunSetup(settings) {
  app.innerHTML = '<div class="first-run-slot"></div>';
  renderSettingsPanel(app.querySelector('.first-run-slot'), {
    settings,
    onSaved: init,
    forceOpen: true,
  });
}

/** Builds the static page shell once repos are known to exist. */
function renderShell() {
  app.innerHTML = `
    <header class="app-header">
      <div class="app-header__brand">
        <svg class="brand-mark" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="2" y="2" width="9" height="9" rx="2" fill="#e8a33d" />
          <rect x="13" y="2" width="9" height="9" rx="2" fill="#3fb68b" />
          <rect x="2" y="13" width="9" height="9" rx="2" fill="#5b6472" />
          <rect x="13" y="13" width="9" height="9" rx="2" fill="#e8a33d" />
        </svg>
        <h1>Repo Dashboard</h1>
      </div>
      <div class="app-header__settings" data-slot="settings"></div>
    </header>
    <section class="stats-bar" data-slot="stats"></section>
    <section class="controls-bar" data-slot="controls"></section>
    <main class="main-area" data-slot="main">
      <div class="repo-list-panel">
        <div class="repo-list-head">
          <span></span>
          <span>Name</span>
          <span>Lang</span>
          <span>Stars</span>
          <span>Updated</span>
          <span>Visibility</span>
        </div>
        <div class="repo-list-wrapper" data-slot="list"></div>
      </div>
      <aside class="detail-panel" data-slot="detail"></aside>
    </main>
    <footer class="status-bar" data-slot="footer"></footer>
  `;

  return {
    settingsSlot: app.querySelector('[data-slot="settings"]'),
    statsSlot: app.querySelector('[data-slot="stats"]'),
    controlsSlot: app.querySelector('[data-slot="controls"]'),
    mainArea: app.querySelector('[data-slot="main"]'),
    list: app.querySelector('[data-slot="list"]'),
    detail: app.querySelector('[data-slot="detail"]'),
    footer: app.querySelector('[data-slot="footer"]'),
  };
}

function runDashboard(shell, repos, settings) {
  renderStatsBar(shell.statsSlot, repos);

  const rowsByRepoId = new Map(); // repo.id -> row element
  const descriptionsById = new Map(); // repo.id -> { status, text? }
  let visibleRepos = [];
  let selectedRepoId = null;

  function findRepo(id) {
    return repos.find((repo) => repo.id === id);
  }

  function refreshDetailPanel() {
    const repo = selectedRepoId != null ? findRepo(selectedRepoId) : null;
    renderDetailPanel(shell.detail, repo, descriptionsById.get(selectedRepoId));
  }

  function selectRepo(repoId) {
    if (selectedRepoId != null) {
      rowsByRepoId.get(selectedRepoId)?.classList.remove('repo-row--selected');
    }
    selectedRepoId = repoId;
    const row = rowsByRepoId.get(repoId);
    row?.classList.add('repo-row--selected');
    row?.scrollIntoView({ block: 'nearest' });
    refreshDetailPanel();
  }

  function moveSelection(delta) {
    if (visibleRepos.length === 0) return;
    const currentIndex = visibleRepos.findIndex((repo) => repo.id === selectedRepoId);
    const nextIndex = Math.min(Math.max(currentIndex + delta, 0), visibleRepos.length - 1);
    selectRepo(visibleRepos[nextIndex].id);
  }

  for (const repo of repos) {
    rowsByRepoId.set(repo.id, createRepoRow(repo, { onSelect: selectRepo }));
  }

  renderControls(shell.controlsSlot, {
    onFilterChange: (filtered) => {
      visibleRepos = filtered;
      shell.list.innerHTML = '';
      for (const repo of filtered) shell.list.appendChild(rowsByRepoId.get(repo.id));

      const stillVisible = filtered.some((repo) => repo.id === selectedRepoId);
      if (!stillVisible) {
        selectRepo(filtered.length > 0 ? filtered[0].id : null);
      }

      updateFooter(shell.footer, filtered.length);
    },
  });
  shell.controlsSlot.setRepos(repos); // triggers the first (unfiltered) render + initial selection

  setUpKeyboardShortcuts(shell, moveSelection, () => selectedRepoId, findRepo);

  fillInAiDescriptions(repos, rowsByRepoId, descriptionsById, settings, () => selectedRepoId, refreshDetailPanel);
}

function updateFooter(footer, visibleCount) {
  footer.innerHTML = `
    <span data-role="count"></span>
    <span>↑↓ select · Enter open · / search</span>
  `;
  footer.querySelector('[data-role="count"]').textContent = `${visibleCount} repo${visibleCount === 1 ? '' : 's'} shown`;
}

function setUpKeyboardShortcuts(shell, moveSelection, getSelectedId, findRepo) {
  if (activeKeydownHandler) {
    document.removeEventListener('keydown', activeKeydownHandler);
  }

  activeKeydownHandler = (event) => {
    const tag = document.activeElement.tagName;
    const isTyping = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

    if (event.key === '/' && !isTyping) {
      event.preventDefault();
      shell.controlsSlot.querySelector('#repo-search')?.focus();
      return;
    }

    if (isTyping) return; // don't hijack arrow keys while the user is typing/selecting

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1);
    } else if (event.key === 'Enter') {
      const repo = findRepo(getSelectedId());
      if (repo) window.open(repo.url, '_blank', 'noopener');
    }
  };

  document.addEventListener('keydown', activeKeydownHandler);
}

/**
 * Generates (or reuses a cached) AI description for every repo,
 * throttled so at most AI_REQUEST_CONCURRENCY run at once. Updates
 * each row's status dot as it goes, and refreshes the detail panel
 * live if the repo currently being processed happens to be selected.
 */
async function fillInAiDescriptions(repos, rowsByRepoId, descriptionsById, settings, getSelectedId, refreshDetailPanel) {
  const apiKey = settings.aiProvider ? settings.aiApiKeys?.[settings.aiProvider] : null;

  function updateStatus(repoId, entry) {
    descriptionsById.set(repoId, entry);
    setRowStatus(rowsByRepoId.get(repoId), entry.status);
    if (getSelectedId() === repoId) refreshDetailPanel();
  }

  if (!apiKey) {
    for (const repo of repos) updateStatus(repo.id, { status: 'no-key' });
    return;
  }

  await runWithConcurrency(repos, AI_REQUEST_CONCURRENCY, async (repo) => {
    const cached = await getCachedDescription(repo.id);

    if (cached && cached.pushedAt === repo.pushed_at) {
      updateStatus(repo.id, { status: 'ready', text: cached.description });
      return;
    }

    try {
      updateStatus(repo.id, { status: 'pending' });
      const description = await generateDescription({
        provider: settings.aiProvider,
        apiKey,
        githubToken: settings.githubToken,
        repo,
      });
      await setCachedDescription(repo.id, { pushedAt: repo.pushed_at, description });
      updateStatus(repo.id, { status: 'ready', text: description });
    } catch (error) {
      updateStatus(repo.id, { status: 'error', text: error.message });
    }
  });
}
