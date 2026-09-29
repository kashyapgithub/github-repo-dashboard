// overlay/modules/render/detailPanel.js
//
// Renders the full detail view for whichever repo is currently selected in the list:
// GitHub's description, AI summary, metadata grid, and quick action links.

import { escapeHtml, timeAgo, formatDate, formatNumber, getLanguageColor } from '../format.js';
import { fetchRepoParent } from '../github-api.js';

export function renderDetailPanel(
  container,
  repo,
  info,
  {
    onRegenerate,
    onOpenSettings,
    onViewCommits,
    onTogglePin,
    onAssignFolder,
    onCreateFolder,
    folders = [],
    githubToken,
    onParentLoaded,
  } = {}
) {
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
  const currentFolder = folders.find((f) => f.id === repo.folderId);

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
        ${repo.isPinned ? '<span class="badge badge--pinned">📌 Pinned</span>' : ''}
        ${currentFolder ? `<span class="badge badge--folder" style="--folder-color: ${currentFolder.color || '#0071e3'}"><span class="folder-dot" style="background-color: ${currentFolder.color || '#0071e3'}"></span> ${escapeHtml(currentFolder.name)}</span>` : ''}
        ${repo.owner ? `<span class="detail-panel__owner-badge">by <strong>${escapeHtml(repo.owner)}</strong></span>` : ''}
      </div>

      ${
        repo.isFork && repo.parent
          ? `
        <div class="detail-fork-callout">
          <svg class="detail-fork-icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h4.5A2.25 2.25 0 0 0 12.5 6.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878ZM12.5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM8 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0V11a.75.75 0 0 1 .75-.75h.001A.75.75 0 0 1 8 11v3.872Z"/>
          </svg>
          <span class="detail-fork-text">
            Forked from <a href="${escapeHtml(repo.parent.url || 'https://github.com/' + repo.parent.fullName)}" target="_blank" rel="noopener" class="detail-fork-link"><strong>${escapeHtml(repo.parent.fullName)}</strong></a>
          </span>
          <span class="detail-fork-stars" title="${repo.parent.stars.toLocaleString()} upstream stars">★ ${formatNumber(repo.parent.stars)}</span>
        </div>
      `
          : ''
      }

      <div class="detail-panel__actions">
        <a class="detail-btn detail-btn--primary" href="${repo.url}" target="_blank" rel="noopener">
          <svg class="detail-btn__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.75.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V3.56l-4.22 4.22a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.44 2.5H10.5a.75.75 0 0 1-.75-.75Z"/>
          </svg>
          <span>Open on GitHub</span>
        </a>

        <button
          type="button"
          class="detail-btn detail-btn--pin ${repo.isPinned ? 'detail-btn--pinned' : ''}"
          id="btn-detail-pin"
          title="${repo.isPinned ? 'Unpin repository' : 'Pin repository'}"
        >
          <svg class="detail-btn__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-2.46 2.46c.02.125.039.283.039.46 0 .43-.108 1.022-.588 1.503a.5.5 0 0 1-.707 0L7.843 9.927 4.136 13.634a.5.5 0 0 1-.707 0l-.354-.354a.5.5 0 0 1 0-.707l3.707-3.707-1.57-1.57a.5.5 0 0 1 0-.707c.48-.48 1.072-.588 1.503-.588.177 0 .335.018.46.039l2.46-2.46c-.02-.125-.039-.283-.039-.46 0-.43.108-1.022.588-1.503a.5.5 0 0 1 .354-.146Z"/>
          </svg>
          <span class="detail-btn-pin-label">${repo.isPinned ? 'Pinned' : 'Pin Repo'}</span>
        </button>

        <button type="button" class="detail-btn detail-btn--secondary" id="btn-view-repo-commits" title="View recent commits for this repository">
          <svg class="detail-btn__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5h-3.32Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/>
          </svg>
          <span>View Commits</span>
        </button>

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
        ${renderAiSlot(info, Boolean(onRegenerate))}
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
          <span class="detail-grid__value">
            ${
              repo.parentStars != null
                ? `<span title="${repo.stars} stars on your fork">${formatNumber(repo.stars)}</span> <span class="detail-grid__subtle" title="${repo.parentStars.toLocaleString()} stars on upstream (${escapeHtml(repo.parent?.fullName || '')})">(★ ${formatNumber(repo.parentStars)} upstream)</span>`
                : (repo.isFork ? `${formatNumber(repo.stars)} <span class="detail-grid__subtle">(fork)</span>` : formatNumber(repo.stars))
            }
          </span>
        </div>

        <div class="detail-grid__item">
          <span class="detail-grid__label">Forks</span>
          <span class="detail-grid__value">
            ${
              repo.parent?.forksCount != null
                ? `<span title="${repo.forksCount ?? 0} forks on this repo">${formatNumber(repo.forksCount ?? 0)}</span> <span class="detail-grid__subtle">(${formatNumber(repo.parent.forksCount)} upstream)</span>`
                : formatNumber(repo.forksCount ?? 0)
            }
          </span>
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

    <!-- Folder Organization Card -->
    <div class="detail-card detail-card--folder">
      <div class="detail-card__header">
        <div class="detail-card__title">
          <svg class="icon-folder" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/>
          </svg>
          <span>Folder</span>
        </div>
      </div>
      <div class="detail-card__body">
        <div class="detail-folder-selector-wrap">
          <div class="select-wrap detail-select-wrap">
            <select id="detail-folder-select" aria-label="Select folder for this repository">
              <option value="" ${!repo.folderId ? 'selected' : ''}>No Folder (Unfiled)</option>
              ${folders
                .map(
                  (f) => `
                    <option value="${f.id}" ${repo.folderId === f.id ? 'selected' : ''}>
                      ${escapeHtml(f.name)}
                    </option>
                  `
                )
                .join('')}
              <option value="__new__">＋ Create New Folder…</option>
            </select>
            <svg class="select-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="m4.427 6.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427Z"/>
            </svg>
          </div>
          ${
            repo.folderId
              ? `<button type="button" class="btn-remove-folder" id="btn-remove-folder" title="Remove repository from folder">✕</button>`
              : ''
          }
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

  // Wire up Pin button
  const pinBtn = container.querySelector('#btn-detail-pin');
  if (pinBtn && onTogglePin) {
    pinBtn.addEventListener('click', () => {
      onTogglePin(repo.id);
    });
  }

  // Wire up Folder Select
  const folderSelect = container.querySelector('#detail-folder-select');
  if (folderSelect) {
    folderSelect.addEventListener('change', () => {
      const val = folderSelect.value;
      if (val === '__new__') {
        folderSelect.value = repo.folderId || '';
        if (onCreateFolder) onCreateFolder();
      } else {
        if (onAssignFolder) onAssignFolder(repo.id, val || null);
      }
    });
  }

  // Wire up Remove Folder button
  const removeFolderBtn = container.querySelector('#btn-remove-folder');
  if (removeFolderBtn && onAssignFolder) {
    removeFolderBtn.addEventListener('click', () => {
      onAssignFolder(repo.id, null);
    });
  }

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

  // Wire up Retry AI button inside error card
  const retryBtn = container.querySelector('#btn-retry-ai');
  if (retryBtn && onRegenerate) {
    retryBtn.addEventListener('click', () => {
      retryBtn.disabled = true;
      retryBtn.textContent = 'Retrying…';
      onRegenerate(repo.id);
    });
  }

  // Wire up Open Settings button inside no-key message
  const settingsBtn = container.querySelector('#btn-open-settings-prompt');
  if (settingsBtn && onOpenSettings) {
    settingsBtn.addEventListener('click', onOpenSettings);
  }

  // Wire up View Commits button
  const viewCommitsBtn = container.querySelector('#btn-view-repo-commits');
  if (viewCommitsBtn && onViewCommits) {
    viewCommitsBtn.addEventListener('click', () => {
      onViewCommits(repo);
    });
  }

  container.dataset.activeRepoId = String(repo.id);

  // If repo is a fork and parent is not yet loaded, load on-demand
  if (repo.isFork && !repo.parent && githubToken) {
    fetchRepoParent(repo.owner, repo.name, githubToken).then((parent) => {
      if (parent) {
        repo.parent = parent;
        repo.parentStars = parent.stars;
        if (onParentLoaded) onParentLoaded(repo);
        if (container.dataset.activeRepoId === String(repo.id)) {
          renderDetailPanel(container, repo, info, {
            onRegenerate,
            onOpenSettings,
            onViewCommits,
            onTogglePin,
            onAssignFolder,
            onCreateFolder,
            folders,
            githubToken,
            onParentLoaded,
          });
        }
      }
    });
  }
}

/** info is { status: 'no-key' | 'pending' | 'ready' | 'error', text? } */
function renderAiSlot(info, canRetry = false) {
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
        <div class="ai-error-header">
          <p class="ai-error-title">Failed to generate summary</p>
          ${
            canRetry
              ? `<button type="button" class="ai-retry-btn" id="btn-retry-ai">Retry</button>`
              : ''
          }
        </div>
        <p class="ai-error-desc">${escapeHtml(info.text || 'An unknown error occurred.')}</p>
      </div>
    `;
  }
  return `
    <div class="ai-no-key">
      <p class="ai-no-key__text">Automated AI summaries are disabled. Configure an AI API key (Google Gemini, OpenRouter, OpenAI, or Claude) in Settings to see summaries for each repo.</p>
      <button type="button" class="ai-no-key__btn" id="btn-open-settings-prompt">Configure in Settings</button>
    </div>
  `;
}

