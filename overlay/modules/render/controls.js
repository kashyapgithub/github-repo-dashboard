// overlay/modules/render/controls.js
//
// Renders the search box + sort dropdown + fork/original filter, and
// owns the (small) logic for turning "the full repo list" + "current
// control values" into "the filtered/sorted list to display".
//
// This module holds its own copy of the unfiltered repo list
// (via setRepos) rather than re-reading it from the DOM or asking
// overlay.js for it on every keystroke — keeps the filtering logic
// self-contained and easy to test in isolation later if needed.

export function renderControls(container, { onFilterChange }) {
  container.innerHTML = `
    <input type="search" id="repo-search" placeholder="Search by name or description…" />
    <select id="repo-sort">
      <option value="updated">Recently updated</option>
      <option value="stars">Most stars</option>
      <option value="name">Name (A–Z)</option>
    </select>
    <select id="repo-filter">
      <option value="all">All repos</option>
      <option value="original">Originals only</option>
      <option value="fork">Forks only</option>
      <option value="untouched">Untouched forks</option>
    </select>
  `;

  let fullRepoList = [];

  function applyAndNotify() {
    const query = container.querySelector('#repo-search').value.trim().toLowerCase();
    const sortBy = container.querySelector('#repo-sort').value;
    const filterBy = container.querySelector('#repo-filter').value;

    const filtered = fullRepoList.filter((repo) => matchesFilter(repo, filterBy) && matchesQuery(repo, query));
    onFilterChange(sortRepos(filtered, sortBy));
  }

  // Exposed so overlay.js can hand over the fetched repo list once,
  // right after loading, and trigger the initial (unfiltered) render.
  container.setRepos = (repos) => {
    fullRepoList = repos;
    applyAndNotify();
  };

  container.querySelector('#repo-search').addEventListener('input', applyAndNotify);
  container.querySelector('#repo-sort').addEventListener('change', applyAndNotify);
  container.querySelector('#repo-filter').addEventListener('change', applyAndNotify);
}

function matchesFilter(repo, filterBy) {
  if (filterBy === 'original') return !repo.isFork;
  if (filterBy === 'fork') return repo.isFork;
  if (filterBy === 'untouched') return repo.looksUntouched;
  return true; // 'all'
}

function matchesQuery(repo, query) {
  if (!query) return true;
  return (
    repo.name.toLowerCase().includes(query) ||
    (repo.description || '').toLowerCase().includes(query)
  );
}

function sortRepos(repos, sortBy) {
  const copy = [...repos];
  if (sortBy === 'stars') return copy.sort((a, b) => b.stars - a.stars);
  if (sortBy === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); // 'updated'
}
