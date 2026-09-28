// overlay/modules/render/controls.js
//
// Renders the search box + segmented filter chips + sort dropdown + refresh button.

export function renderControls(container, { onFilterChange, onRefresh }) {
  container.innerHTML = `
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
      <button type="button" class="filter-chip" data-filter="original">Originals</button>
      <button type="button" class="filter-chip" data-filter="fork">Forks</button>
      <button type="button" class="filter-chip" data-filter="untouched">Untouched</button>
      <button type="button" class="filter-chip" data-filter="private">Private</button>
    </div>

    <div class="controls-bar__right-group">
      <div class="controls-bar__select-wrap">
        <select id="repo-sort" title="Sort repositories by">
          <option value="updated">Recently updated</option>
          <option value="stars">Most stars</option>
          <option value="forks">Most forks</option>
          <option value="name">Name (A–Z)</option>
        </select>
        <svg class="select-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="m4.427 6.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427Z"/>
        </svg>
      </div>

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
  const filterChips = container.querySelectorAll('.filter-chip');
  const refreshBtn = container.querySelector('#repo-refresh');

  function applyAndNotify() {
    const query = searchInput.value.trim().toLowerCase();
    const sortBy = sortSelect.value;
    clearBtn.hidden = !query;

    const filtered = fullRepoList.filter((repo) => matchesFilter(repo, currentFilter) && matchesQuery(repo, query));
    onFilterChange(sortRepos(filtered, sortBy));
  }

  function setFilter(filterId) {
    currentFilter = filterId;
    filterChips.forEach((chip) => {
      chip.classList.toggle('filter-chip--active', chip.dataset.filter === filterId);
    });
    applyAndNotify();
  }

  // Exposed so other modules (e.g. statsBar or overlay.js) can set active filter
  container.setFilter = setFilter;

  // Exposed so overlay.js can hand over fetched repo list
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

  if (refreshBtn && onRefresh) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('is-refreshing');
      onRefresh().finally(() => {
        refreshBtn.classList.remove('is-refreshing');
      });
    });
  }
}

function matchesFilter(repo, filterBy) {
  if (filterBy === 'original') return !repo.isFork;
  if (filterBy === 'fork') return repo.isFork;
  if (filterBy === 'untouched') return repo.looksUntouched;
  if (filterBy === 'private') return repo.isPrivate;
  return true; // 'all'
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
  if (sortBy === 'stars') {
    return copy.sort((a, b) => {
      const aVal = a.parentStars != null ? a.parentStars : a.stars;
      const bVal = b.parentStars != null ? b.parentStars : b.stars;
      return bVal - aVal;
    });
  }
  if (sortBy === 'forks') {
    return copy.sort((a, b) => {
      const aVal = a.parent?.forksCount != null ? a.parent.forksCount : (a.forksCount ?? 0);
      const bVal = b.parent?.forksCount != null ? b.parent.forksCount : (b.forksCount ?? 0);
      return bVal - aVal;
    });
  }
  if (sortBy === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); // 'updated'
}

