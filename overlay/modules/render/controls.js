// overlay/modules/render/controls.js
//
// Renders the search box + segmented filter chips + sort dropdown + refresh button.

export function renderControls(container, {
  initialViewMode = 'tiles',
  initialGroupBy = 'none',
  inspectorOpen = true,
  onFilterChange,
  onViewModeChange,
  onGroupByChange,
  onToggleInspector,
  onOpenCommits,
  onRefresh,
}) {
  let currentViewMode = initialViewMode;
  let currentGroupBy = initialGroupBy;
  let isInspectorOpen = inspectorOpen;

  container.innerHTML = `
    <div class="controls-bar__left">
      <div class="controls-bar__search">
        <svg class="controls-bar__search-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/>
        </svg>
        <input type="search" id="repo-search" placeholder="Search by name, description, or language…" autocomplete="off" spellcheck="false" />
        <button type="button" class="controls-bar__search-clear" id="search-clear" title="Clear search" aria-label="Clear search" hidden>✕</button>
        <kbd class="controls-bar__kbd" title="Press / to focus search">/</kbd>
      </div>

      <div class="controls-bar__filter-chips" role="tablist" aria-label="Filter repositories">
        <button type="button" class="filter-chip filter-chip--active" data-filter="all">All</button>
        <button type="button" class="filter-chip" data-filter="recent">Recently Edited</button>
        <button type="button" class="filter-chip" data-filter="original">Originals</button>
        <button type="button" class="filter-chip" data-filter="fork">Forks</button>
        <button type="button" class="filter-chip" data-filter="untouched">Untouched</button>
        <button type="button" class="filter-chip" data-filter="private">Private</button>
      </div>
    </div>

    <div class="controls-bar__right-group">
      <!-- macOS View Mode Switcher -->
      <div class="view-switcher" role="group" aria-label="View mode">
        <button type="button" class="view-switcher__btn ${currentViewMode === 'tiles' ? 'view-switcher__btn--active' : ''}" data-view="tiles" title="Floor Tiles View">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3Zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3Zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3Zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3Z"/>
          </svg>
          <span>Tiles</span>
        </button>
        <button type="button" class="view-switcher__btn ${currentViewMode === 'list' ? 'view-switcher__btn--active' : ''}" data-view="list" title="List View">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75Zm0 4.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 4.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"/>
          </svg>
          <span>List</span>
        </button>
      </div>

      <!-- Group By Dropdown -->
      <div class="controls-bar__select-wrap" title="Group repositories by">
        <select id="repo-group" aria-label="Group repositories by">
          <option value="none" ${currentGroupBy === 'none' ? 'selected' : ''}>No grouping</option>
          <option value="folder" ${currentGroupBy === 'folder' ? 'selected' : ''}>Group by Folder</option>
          <option value="language" ${currentGroupBy === 'language' ? 'selected' : ''}>Group by Language</option>
          <option value="type" ${currentGroupBy === 'type' ? 'selected' : ''}>Group by Type</option>
          <option value="year" ${currentGroupBy === 'year' ? 'selected' : ''}>Group by Year</option>
        </select>
        <svg class="select-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="m4.427 6.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427Z"/>
        </svg>
      </div>

      <!-- Sort Dropdown -->
      <div class="controls-bar__select-wrap" title="Sort repositories by">
        <select id="repo-sort" aria-label="Sort repositories by">
          <option value="updated">Recently updated</option>
          <option value="stars">Most stars</option>
          <option value="forks">Most forks</option>
          <option value="name">Name (A–Z)</option>
        </select>
        <svg class="select-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="m4.427 6.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427Z"/>
        </svg>
      </div>

      <!-- Recent Commits Popup Button -->
      <button type="button" class="controls-bar__btn controls-bar__btn--commits" id="btn-recent-commits" title="View Recent Commits across recently edited repositories (C)" aria-label="View Recent Commits">
        <svg class="icon-commit" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5h-3.32Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/>
        </svg>
        <span class="controls-bar__btn-label">Recent Commits</span>
        <kbd class="controls-bar__kbd-subtle">C</kbd>
      </button>

      <!-- Inspector Toggle -->
      <button type="button" class="controls-bar__btn ${isInspectorOpen ? 'controls-bar__btn--active' : ''}" id="btn-toggle-inspector" title="Toggle Details Inspector (I)" aria-label="Toggle Details Inspector">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M14 2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1ZM2.5 3.5h7v9h-7v-9Zm8.5 9v-9h2.5v9H11Z"/>
        </svg>
      </button>

      ${
        onRefresh
          ? `<button type="button" class="controls-bar__btn" id="repo-refresh" title="Refresh repositories from GitHub" aria-label="Refresh repositories">
              <svg class="icon icon-refresh" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"/>
              </svg>
            </button>`
          : ''
      }
    </div>
  `;

  let fullRepoList = [];
  let currentFilter = 'all';

  const searchInput = container.querySelector('#repo-search');
  const clearBtn = container.querySelector('#search-clear');
  const sortSelect = container.querySelector('#repo-sort');
  const groupSelect = container.querySelector('#repo-group');
  const filterChips = container.querySelectorAll('.filter-chip');
  const refreshBtn = container.querySelector('#repo-refresh');
  const viewButtons = container.querySelectorAll('.view-switcher__btn');
  const inspectorBtn = container.querySelector('#btn-toggle-inspector');
  const commitsBtn = container.querySelector('#btn-recent-commits');

  function applyAndNotify() {
    const query = searchInput.value.trim().toLowerCase();
    const sortBy = sortSelect.value;
    clearBtn.hidden = !query;

    const filtered = fullRepoList.filter((repo) => matchesFilter(repo, currentFilter, fullRepoList) && matchesQuery(repo, query));
    onFilterChange(sortRepos(filtered, sortBy), { groupBy: currentGroupBy, viewMode: currentViewMode });
  }

  function setFilter(filterId) {
    currentFilter = filterId;
    filterChips.forEach((chip) => {
      chip.classList.toggle('filter-chip--active', chip.dataset.filter === filterId);
    });
    applyAndNotify();
  }

  function setViewMode(mode) {
    currentViewMode = mode;
    viewButtons.forEach((btn) => {
      btn.classList.toggle('view-switcher__btn--active', btn.dataset.view === mode);
    });
    if (onViewModeChange) onViewModeChange(mode);
    applyAndNotify();
  }

  function setInspectorOpen(isOpen) {
    isInspectorOpen = isOpen;
    inspectorBtn?.classList.toggle('controls-bar__btn--active', isOpen);
  }

  // Exposed methods
  container.setFilter = setFilter;
  container.setViewMode = setViewMode;
  container.setInspectorOpen = setInspectorOpen;
  container.applyFilter = applyAndNotify;

  container.setRepos = (repos) => {
    fullRepoList = repos;
    applyAndNotify();
  };

  searchInput.addEventListener('input', applyAndNotify);

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    applyAndNotify();
  });

  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      setFilter(chip.dataset.filter);
    });
  });

  sortSelect.addEventListener('change', applyAndNotify);

  groupSelect.addEventListener('change', () => {
    currentGroupBy = groupSelect.value;
    if (onGroupByChange) onGroupByChange(currentGroupBy);
    applyAndNotify();
  });

  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setViewMode(btn.dataset.view);
    });
  });

  inspectorBtn?.addEventListener('click', () => {
    isInspectorOpen = !isInspectorOpen;
    inspectorBtn.classList.toggle('controls-bar__btn--active', isInspectorOpen);
    if (onToggleInspector) onToggleInspector(isInspectorOpen);
  });

  commitsBtn?.addEventListener('click', () => {
    if (onOpenCommits) onOpenCommits();
  });

  if (refreshBtn && onRefresh) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('is-refreshing');
      onRefresh().finally(() => {
        refreshBtn.classList.remove('is-refreshing');
      });
    });
  }
}

function matchesFilter(repo, filterBy, allRepos = []) {
  if (filterBy === 'recent') return isRecentRepo(repo, allRepos);
  if (filterBy === 'original') return !repo.isFork;
  if (filterBy === 'fork') return repo.isFork;
  if (filterBy === 'untouched') return repo.looksUntouched;
  if (filterBy === 'private') return repo.isPrivate;
  return true; // 'all'
}

function isRecentRepo(repo, allRepos = []) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const pushedTime = new Date(repo.pushed_at || repo.updatedAt).getTime();
  if (pushedTime >= thirtyDaysAgo) return true;

  // Fallback: top 15 most recently updated repos
  if (allRepos && allRepos.length > 0) {
    const topIds = new Set(
      [...allRepos]
        .sort((a, b) => new Date(b.pushed_at || b.updatedAt).getTime() - new Date(a.pushed_at || a.updatedAt).getTime())
        .slice(0, 15)
        .map((r) => r.id)
    );
    return topIds.has(repo.id);
  }
  return false;
}


function matchesQuery(repo, query) {
  if (!query) return true;
  return (
    repo.name.toLowerCase().includes(query) ||
    (repo.description || '').toLowerCase().includes(query) ||
    (repo.language || '').toLowerCase().includes(query)
  );
}

function sortRepos(repos, sortBy) {
  const copy = [...repos];
  return copy.sort((a, b) => {
    // Pinned repos always float to the top
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    if (sortBy === 'stars') {
      const aVal = a.parentStars != null ? a.parentStars : a.stars;
      const bVal = b.parentStars != null ? b.parentStars : b.stars;
      return bVal - aVal;
    }
    if (sortBy === 'forks') {
      const aVal = a.parent?.forksCount != null ? a.parent.forksCount : (a.forksCount ?? 0);
      const bVal = b.parent?.forksCount != null ? b.parent.forksCount : (b.forksCount ?? 0);
      return bVal - aVal;
    }
    if (sortBy === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
    return new Date(b.updatedAt) - new Date(a.updatedAt); // 'updated'
  });
}

