// overlay/overlay.js
//
// Entry point for the dashboard window. Orchestrates: fetch repos,
// render the list or floor tiles view + detail panel, run AI description
// generation in the background, and wire up selection and navigation.

import {
  getSettings,
  getCachedDescription,
  setCachedDescription,
  getUiPreferences,
  saveUiPreferences,
  getPinnedRepoIds,
  togglePinnedRepo,
  getFolders,
  getRepoFolders,
  setRepoFolder,
  removeRepoFromFolder,
} from './modules/storage.js';
import { fetchAllRepos, enrichForksWithParent } from './modules/github-api.js';
import { generateDescription } from './modules/ai/index.js';
import { runWithConcurrency } from './modules/concurrency.js';
import { renderSettingsPanel } from './modules/render/settingsPanel.js';
import { renderStatsBar } from './modules/render/statsBar.js';
import { renderControls } from './modules/render/controls.js';
import { renderFolderBar } from './modules/render/folderBar.js';
import { createRepoRow, setRowStatus } from './modules/render/repoRow.js';
import { createRepoTile } from './modules/render/repoTile.js';
import { renderDetailPanel } from './modules/render/detailPanel.js';
import { renderCommitsPanel } from './modules/render/commitsPanel.js';
import { escapeHtml } from './modules/format.js';

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
  const [settings, uiPrefs, pinnedIds, folders, repoFolders] = await Promise.all([
    getSettings(),
    getUiPreferences(),
    getPinnedRepoIds(),
    getFolders(),
    getRepoFolders(),
  ]);

  if (!settings.githubToken) {
    showFirstRunSetup(settings);
    return;
  }

  const shell = renderShell(uiPrefs);
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

  // Decorate repos with pinned and folder states
  const pinnedSet = new Set(pinnedIds);
  for (const repo of repos) {
    repo.isPinned = pinnedSet.has(repo.id);
    repo.folderId = repoFolders[repo.id] || null;
  }

  // Restore main layout with dual-view (List or Floor Tiles) and collapsible Detail Inspector
  shell.mainArea.innerHTML = `
    <div class="content-panel">
      <!-- List View Container -->
      <div class="repo-list-view ${uiPrefs.viewMode === 'list' ? '' : 'repo-view--hidden'}">
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

      <!-- Floor Tiles View Container -->
      <div class="repo-grid-view ${uiPrefs.viewMode === 'tiles' ? '' : 'repo-view--hidden'}">
        <div class="repo-grid-wrapper" data-slot="grid"></div>
      </div>
    </div>
    <aside class="detail-panel ${uiPrefs.inspectorOpen ? '' : 'detail-panel--collapsed'}" data-slot="detail"></aside>
  `;

  shell.contentPanel = shell.mainArea.querySelector('.content-panel');
  shell.listView = shell.mainArea.querySelector('.repo-list-view');
  shell.gridView = shell.mainArea.querySelector('.repo-grid-view');
  shell.list = shell.mainArea.querySelector('[data-slot="list"]');
  shell.grid = shell.mainArea.querySelector('[data-slot="grid"]');
  shell.detail = shell.mainArea.querySelector('[data-slot="detail"]');

  // Update header count badge
  if (shell.headerCount) {
    shell.headerCount.textContent = `${repos.length} repo${repos.length === 1 ? '' : 's'}`;
    shell.headerCount.hidden = false;
  }

  runDashboard(shell, repos, settings, uiPrefs, { folders, repoFolders });
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
function renderShell(uiPrefs) {
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
    <section class="folder-bar" data-slot="folders"></section>
    <main class="main-area" data-slot="main"></main>
    <footer class="status-bar" data-slot="footer"></footer>
    <div class="commits-panel-slot" data-slot="commits"></div>
  `;

  return {
    headerCount: app.querySelector('[data-role="header-count"]'),
    settingsSlot: app.querySelector('[data-slot="settings"]'),
    statsSlot: app.querySelector('[data-slot="stats"]'),
    controlsSlot: app.querySelector('[data-slot="controls"]'),
    foldersSlot: app.querySelector('[data-slot="folders"]'),
    commitsSlot: app.querySelector('[data-slot="commits"]'),
    mainArea: app.querySelector('[data-slot="main"]'),
    footer: app.querySelector('[data-slot="footer"]'),
    closeBtn: app.querySelector('#btn-close-window'),
    openTabBtn: app.querySelector('#btn-open-tab'),
    trafficClose: app.querySelector('#btn-traffic-close'),
    trafficMin: app.querySelector('#btn-traffic-min'),
    trafficZoom: app.querySelector('#btn-traffic-zoom'),
  };
}

function runDashboard(shell, repos, settings, uiPrefs, { folders = [], repoFolders = {} } = {}) {
  let currentViewMode = uiPrefs.viewMode;
  let currentGroupBy = uiPrefs.groupBy;
  let isInspectorOpen = uiPrefs.inspectorOpen;
  let currentFolders = [...folders];
  let activeFolderId = uiPrefs.activeFolderId || 'all';

  const rowsByRepoId = new Map();
  const tilesByRepoId = new Map();
  const descriptionsById = new Map();
  let visibleRepos = [];
  let selectedRepoId = null;

  function findRepo(id) {
    return repos.find((repo) => repo.id === id);
  }

  function computeFolderCounts() {
    let pinned = 0;
    const folderCounts = {};
    for (const f of currentFolders) {
      folderCounts[f.id] = 0;
    }
    for (const r of repos) {
      if (r.isPinned) pinned++;
      if (r.folderId && folderCounts[r.folderId] !== undefined) {
        folderCounts[r.folderId]++;
      }
    }
    return {
      total: repos.length,
      pinned,
      folderCounts,
    };
  }

  const initialCounts = computeFolderCounts();
  const folderBar = renderFolderBar(shell.foldersSlot, {
    folders: currentFolders,
    activeFolderId,
    totalCount: initialCounts.total,
    pinnedCount: initialCounts.pinned,
    folderCounts: initialCounts.folderCounts,
    onSelectFolder: (fId) => {
      activeFolderId = fId;
      saveUiPreferences({ activeFolderId: fId });
      shell.controlsSlot.applyFilter?.();
    },
    onFolderCreated: (newFolder) => {
      currentFolders.push(newFolder);
      refreshDetailPanel();
    },
    onFolderUpdated: (updatedFolder) => {
      const idx = currentFolders.findIndex((f) => f.id === updatedFolder.id);
      if (idx >= 0) currentFolders[idx] = updatedFolder;
      for (const r of repos) {
        if (r.folderId === updatedFolder.id) {
          rowsByRepoId.get(r.id)?.updateFolder?.(updatedFolder);
          tilesByRepoId.get(r.id)?.updateFolder?.(updatedFolder);
        }
      }
      refreshDetailPanel();
    },
    onFolderDeleted: (deletedFolderId) => {
      currentFolders = currentFolders.filter((f) => f.id !== deletedFolderId);
      for (const r of repos) {
        if (r.folderId === deletedFolderId) {
          r.folderId = null;
          rowsByRepoId.get(r.id)?.updateFolder?.(null);
          tilesByRepoId.get(r.id)?.updateFolder?.(null);
        }
      }
      folderBar.updateCounts(computeFolderCounts());
      refreshDetailPanel();
      shell.controlsSlot.applyFilter?.();
    },
  });

  const commitsPanel = renderCommitsPanel(shell.commitsSlot, {
    token: settings.githubToken,
    repos,
    onOpenRepo: (repoId) => {
      selectRepo(repoId);
    },
  });

  async function handleTogglePin(repoId) {
    const repo = findRepo(repoId);
    if (!repo) return;
    const isNowPinned = await togglePinnedRepo(repoId);
    repo.isPinned = isNowPinned;

    rowsByRepoId.get(repoId)?.updatePin?.(isNowPinned);
    tilesByRepoId.get(repoId)?.updatePin?.(isNowPinned);

    folderBar.updateCounts(computeFolderCounts());

    if (selectedRepoId === repoId) {
      refreshDetailPanel();
    }
    shell.controlsSlot.applyFilter?.();
  }

  async function handleAssignFolder(repoId, folderId) {
    const repo = findRepo(repoId);
    if (!repo) return;

    if (folderId) {
      await setRepoFolder(repoId, folderId);
      repo.folderId = folderId;
    } else {
      await removeRepoFromFolder(repoId);
      repo.folderId = null;
    }

    const assignedFolder = currentFolders.find((f) => f.id === repo.folderId) || null;

    rowsByRepoId.get(repoId)?.updateFolder?.(assignedFolder);
    tilesByRepoId.get(repoId)?.updateFolder?.(assignedFolder);

    folderBar.updateCounts(computeFolderCounts());

    if (selectedRepoId === repoId) {
      refreshDetailPanel();
    }
    shell.controlsSlot.applyFilter?.();
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
    tilesByRepoId.get(repoId)?.updateAi?.({ status: 'pending' });
    refreshDetailPanel();

    try {
      const description = await generateDescription({
        provider: settings.aiProvider,
        apiKey,
        githubToken: settings.githubToken,
        repo,
      });
      await setCachedDescription(repoId, { pushedAt: repo.pushed_at, description });
      const readyEntry = { status: 'ready', text: description };
      descriptionsById.set(repoId, readyEntry);
      setRowStatus(rowsByRepoId.get(repoId), 'ready');
      tilesByRepoId.get(repoId)?.updateAi?.(readyEntry);
    } catch (err) {
      const errEntry = { status: 'error', text: err.message };
      descriptionsById.set(repoId, errEntry);
      setRowStatus(rowsByRepoId.get(repoId), 'error');
      tilesByRepoId.get(repoId)?.updateAi?.(errEntry);
    }
    refreshDetailPanel();
  }

  function refreshDetailPanel() {
    const repo = selectedRepoId != null ? findRepo(selectedRepoId) : null;
    renderDetailPanel(shell.detail, repo, descriptionsById.get(selectedRepoId), {
      onRegenerate: regenerateSingleRepo,
      onOpenSettings: () => shell.settingsSlot.querySelector('.settings__toggle')?.click(),
      onViewCommits: (targetRepo) => {
        commitsPanel.open({ repoId: targetRepo.id });
      },
      onTogglePin: handleTogglePin,
      onAssignFolder: handleAssignFolder,
      onCreateFolder: () => folderBar.openNewFolderModal(),
      folders: currentFolders,
      githubToken: settings.githubToken,
      onParentLoaded: (enrichedRepo) => {
        rowsByRepoId.get(enrichedRepo.id)?.updateStars?.();
        tilesByRepoId.get(enrichedRepo.id)?.updateStars?.();
      },
    });
  }

  function selectRepo(repoId) {
    if (selectedRepoId != null) {
      rowsByRepoId.get(selectedRepoId)?.classList.remove('repo-row--selected');
      tilesByRepoId.get(selectedRepoId)?.setSelected?.(false);
    }
    selectedRepoId = repoId;
    const row = rowsByRepoId.get(repoId);
    const tile = tilesByRepoId.get(repoId);

    row?.classList.add('repo-row--selected');
    tile?.setSelected?.(true);

    if (currentViewMode === 'list') {
      row?.scrollIntoView({ block: 'nearest' });
    } else {
      tile?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    refreshDetailPanel();
  }

  function moveSelection(delta) {
    if (visibleRepos.length === 0) return;
    const currentIndex = visibleRepos.findIndex((repo) => repo.id === selectedRepoId);
    const nextIndex = Math.min(Math.max(currentIndex + delta, 0), visibleRepos.length - 1);
    selectRepo(visibleRepos[nextIndex].id);
  }

  function toggleInspector(open) {
    isInspectorOpen = open !== undefined ? open : !isInspectorOpen;
    shell.detail.classList.toggle('detail-panel--collapsed', !isInspectorOpen);
    shell.controlsSlot.setInspectorOpen?.(isInspectorOpen);
    saveUiPreferences({ inspectorOpen: isInspectorOpen });
  }

  // Pre-instantiate both rows and tiles for instant lag-free switching
  for (const repo of repos) {
    const folderObj = currentFolders.find((f) => f.id === repo.folderId) || null;
    rowsByRepoId.set(
      repo.id,
      createRepoRow(repo, {
        onSelect: selectRepo,
        onTogglePin: handleTogglePin,
        initialFolder: folderObj,
      })
    );
    tilesByRepoId.set(
      repo.id,
      createRepoTile(repo, {
        onSelect: selectRepo,
        onTogglePin: handleTogglePin,
        initialFolder: folderObj,
        initialAiEntry: descriptionsById.get(repo.id),
      })
    );
  }

  // Interactive Stats Bar
  renderStatsBar(shell.statsSlot, repos, {
    onFilterSelect: (filterId) => {
      shell.controlsSlot.setFilter?.(filterId);
    },
  });

  // Render visible repositories into either List or Floor Tiles grid
  function renderVisibleRepos(filtered, { groupBy = currentGroupBy, viewMode = currentViewMode } = {}) {
    visibleRepos = filtered;
    currentGroupBy = groupBy;
    currentViewMode = viewMode;

    if (viewMode === 'list') {
      shell.listView.classList.remove('repo-view--hidden');
      shell.gridView.classList.add('repo-view--hidden');
      shell.list.innerHTML = '';
      if (groupBy === 'none') {
        for (const repo of filtered) {
          shell.list.appendChild(rowsByRepoId.get(repo.id));
        }
      } else {
        const groups = groupRepositories(filtered, groupBy, currentFolders);
        for (const group of groups) {
          if (group.title && group.repos.length > 0) {
            const header = document.createElement('div');
            header.className = 'repo-list-group-header';
            header.innerHTML = `
              <span class="repo-list-group-title">${escapeHtml(group.title)}</span>
              <span class="repo-list-group-count">${group.repos.length}</span>
            `;
            shell.list.appendChild(header);
          }
          for (const repo of group.repos) {
            shell.list.appendChild(rowsByRepoId.get(repo.id));
          }
        }
      }
    } else {
      shell.gridView.classList.remove('repo-view--hidden');
      shell.listView.classList.add('repo-view--hidden');
      shell.grid.innerHTML = '';

      const groups = groupRepositories(filtered, groupBy, currentFolders);
      for (const group of groups) {
        if (group.title) {
          const groupEl = document.createElement('section');
          groupEl.className = 'grid-group';
          groupEl.innerHTML = `
            <div class="grid-group__header">
              <h3 class="grid-group__title">${escapeHtml(group.title)}</h3>
              <span class="grid-group__count">${group.repos.length} ${group.repos.length === 1 ? 'repo' : 'repos'}</span>
            </div>
            <div class="repo-grid"></div>
          `;
          const gridEl = groupEl.querySelector('.repo-grid');
          for (const r of group.repos) {
            gridEl.appendChild(tilesByRepoId.get(r.id));
          }
          shell.grid.appendChild(groupEl);
        } else {
          const gridEl = document.createElement('div');
          gridEl.className = 'repo-grid';
          for (const r of group.repos) {
            gridEl.appendChild(tilesByRepoId.get(r.id));
          }
          shell.grid.appendChild(gridEl);
        }
      }
    }

    const stillVisible = filtered.some((r) => r.id === selectedRepoId);
    if (!stillVisible) {
      selectRepo(filtered.length > 0 ? filtered[0].id : null);
    } else if (selectedRepoId != null) {
      selectRepo(selectedRepoId);
    }

    updateFooter(shell.footer, filtered.length, repos.length, currentViewMode);
  }

  // Controls bar with sync to stats bar, view switcher, group by, inspector toggle
  renderControls(shell.controlsSlot, {
    initialViewMode: currentViewMode,
    initialGroupBy: currentGroupBy,
    inspectorOpen: isInspectorOpen,
    onFilterChange: (filtered, { groupBy, viewMode }) => {
      let folderFiltered = filtered;
      if (activeFolderId === 'pinned') {
        folderFiltered = filtered.filter((r) => r.isPinned);
      } else if (activeFolderId && activeFolderId !== 'all') {
        folderFiltered = filtered.filter((r) => r.folderId === activeFolderId);
      }
      renderVisibleRepos(folderFiltered, { groupBy, viewMode });
    },
    onViewModeChange: (newMode) => {
      currentViewMode = newMode;
      saveUiPreferences({ viewMode: newMode });
      shell.controlsSlot.applyFilter?.();
    },
    onGroupByChange: (newGroup) => {
      currentGroupBy = newGroup;
      saveUiPreferences({ groupBy: newGroup });
      shell.controlsSlot.applyFilter?.();
    },
    onToggleInspector: (isOpen) => {
      toggleInspector(isOpen);
    },
    onOpenCommits: () => {
      commitsPanel.open();
    },
    onRefresh: async () => {
      await init();
    },
  });

  shell.controlsSlot.setRepos(repos);

  setUpKeyboardShortcuts(
    shell,
    moveSelection,
    () => selectedRepoId,
    findRepo,
    () => currentViewMode,
    () => toggleInspector(),
    () => (commitsPanel.isOpen() ? commitsPanel.close() : commitsPanel.open()),
    handleTogglePin
  );

  fillInAiDescriptions(repos, rowsByRepoId, tilesByRepoId, descriptionsById, settings, () => selectedRepoId, refreshDetailPanel);

  if (settings.githubToken) {
    enrichForksWithParent(repos, settings.githubToken, (enrichedRepo) => {
      rowsByRepoId.get(enrichedRepo.id)?.updateStars?.();
      tilesByRepoId.get(enrichedRepo.id)?.updateStars?.();
      if (selectedRepoId === enrichedRepo.id) {
        refreshDetailPanel();
      }
    });
  }
}

function groupRepositories(repoList, groupBy, folders = []) {
  if (groupBy === 'none') {
    return [{ id: 'all', title: null, repos: repoList }];
  }

  if (groupBy === 'folder') {
    const res = [];
    const usedRepoIds = new Set();

    // 1. Folders in user-defined order
    for (const folder of folders) {
      const folderRepos = repoList.filter((r) => r.folderId === folder.id);
      if (folderRepos.length > 0) {
        res.push({
          id: `folder-${folder.id}`,
          title: folder.name,
          repos: folderRepos,
        });
        folderRepos.forEach((r) => usedRepoIds.add(r.id));
      }
    }

    // 2. Unfiled Pinned Repos (Keep Pin Icon)
    const unfiledPinned = repoList.filter((r) => !usedRepoIds.has(r.id) && r.isPinned);
    if (unfiledPinned.length > 0) {
      res.push({
        id: 'folder-pinned-unfiled',
        title: folders.length > 0 ? '📌 Pinned (Unfiled)' : '📌 Pinned Repositories',
        repos: unfiledPinned,
      });
      unfiledPinned.forEach((r) => usedRepoIds.add(r.id));
    }

    // 3. Other Unfiled Repos
    const unfiledOthers = repoList.filter((r) => !usedRepoIds.has(r.id));
    if (unfiledOthers.length > 0) {
      res.push({
        id: 'folder-unfiled',
        title: 'Unfiled Repositories',
        repos: unfiledOthers,
      });
    }

    return res.length > 0 ? res : [{ id: 'all', title: null, repos: repoList }];
  }

  if (groupBy === 'language') {
    const groups = new Map();
    for (const r of repoList) {
      const lang = r.language || 'Plain Text & Other';
      if (!groups.has(lang)) groups.set(lang, []);
      groups.get(lang).push(r);
    }
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
      if (a === 'Plain Text & Other') return 1;
      if (b === 'Plain Text & Other') return -1;
      return groups.get(b).length - groups.get(a).length;
    });
    return sortedKeys.map((k) => ({ id: `lang-${k}`, title: k, repos: groups.get(k) }));
  }

  if (groupBy === 'type') {
    const originals = repoList.filter((r) => !r.isFork);
    const activeForks = repoList.filter((r) => r.isFork && !r.looksUntouched);
    const untouchedForks = repoList.filter((r) => r.isFork && r.looksUntouched);
    const res = [];
    if (originals.length) res.push({ id: 'type-orig', title: 'Original Repositories', repos: originals });
    if (activeForks.length) res.push({ id: 'type-active-forks', title: 'Active Forks', repos: activeForks });
    if (untouchedForks.length) res.push({ id: 'type-untouched-forks', title: 'Untouched Forks', repos: untouchedForks });
    return res;
  }

  if (groupBy === 'year') {
    const groups = new Map();
    for (const r of repoList) {
      const year = r.updatedAt ? new Date(r.updatedAt).getFullYear() : 'Unknown';
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(r);
    }
    const sortedYears = Array.from(groups.keys()).sort((a, b) => {
      if (typeof b === 'number' && typeof a === 'number') return b - a;
      return String(b).localeCompare(String(a));
    });
    return sortedYears.map((y) => ({ id: `year-${y}`, title: `Updated in ${y}`, repos: groups.get(y) }));
  }

  return [{ id: 'all', title: null, repos: repoList }];
}

function updateFooter(footer, visibleCount, totalCount, viewMode) {
  const isTiles = viewMode === 'tiles';
  footer.innerHTML = `
    <div class="footer-left">
      <span class="footer-count">${visibleCount} of ${totalCount} repositories</span>
      <span class="footer-mode-badge">${isTiles ? '⊞ Floor Tiles View' : '≡ List View'}</span>
    </div>
    <div class="footer-shortcuts">
      <span class="shortcut-item"><kbd>Esc</kbd> Close</span>
      <span class="shortcut-item"><kbd>${isTiles ? '←↑↓→' : '↑↓'}</kbd> Navigate</span>
      <span class="shortcut-item"><kbd>Enter</kbd> Open</span>
      <span class="shortcut-item"><kbd>P</kbd> Pin</span>
      <span class="shortcut-item"><kbd>I</kbd> Details</span>
      <span class="shortcut-item"><kbd>C</kbd> Commits</span>
      <span class="shortcut-item"><kbd>/</kbd> Search</span>
    </div>
  `;
}

function setUpKeyboardShortcuts(
  shell,
  moveSelection,
  getSelectedId,
  findRepo,
  getViewMode,
  toggleInspector,
  toggleCommits,
  togglePin
) {
  if (activeKeydownHandler) {
    document.removeEventListener('keydown', activeKeydownHandler);
  }

  function getGridColumnCount() {
    const firstGrid = shell.grid?.querySelector('.repo-grid');
    if (!firstGrid) return 1;
    const tiles = firstGrid.querySelectorAll('.repo-tile');
    if (tiles.length < 2) return 1;
    const firstTop = tiles[0].offsetTop;
    let count = 0;
    for (const t of tiles) {
      if (t.offsetTop === firstTop) count++;
      else break;
    }
    return Math.max(1, count);
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

    const isTiles = getViewMode() === 'tiles';

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(isTiles ? getGridColumnCount() : 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(isTiles ? -getGridColumnCount() : -1);
    } else if (event.key === 'ArrowRight' && isTiles) {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === 'ArrowLeft' && isTiles) {
      event.preventDefault();
      moveSelection(-1);
    } else if (event.key === 'Enter') {
      const repo = findRepo(getSelectedId());
      if (repo) window.open(repo.url, '_blank', 'noopener');
    } else if (event.key === 'p' || event.key === 'P') {
      event.preventDefault();
      const selId = getSelectedId();
      if (selId && togglePin) togglePin(selId);
    } else if (event.key === 'i' || event.key === 'I') {
      event.preventDefault();
      toggleInspector();
    } else if (event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      toggleCommits?.();
    }
  };

  document.addEventListener('keydown', activeKeydownHandler);
}

async function fillInAiDescriptions(
  repos,
  rowsByRepoId,
  tilesByRepoId,
  descriptionsById,
  settings,
  getSelectedId,
  refreshDetailPanel
) {
  const apiKey = settings.aiProvider ? settings.aiApiKeys?.[settings.aiProvider] : null;

  function updateStatus(repoId, entry) {
    descriptionsById.set(repoId, entry);
    setRowStatus(rowsByRepoId.get(repoId), entry.status);
    tilesByRepoId.get(repoId)?.updateAi?.(entry);
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
