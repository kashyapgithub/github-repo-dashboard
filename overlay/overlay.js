// overlay/overlay.js
//
// Entry point for the dashboard window. Deliberately thin: it only
// orchestrates — fetch data, hand it to render modules, wire up the
// AI-generation pipeline. All the actual logic lives in modules/.

import { getSettings, getCachedDescription, setCachedDescription } from './modules/storage.js';
import { fetchAllRepos } from './modules/github-api.js';
import { generateDescription } from './modules/ai/index.js';
import { runWithConcurrency } from './modules/concurrency.js';
import { renderSettingsPanel } from './modules/render/settingsPanel.js';
import { renderStatsBar } from './modules/render/statsBar.js';
import { renderControls } from './modules/render/controls.js';
import { createRepoCard, setCardDescription, setCardError } from './modules/render/repoCard.js';

// How many AI description requests are allowed to be in flight at
// once. Kept low so a free-tier provider (e.g. Gemini) doesn't get
// hit with a burst of simultaneous requests when you have hundreds of
// repos — see modules/concurrency.js.
const AI_REQUEST_CONCURRENCY = 3;

const app = document.getElementById('app');

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
    shell.main.innerHTML = `
      <div class="error-state">
        <p>${error.message}</p>
        <p>Open settings (top right) and double-check the token.</p>
      </div>
    `;
    return;
  }

  if (repos.length === 0) {
    shell.main.innerHTML = '<div class="empty-state"><p>No repositories found for this account.</p></div>';
    return;
  }

  renderStatsBar(shell.statsSlot, repos);

  // Build every card up front from GitHub data alone; AI descriptions
  // fill in asynchronously afterwards. Cards are kept in a map so the
  // controls module can reorder/filter them without rebuilding DOM.
  const cardsByRepoId = new Map(repos.map((repo) => [repo.id, createRepoCard(repo)]));

  renderControls(shell.controlsSlot, {
    onFilterChange: (visibleRepos) => {
      shell.grid.innerHTML = '';
      for (const repo of visibleRepos) {
        shell.grid.appendChild(cardsByRepoId.get(repo.id));
      }
    },
  });
  shell.controlsSlot.setRepos(repos); // triggers the first (unfiltered) render

  await fillInAiDescriptions(repos, cardsByRepoId, settings);
}

function showFirstRunSetup(settings) {
  app.innerHTML = '<div class="first-run-slot"></div>';
  renderSettingsPanel(app.querySelector('.first-run-slot'), {
    settings,
    onSaved: init,
    forceOpen: true,
  });
}

/** Builds the static page shell (header/stats/controls/grid containers) once. */
function renderShell() {
  app.innerHTML = `
    <header class="app-header">
      <h1>Repo Dashboard</h1>
      <div class="app-header__settings" data-slot="settings"></div>
    </header>
    <section class="stats-bar" data-slot="stats"></section>
    <section class="controls-bar" data-slot="controls"></section>
    <main class="repo-grid-wrapper" data-slot="main">
      <div class="repo-grid" data-slot="grid"></div>
    </main>
  `;

  return {
    settingsSlot: app.querySelector('[data-slot="settings"]'),
    statsSlot: app.querySelector('[data-slot="stats"]'),
    controlsSlot: app.querySelector('[data-slot="controls"]'),
    main: app.querySelector('[data-slot="main"]'),
    grid: app.querySelector('[data-slot="grid"]'),
  };
}

/**
 * Fills in every card's AI-description slot: reuses a cached
 * description when the repo hasn't been pushed to since it was
 * generated, otherwise generates a fresh one — throttled so we never
 * have more than AI_REQUEST_CONCURRENCY requests in flight.
 */
async function fillInAiDescriptions(repos, cardsByRepoId, settings) {
  const apiKey = settings.aiProvider ? settings.aiApiKeys?.[settings.aiProvider] : null;

  if (!apiKey) {
    for (const repo of repos) {
      setCardDescription(cardsByRepoId.get(repo.id), 'Add an AI API key in settings to generate summaries.', {
        muted: true,
      });
    }
    return;
  }

  await runWithConcurrency(repos, AI_REQUEST_CONCURRENCY, async (repo) => {
    const card = cardsByRepoId.get(repo.id);
    const cached = await getCachedDescription(repo.id);

    if (cached && cached.pushedAt === repo.pushed_at) {
      setCardDescription(card, cached.description);
      return;
    }

    try {
      setCardDescription(card, null, { loading: true });
      const description = await generateDescription({
        provider: settings.aiProvider,
        apiKey,
        githubToken: settings.githubToken,
        repo,
      });
      await setCachedDescription(repo.id, { pushedAt: repo.pushed_at, description });
      setCardDescription(card, description);
    } catch (error) {
      setCardError(card, error);
    }
  });
}
