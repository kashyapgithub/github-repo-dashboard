// overlay/modules/render/repoRow.js
//
// Builds one row in the dense repo list (a ledger-style row, not a card)
// and lets its status dot be updated as an AI description moves through
// pending -> ready/error.

import { escapeHtml, timeAgo, formatNumber, getLanguageColor } from '../format.js';

export function createRepoRow(repo, { onSelect }) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'repo-row';
  row.dataset.repoId = repo.id;
  row.dataset.kind = repo.isFork ? (repo.looksUntouched ? 'untouched' : 'fork') : 'original';

  const langColor = repo.language ? getLanguageColor(repo.language) : null;
  const langDisplay = repo.language
    ? `<span class="repo-row__lang-dot" style="background-color: ${langColor}"></span><span class="repo-row__lang-name">${escapeHtml(repo.language)}</span>`
    : `<span class="repo-row__lang-empty">—</span>`;

  let kindBadge = '';
  if (repo.isFork) {
    if (repo.looksUntouched) {
      kindBadge = `<span class="badge badge--untouched" title="Untouched fork">Untouched</span>`;
    } else {
      kindBadge = `<span class="badge badge--fork" title="Forked repository">Fork</span>`;
    }
  }

  const visBadge = repo.isPrivate
    ? `<span class="badge badge--private" title="Private repo"><svg class="badge__icon" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4V4Zm1.5 2h5V4a2.5 2.5 0 0 0-5 0v2Z"/></svg>Private</span>`
    : `<span class="badge badge--public">Public</span>`;

  row.innerHTML = `
    <span class="repo-row__status" data-role="status" data-status="no-key" title="AI summary: not configured" aria-label="AI summary status"></span>
    <span class="repo-row__name-cell">
      <span class="repo-row__name">${escapeHtml(repo.name)}</span>
      ${repo.description ? `<span class="repo-row__snippet">${escapeHtml(repo.description)}</span>` : ''}
    </span>
    <span class="repo-row__lang">${langDisplay}</span>
    <span class="repo-row__stars" title="${repo.stars} stars">
      <svg class="repo-row__icon star-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>
      </svg>
      <span>${formatNumber(repo.stars)}</span>
    </span>
    <span class="repo-row__updated" title="Updated ${new Date(repo.updatedAt).toLocaleString()}">${timeAgo(repo.updatedAt)}</span>
    <span class="repo-row__badges">
      ${visBadge}
      ${kindBadge}
    </span>
  `;

  row.addEventListener('click', () => onSelect(repo.id));
  return row;
}

const STATUS_TITLES = {
  'no-key': 'AI summary: API key not set in Settings',
  'pending': 'AI summary: Generating...',
  'ready': 'AI summary: Ready',
  'error': 'AI summary: Generation failed',
};

/** status: 'no-key' | 'pending' | 'ready' | 'error' */
export function setRowStatus(row, status) {
  if (!row) return;
  const statusEl = row.querySelector('[data-role="status"]');
  if (statusEl) {
    statusEl.dataset.status = status;
    statusEl.title = STATUS_TITLES[status] || status;
  }
}

