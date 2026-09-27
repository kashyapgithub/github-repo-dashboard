// overlay/modules/render/detailPanel.js
//
// Renders the full detail view for whichever repo is currently
// selected in the list: GitHub's own description, the AI summary
// (skeleton while pending), and a small metadata grid. This is where
// the 3-4 sentence AI description actually lives — showing it inline
// on every one of 300 rows would turn a scannable list back into a
// wall of paragraphs, which is exactly what the row list was built to
// avoid.

import { escapeHtml, timeAgo } from '../format.js';

export function renderDetailPanel(container, repo, info) {
  if (!repo) {
    container.innerHTML = '<p class="detail-panel__empty">Select a repo from the list to see its details.</p>';
    return;
  }

  const kindLabel = repo.isFork ? (repo.looksUntouched ? 'Untouched fork' : 'Fork') : 'Original';

  container.innerHTML = `
    <h2>${escapeHtml(repo.name)}</h2>
    <p class="detail-panel__owner">${escapeHtml(repo.owner)} · ${repo.isPrivate ? 'Private' : 'Public'} · ${kindLabel}</p>

    ${
      repo.description
        ? `<div class="detail-panel__section">
             <p class="detail-panel__label">GitHub description</p>
             <p class="ai-text">${escapeHtml(repo.description)}</p>
           </div>`
        : ''
    }

    <div class="detail-panel__section">
      <p class="detail-panel__label">AI summary</p>
      <div data-role="ai-slot">${renderAiSlot(info)}</div>
    </div>

    <div class="detail-panel__section detail-panel__meta-grid">
      <div class="detail-panel__meta-item">
        <p class="detail-panel__label">Language</p>
        <span class="value">${escapeHtml(repo.language || '—')}</span>
      </div>
      <div class="detail-panel__meta-item">
        <p class="detail-panel__label">Stars</p>
        <span class="value">${repo.stars}</span>
      </div>
      <div class="detail-panel__meta-item">
        <p class="detail-panel__label">Created</p>
        <span class="value">${timeAgo(repo.createdAt)}</span>
      </div>
      <div class="detail-panel__meta-item">
        <p class="detail-panel__label">Last pushed</p>
        <span class="value">${timeAgo(repo.pushed_at)}</span>
      </div>
    </div>

    <a class="detail-panel__link" href="${repo.url}" target="_blank" rel="noopener">Open on GitHub</a>
  `;
}

/** info is { status: 'no-key' | 'pending' | 'ready' | 'error', text? } */
function renderAiSlot(info) {
  const status = info?.status ?? 'pending';

  if (status === 'pending') {
    return `
      <div class="ai-skeleton-wrap" aria-label="Generating summary">
        <div class="ai-skeleton"></div>
        <div class="ai-skeleton"></div>
        <div class="ai-skeleton"></div>
      </div>
    `;
  }
  if (status === 'ready') return `<p class="ai-text">${escapeHtml(info.text)}</p>`;
  if (status === 'error') return `<p class="ai-error">Couldn't generate a summary: ${escapeHtml(info.text)}</p>`;
  return `<p class="ai-muted">Add an AI API key in settings to generate summaries.</p>`; // 'no-key'
}
