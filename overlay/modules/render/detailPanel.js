// overlay/modules/render/detailPanel.js
//
// Renders the full detail view for whichever repo is currently selected in the list:
// GitHub's description, AI summary, metadata grid, and quick action links.

import { escapeHtml, timeAgo, formatDate, formatNumber, getLanguageColor } from '../format.js';

export function renderDetailPanel(container, repo, info, { onRegenerate, onOpenSettings } = {}) {
  if (!repo) {
    container.innerHTML = `
      <div class="detail-panel__empty">
        <svg class="detail-panel__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
          <path d="M6 6h10"/>
          <path d="M6 10h10"/>
        </svg>
        <p class="detail-panel__empty-title">No repository selected</p>
        <p class="detail-panel__empty-desc">Click any repository from the list or use the ↑ / ↓ arrow keys to view its AI summary and details.</p>
      </div>
    `;
    return;
  }

  const kindLabel = repo.isFork ? (repo.looksUntouched ? 'Untouched fork' : 'Fork') : 'Original';
  const kindBadgeClass = repo.isFork ? (repo.looksUntouched ? 'badge--untouched' : 'badge--fork') : 'badge--original';
  const langColor = repo.language ? getLanguageColor(repo.language) : null;

  container.innerHTML = `
    <div class="detail-panel__header">
      <div class="detail-panel__title-row">
        <h2 class="detail-panel__title">
          <a href="${repo.url}" target="_blank" rel="noopener" title="Open on GitHub">
            ${escapeHtml(repo.name)}
          </a>
        </h2>
      </div>

      <div class="detail-panel__meta-badges">
        <span class="badge ${repo.isPrivate ? 'badge--private' : 'badge--public'}">
          ${repo.isPrivate ? '<svg class="badge__icon" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4V4Zm1.5 2h5V4a2.5 2.5 0 0 0-5 0v2Z"/></svg>' : ''}
          ${repo.isPrivate ? 'Private' : 'Public'}
        </span>
        <span class="badge ${kindBadgeClass}">${kindLabel}</span>
        ${repo.archived ? '<span class="badge badge--archived">Archived</span>' : ''}
        ${repo.owner ? `<span class="detail-panel__owner-badge">by <strong>${escapeHtml(repo.owner)}</strong></span>` : ''}
      </div>

      <div class="detail-panel__actions">
        <a class="detail-btn detail-btn--primary" href="${repo.url}" target="_blank" rel="noopener">
          <svg class="detail-btn__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.75.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V3.56l-4.22 4.22a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.44 2.5H10.5a.75.75 0 0 1-.75-.75Z"/>
          </svg>
          <span>Open on GitHub</span>
        </a>

        <button type="button" class="detail-btn detail-btn--secondary" id="btn-copy-clone" data-url="${escapeHtml(repo.cloneUrl || repo.url + '.git')}">
          <svg class="detail-btn__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
          </svg>
          <span class="btn-copy-label">Copy Clone URL</span>
        </button>
      </div>
    </div>

    <!-- AI Summary Section -->
    <div class="detail-card detail-card--ai">
      <div class="detail-card__header">
        <div class="detail-card__title">
          <svg class="icon-sparkle" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7.53 1.282a.5.5 0 0 1 .94 0l1.246 3.655a.5.5 0 0 0 .348.348l3.655 1.246a.5.5 0 0 1 0 .94l-3.655 1.246a.5.5 0 0 0-.348.348l-1.246 3.655a.5.5 0 0 1-.94 0L6.284 9.066a.5.5 0 0 0-.348-.348L2.28 7.472a.5.5 0 0 1 0-.94l3.655-1.246a.5.5 0 0 0 .348-.348L7.53 1.282Z"/>
          </svg>
          <span>AI Summary</span>
        </div>
        ${
          onRegenerate
            ? `<button type="button" class="btn-card-action" id="btn-regen-ai" title="Regenerate summary">
                <svg class="icon-regen" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"/>
                </svg>
              </button>`
            : ''
        }
      </div>
      <div class="detail-card__body" data-role="ai-slot">
        ${renderAiSlot(info)}
      </div>
    </div>

    <!-- GitHub Description -->
    ${
      repo.description
        ? `<div class="detail-card">
             <div class="detail-card__header">
               <div class="detail-card__title">GitHub Description</div>
             </div>
             <div class="detail-card__body">
               <p class="repo-desc-text">${escapeHtml(repo.description)}</p>
             </div>
           </div>`
        : ''
    }

    <!-- Repository Metadata Grid -->
    <div class="detail-card">
      <div class="detail-card__header">
        <div class="detail-card__title">Repository Overview</div>
      </div>
      <div class="detail-grid">
        <div class="detail-grid__item">
          <span class="detail-grid__label">Language</span>
          <span class="detail-grid__value">
            ${
              repo.language
                ? `<span class="detail-grid__lang-dot" style="background-color: ${langColor}"></span>${escapeHtml(repo.language)}`
                : '—'
            }
          </span>
        </div>

        <div class="detail-grid__item">
          <span class="detail-grid__label">Stars</span>
          <span class="detail-grid__value">${formatNumber(repo.stars)}</span>
        </div>

        <div class="detail-grid__item">
          <span class="detail-grid__label">Forks</span>
          <span class="detail-grid__value">${formatNumber(repo.forksCount ?? 0)}</span>
        </div>

        <div class="detail-grid__item">
          <span class="detail-grid__label">Open Issues</span>
          <span class="detail-grid__value">${formatNumber(repo.openIssues ?? 0)}</span>
        </div>

        <div class="detail-grid__item">
          <span class="detail-grid__label">Default Branch</span>
          <span class="detail-grid__value font-mono">${escapeHtml(repo.defaultBranch || 'main')}</span>
        </div>

        <div class="detail-grid__item">
          <span class="detail-grid__label">Last Pushed</span>
          <span class="detail-grid__value" title="${formatDate(repo.pushed_at)}">${timeAgo(repo.pushed_at)}</span>
        </div>

        <div class="detail-grid__item">
          <span class="detail-grid__label">Created</span>
          <span class="detail-grid__value" title="${formatDate(repo.createdAt)}">${timeAgo(repo.createdAt)}</span>
        </div>

        <div class="detail-grid__item">
          <span class="detail-grid__label">Visibility</span>
          <span class="detail-grid__value">${repo.isPrivate ? 'Private' : 'Public'}</span>
        </div>
      </div>
    </div>

    <!-- Quick Navigation Links -->
    <div class="detail-quick-links">
      <span class="detail-quick-links__title">Quick Links:</span>
      <a href="${repo.url}/issues" target="_blank" rel="noopener">Issues</a>
      <span class="bullet">·</span>
      <a href="${repo.url}/pulls" target="_blank" rel="noopener">Pull Requests</a>
      <span class="bullet">·</span>
      <a href="${repo.url}/commits" target="_blank" rel="noopener">Commits</a>
      <span class="bullet">·</span>
      <a href="${repo.url}/releases" target="_blank" rel="noopener">Releases</a>
    </div>
  `;

  // Wire up Copy Clone URL button
  const copyBtn = container.querySelector('#btn-copy-clone');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const urlToCopy = copyBtn.dataset.url;
      try {
        await navigator.clipboard.writeText(urlToCopy);
        const labelEl = copyBtn.querySelector('.btn-copy-label');
        if (labelEl) {
          const original = labelEl.textContent;
          labelEl.textContent = 'Copied!';
          copyBtn.classList.add('detail-btn--copied');
          setTimeout(() => {
            labelEl.textContent = original;
            copyBtn.classList.remove('detail-btn--copied');
          }, 1800);
        }
      } catch {
        // Fallback prompt
        window.prompt('Copy clone URL:', urlToCopy);
      }
    });
  }

  // Wire up Regenerate AI button
  const regenBtn = container.querySelector('#btn-regen-ai');
  if (regenBtn && onRegenerate) {
    regenBtn.addEventListener('click', () => {
      regenBtn.classList.add('is-spinning');
      onRegenerate(repo.id);
    });
  }

  // Wire up Open Settings button inside no-key message
  const settingsBtn = container.querySelector('#btn-open-settings-prompt');
  if (settingsBtn && onOpenSettings) {
    settingsBtn.addEventListener('click', onOpenSettings);
  }
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
  if (status === 'ready') {
    return `<p class="ai-text">${escapeHtml(info.text)}</p>`;
  }
  if (status === 'error') {
    return `
      <div class="ai-error-box">
        <p class="ai-error-title">Failed to generate summary</p>
        <p class="ai-error-desc">${escapeHtml(info.text || 'An unknown error occurred.')}</p>
      </div>
    `;
  }
  return `
    <div class="ai-no-key">
      <p class="ai-no-key__text">Automated AI summaries are disabled. Configure an AI API key (Google Gemini, OpenAI, or Claude) in Settings to see summaries for each repo.</p>
      <button type="button" class="ai-no-key__btn" id="btn-open-settings-prompt">Configure in Settings</button>
    </div>
  `;
}

