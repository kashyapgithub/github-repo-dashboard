// overlay/overlay.js
//
// Entry point for the dashboard window. Orchestrates: fetch repos,
// render the list + detail panel, run AI description generation in
// the background, and wire up selection (click or keyboard).

import { getSettings, getCachedDescription, setCachedDescription } from './modules/storage.js';
import { fetchAllRepos, enrichForksWithParent } from './modules/github-api.js';
import { generateDescription } from './modules/ai/index.js';
import { runWithConcurrency } from './modules/concurrency.js';
import { renderSettingsPanel } from './modules/render/settingsPanel.js';
import { renderStatsBar } from './modules/render/statsBar.js';
import { renderControls } from './modules/render/controls.js';
import { createRepoRow, setRowStatus } from './modules/render/repoRow.js';
import { renderDetailPanel } from './modules/render/detailPanel.js';

const AI_REQUEST_CONCURRENCY = 3;
const app = document.getElementById('app');
let activeKeydownHandler = null;

init();

export function closeWindowSafely() {
  try {
    window.close();
  } catch {}
  if (typeof chrome !== 'undefined' && chrome.windows?.getCurrent) {
    chrome.windows.getCurrent((w) => {
      if (w?.id) chrome.windows.remove(w.id);
    });
  }
}

async function init() {
  const settings = await getSettings();

  if (!settings.githubToken) {
    showFirstRunSetup(settings);
    return;
  }

  const shell = renderShell();
  renderSettingsPanel(shell.settingsSlot, { settings, onSaved: init, forceOpen: false });

  // Wire up close window button
  shell.closeBtn?.addEventListener('click', closeWindowSafely);
  shell.trafficClose?.addEventListener('click', closeWindowSafely);
  shell.trafficMin?.addEventListener('click', closeWindowSafely);

  // Wire up open in new tab button
  const openInNewTab = () => {
    const url = chrome.runtime.getURL('overlay/overlay.html');
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };
  shell.openTabBtn?.addEventListener('click', openInNewTab);
  shell.trafficZoom?.addEventListener('click', openInNewTab);

  shell.mainArea.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-state__title">Fetching your repositories from GitHub…</p>
      <p class="loading-state__subtitle">Loading all public, private, and forked repos</p>
    </div>
  `;

  let repos;
  try {
    repos = await fetchAllRepos(settings.githubToken);
  } catch (error) {
    shell.mainArea.innerHTML = `
      <div class="error-state">
        <svg class="error-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p class="error-state__title">Failed to load repositories</p>
        <p class="error-state__desc">${error.message}</p>
        <button type="button" class="btn-primary" id="btn-open-settings-error">Check Settings & Token</button>
      </div>
    `;
    shell.mainArea.querySelector('#btn-open-settings-error')?.addEventListener('click', () => {
      shell.settingsSlot.querySelector('.settings__toggle')?.click();
    });
    return;
  }

  if (repos.length === 0) {
    shell.mainArea.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">No repositories found</p>
        <p class="empty-state__desc">This GitHub account doesn't have any repositories yet.</p>
      </div>
    `;
    return;
  }

  // Restore main layout
  shell.mainArea.innerHTML = `
    <div class="repo-list-panel">
      <div class="repo-list-head">
        <span class="col-status"></span>
        <span class="col-name">Repository</span>
        <span class="col-lang">Language</span>
        <span class="col-stars">Stars</span>
        <span class="col-updated">Updated</span>
        <span class="col-badges">Visibility</span>
      </div>
      <div class="repo-list-wrapper" data-slot="list"></div>
    </div>
    <aside class="detail-panel" data-slot="detail"></aside>
  `;

  shell.list = shell.mainArea.querySelector('[data-slot="list"]');
  shell.detail = shell.mainArea.querySelector('[data-slot="detail"]');

  // Update header count badge
  if (shell.headerCount) {
    shell.headerCount.textContent = `${repos.length} repo${repos.length === 1 ? '' : 's'}`;
    shell.headerCount.hidden = false;
  }

  runDashboard(shell, repos, settings);
}

function showFirstRunSetup(settings) {
  app.innerHTML = `
    <header class="app-header">
      <div class="app-header__left">
        <div class="macos-traffic-lights" aria-label="macOS Window Controls">
          <button type="button" class="traffic-light traffic-light--close" id="btn-traffic-close-init" title="Close (Esc)" aria-label="Close"></button>
          <button type="button" class="traffic-light traffic-light--minimize" id="btn-traffic-min-init" title="Close (Esc)" aria-label="Minimize"></button>
          <button type="button" class="traffic-light traffic-light--zoom" id="btn-traffic-zoom-init" title="Open in browser tab" aria-label="Zoom to tab"></button>
        </div>

        <div class="app-header__brand">
          <svg class="brand-mark" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"/>
          </svg>
          <div class="app-header__title-wrap">
            <h1>Repo Dashboard</h1>
          </div>
        </div>
      </div>
      <div class="app-header__actions">
        <button type="button" class="header-action-btn header-action-btn--close" id="btn-close-window-init" title="Close window">
          ✕ Close
        </button>
      </div>
    </header>
    <main class="first-run-slot"></main>
  `;

  app.querySelector('#btn-close-window-init')?.addEventListener('click', closeWindowSafely);
  app.querySelector('#btn-traffic-close-init')?.addEventListener('click', closeWindowSafely);
  app.querySelector('#btn-traffic-min-init')?.addEventListener('click', closeWindowSafely);
  app.querySelector('#btn-traffic-zoom-init')?.addEventListener('click', () => {
    const url = chrome.runtime.getURL('overlay/overlay.html');
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  });

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
      <div class="app-header__left">
        <div class="macos-traffic-lights" aria-label="macOS Window Controls">
          <button type="button" class="traffic-light traffic-light--close" id="btn-traffic-close" title="Close (Esc)" aria-label="Close"></button>
          <button type="button" class="traffic-light traffic-light--minimize" id="btn-traffic-min" title="Close (Esc)" aria-label="Minimize"></button>
          <button type="button" class="traffic-light traffic-light--zoom" id="btn-traffic-zoom" title="Open in browser tab" aria-label="Zoom to tab"></button>
        </div>

        <div class="app-header__brand">
          <svg class="brand-mark" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"/>
          </svg>
          <div class="app-header__title-wrap">
            <h1>Repo Dashboard</h1>
            <span class="app-header__count-badge" data-role="header-count" hidden></span>
          </div>
        </div>
      </div>

      <div class="app-header__actions">
        <button type="button" class="header-action-btn" id="btn-open-tab" title="Open in standard browser tab" aria-label="Open in standard browser tab">
          <svg class="header-action-btn__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.75.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V3.56l-4.22 4.22a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.44 2.5H10.5a.75.75 0 0 1-.75-.75Z"/>
          </svg>
          <span>Open in Tab</span>
        </button>

        <div class="app-header__settings" data-slot="settings"></div>

        <button type="button" class="header-action-btn header-action-btn--close" id="btn-close-window" title="Close Dashboard (Esc)" aria-label="Close Dashboard window">
          <svg class="header-action-btn__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
          </svg>
          <span>Close</span>
        </button>
      </div>
    </header>
    <section class="stats-bar" data-slot="stats"></section>
    <section class="controls-bar" data-slot="controls"></section>
    <main class="main-area" data-slot="main"></main>
    <footer class="status-bar" data-slot="footer"></footer>
  `;

  return {
    headerCount: app.querySelector('[data-role="header-count"]'),
    settingsSlot: app.querySelector('[data-slot="settings"]'),
    statsSlot: app.querySelector('[data-slot="stats"]'),
    controlsSlot: app.querySelector('[data-slot="controls"]'),
    mainArea: app.querySelector('[data-slot="main"]'),
    footer: app.querySelector('[data-slot="footer"]'),
    closeBtn: app.querySelector('#btn-close-window'),
    openTabBtn: app.querySelector('#btn-open-tab'),
    trafficClose: app.querySelector('#btn-traffic-close'),
    trafficMin: app.querySelector('#btn-traffic-min'),
    trafficZoom: app.querySelector('#btn-traffic-zoom'),
  };
}

function runDashboard(shell, repos, settings) {
  const rowsByRepoId = new Map();
  const descriptionsById = new Map();
  let visibleRepos = [];
  let selectedRepoId = null;

  function findRepo(id) {
    return repos.find((repo) => repo.id === id);
  }

  async function regenerateSingleRepo(repoId) {
    const repo = findRepo(repoId);
    if (!repo) return;
    const apiKey = settings.aiProvider ? settings.aiApiKeys?.[settings.aiProvider] : null;
    if (!apiKey) {
      shell.settingsSlot.querySelector('.settings__toggle')?.click();
      return;
    }

    descriptionsById.set(repoId, { status: 'pending' });
    setRowStatus(rowsByRepoId.get(repoId), 'pending');
    refreshDetailPanel();

    try {
      const description = await generateDescription({
        provider: settings.aiProvider,
        apiKey,
        githubToken: settings.githubToken,
        repo,
      });
      await setCachedDescription(repoId, { pushedAt: repo.pushed_at, description });
      descriptionsById.set(repoId, { status: 'ready', text: description });
      setRowStatus(rowsByRepoId.get(repoId), 'ready');
    } catch (err) {
      descriptionsById.set(repoId, { status: 'error', text: err.message });
      setRowStatus(rowsByRepoId.get(repoId), 'error');
    }
    refreshDetailPanel();
  }

  function refreshDetailPanel() {
    const repo = selectedRepoId != null ? findRepo(selectedRepoId) : null;
    renderDetailPanel(shell.detail, repo, descriptionsById.get(selectedRepoId), {
      onRegenerate: regenerateSingleRepo,
      onOpenSettings: () => shell.settingsSlot.querySelector('.settings__toggle')?.click(),
      githubToken: settings.githubToken,
      onParentLoaded: (enrichedRepo) => {
        rowsByRepoId.get(enrichedRepo.id)?.updateStars?.();
      },
    });
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

  // Interactive Stats Bar
  renderStatsBar(shell.statsSlot, repos, {
    onFilterSelect: (filterId) => {
      shell.controlsSlot.setFilter?.(filterId);
    },
  });

  // Controls bar with sync back to stats bar
  renderControls(shell.controlsSlot, {
    onFilterChange: (filtered) => {
      visibleRepos = filtered;
      shell.list.innerHTML = '';
      for (const repo of filtered) shell.list.appendChild(rowsByRepoId.get(repo.id));

      const stillVisible = filtered.some((repo) => repo.id === selectedRepoId);
      if (!stillVisible) {
        selectRepo(filtered.length > 0 ? filtered[0].id : null);
      }

      updateFooter(shell.footer, filtered.length, repos.length);
    },
    onRefresh: async () => {
      await init();
    },
  });

  shell.controlsSlot.setRepos(repos);

  setUpKeyboardShortcuts(shell, moveSelection, () => selectedRepoId, findRepo);

  fillInAiDescriptions(repos, rowsByRepoId, descriptionsById, settings, () => selectedRepoId, refreshDetailPanel);

  if (settings.githubToken) {
    enrichForksWithParent(repos, settings.githubToken, (enrichedRepo) => {
      const row = rowsByRepoId.get(enrichedRepo.id);
      row?.updateStars?.();
      if (selectedRepoId === enrichedRepo.id) {
        refreshDetailPanel();
      }
    });
  }
}

function updateFooter(footer, visibleCount, totalCount) {
  footer.innerHTML = `
    <div class="footer-left">
      <span class="footer-count">${visibleCount} of ${totalCount} repositories</span>
    </div>
    <div class="footer-shortcuts">
      <span class="shortcut-item"><kbd>Esc</kbd> Close</span>
      <span class="shortcut-item"><kbd>↑</kbd><kbd>↓</kbd> Select</span>
      <span class="shortcut-item"><kbd>Enter</kbd> Open on GitHub</span>
      <span class="shortcut-item"><kbd>/</kbd> Search</span>
    </div>
  `;
}

function setUpKeyboardShortcuts(shell, moveSelection, getSelectedId, findRepo) {
  if (activeKeydownHandler) {
    document.removeEventListener('keydown', activeKeydownHandler);
  }

  activeKeydownHandler = (event) => {
    const tag = document.activeElement.tagName;
    const isTyping = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

    if (event.key === 'Escape') {
      event.preventDefault();
      const modal = document.querySelector('.modal-backdrop--visible');
      if (modal) {
        modal.classList.remove('modal-backdrop--visible');
      } else {
        closeWindowSafely();
      }
      return;
    }

    if (event.key === '/' && !isTyping) {
      event.preventDefault();
      shell.controlsSlot.querySelector('#repo-search')?.focus();
      return;
    }

    if (isTyping) return;

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

