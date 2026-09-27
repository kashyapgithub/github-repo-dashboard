// overlay/modules/render/statsBar.js
//
// Renders the top row of counts (total/public/private/forked/original).
// Pure function of the repo list — no state of its own.

export function renderStatsBar(container, repos) {
  const total = repos.length;
  const publicCount = repos.filter((repo) => !repo.isPrivate).length;
  const privateCount = total - publicCount;
  const forkCount = repos.filter((repo) => repo.isFork).length;
  const originalCount = total - forkCount;

  const stats = [
    ['Total', total],
    ['Public', publicCount],
    ['Private', privateCount],
    ['Forked', forkCount],
    ['Original', originalCount],
  ];

  container.innerHTML = stats
    .map(
      ([label, value]) => `
        <div class="stat-tile">
          <span class="stat-value">${value}</span>
          <span class="stat-label">${label}</span>
        </div>
      `
    )
    .join('');
}
