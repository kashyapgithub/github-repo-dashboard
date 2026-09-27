// overlay/modules/render/repoRow.js
//
// Builds one row in the dense repo list (a ledger-style row, not a
// card) and lets its status dot be updated as an AI description moves
// through pending -> ready/error. The full AI text itself doesn't
// live in the row at all — only the currently *selected* repo's full
// details render, in detailPanel.js — so a list of 300 repos stays
// scannable instead of turning into 300 paragraphs.

import { escapeHtml, timeAgo } from '../format.js';

export function createRepoRow(repo, { onSelect }) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'repo-row';
  row.dataset.repoId = repo.id;
  // Drives the row's left accent color in CSS — see overlay.css.
  row.dataset.kind = repo.isFork ? (repo.looksUntouched ? 'untouched' : 'fork') : 'original';

  row.innerHTML = `
    <span class="repo-row__status" data-role="status" data-status="no-key" aria-hidden="true"></span>
    <span class="repo-row__name">${escapeHtml(repo.name)}</span>
    <span class="repo-row__lang">${escapeHtml(repo.language || '—')}</span>
    <span class="repo-row__stars">★ ${repo.stars}</span>
    <span class="repo-row__updated">${timeAgo(repo.updatedAt)}</span>
    <span class="repo-row__vis">${repo.isPrivate ? 'Private' : 'Public'}</span>
  `;

  row.addEventListener('click', () => onSelect(repo.id));
  return row;
}

/** status: 'no-key' | 'pending' | 'ready' | 'error' */
export function setRowStatus(row, status) {
  row.querySelector('[data-role="status"]').dataset.status = status;
}
