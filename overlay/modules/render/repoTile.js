// overlay/modules/render/repoTile.js
//
// Renders an individual repository as a classy Apple Bento Card.
// Themes:
// - Private repos: Deep dark orange luxury glass theme with crisp white text.
// - Public repos: Deep dark green luxury glass theme with crisp white text.
// No colored lines across the top — unified, sleek, architectural Bento design.

import { escapeHtml, timeAgo, formatNumber } from '../format.js';

export function createRepoTile(repo, { onSelect, initialAiEntry } = {}) {
  const tile = document.createElement('div');
  const themeClass = repo.isPrivate ? 'repo-tile--private' : 'repo-tile--public';
  tile.className = `repo-tile ${themeClass}`;
  tile.dataset.repoId = repo.id;
  tile.dataset.kind = repo.isFork ? (repo.looksUntouched ? 'untouched' : 'fork') : 'original';
  tile.tabIndex = 0;
  tile.role = 'article';
  tile.setAttribute('aria-label', `${repo.name}, ${repo.isPrivate ? 'private' : 'public'} repository`);

  const langDisplay = repo.language
    ? `<span class="repo-tile__lang-pill">
        <span class="repo-tile__lang-dot"></span>
        <span class="repo-tile__lang-name">${escapeHtml(repo.language)}</span>
      </span>`
    : '';

  let kindBadge = '';
  if (repo.isFork) {
    if (repo.looksUntouched) {
      kindBadge = `<span class="badge badge--tile-untouched" title="Untouched fork">Untouched</span>`;
    } else {
      kindBadge = `<span class="badge badge--tile-fork" title="Forked repository">Fork</span>`;
    }
  }

  const visBadge = repo.isPrivate
    ? `<span class="badge badge--tile-private" title="Private repository">
        <svg class="badge__icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4V4Zm1.5 2h5V4a2.5 2.5 0 0 0-5 0v2Z"/>
        </svg>Private
      </span>`
    : `<span class="badge badge--tile-public" title="Public repository">Public</span>`;

  const initialStatus = initialAiEntry?.status || 'no-key';
  const descText = initialAiEntry?.text || repo.description || 'No description provided.';
  const isAiText = Boolean(initialAiEntry?.text);

  tile.innerHTML = `
    <div class="repo-tile__header">
      <div class="repo-tile__header-left">
        <span class="repo-tile__status" data-role="status" data-status="${initialStatus}" title="${getStatusTitle(initialStatus)}" aria-label="AI Status"></span>
        ${visBadge}
        ${kindBadge}
      </div>
      <div class="repo-tile__header-right">
        ${langDisplay}
      </div>
    </div>

    <div class="repo-tile__body">
      <div class="repo-tile__title-row">
        <h3 class="repo-tile__name" title="${escapeHtml(repo.name)}">
          ${escapeHtml(repo.name)}
        </h3>
        <a href="${repo.url}" target="_blank" rel="noopener" class="repo-tile__ext-link" title="Open repository on GitHub" tabindex="-1">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.75.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V3.56l-4.22 4.22a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.44 2.5H10.5a.75.75 0 0 1-.75-.75Z"/>
          </svg>
        </a>
      </div>

      ${renderForkCalloutHtml(repo)}

      <div class="repo-tile__desc-box ${isAiText ? 'repo-tile__desc-box--ai' : ''}" data-role="desc-box">
        <p class="repo-tile__desc" data-role="desc">
          ${isAiText ? '<span class="tile-sparkle-icon">✦ AI: </span>' : ''}${escapeHtml(descText)}
        </p>
      </div>
    </div>

    <div class="repo-tile__footer">
      <div class="repo-tile__metrics">
        ${renderTileStarsHtml(repo)}

        ${
          repo.forksCount != null && repo.forksCount > 0
            ? `<span class="repo-tile__pill" title="${formatNumber(repo.forksCount)} forks">
                <svg class="repo-tile__pill-icon" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h4.5A2.25 2.25 0 0 0 12.5 6.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878ZM12.5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM8 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0V11a.75.75 0 0 1 .75-.75h.001A.75.75 0 0 1 8 11v3.872Z"/>
                </svg>
                <span>${formatNumber(repo.forksCount)}</span>
              </span>`
            : ''
        }

        <span class="repo-tile__pill repo-tile__pill--time" title="Updated ${new Date(repo.updatedAt).toLocaleString()}">
          ${timeAgo(repo.updatedAt)}
        </span>
      </div>

      <div class="repo-tile__actions">
        <button type="button" class="repo-tile__action-btn btn-tile-copy" title="Copy clone URL" aria-label="Copy clone URL" data-clone="${escapeHtml(repo.cloneUrl || repo.url + '.git')}">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // Selection handler
  tile.addEventListener('click', (e) => {
    if (e.target.closest('.btn-tile-copy') || e.target.closest('.repo-tile__ext-link')) return;
    if (onSelect) onSelect(repo.id);
  });

  // Double click opens repo on GitHub
  tile.addEventListener('dblclick', () => {
    window.open(repo.url, '_blank', 'noopener');
  });

  // Enter opens repo
  tile.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      window.open(repo.url, '_blank', 'noopener');
    }
  });

  // Copy clone URL button
  const copyBtn = tile.querySelector('.btn-tile-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cloneUrl = copyBtn.dataset.clone;
      try {
        await navigator.clipboard.writeText(cloneUrl);
        copyBtn.classList.add('is-copied');
        copyBtn.title = 'Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          copyBtn.title = 'Copy clone URL';
        }, 1600);
      } catch {
        window.prompt('Copy clone URL:', cloneUrl);
      }
    });
  }

  // Public methods to update in place
  tile.updateStars = () => {
    const starContainer = tile.querySelector('.repo-tile__pill--stars');
    if (starContainer) {
      starContainer.outerHTML = renderTileStarsHtml(repo);
    }
    const forkCallout = tile.querySelector('.repo-tile__fork-chip');
    if (forkCallout) {
      forkCallout.outerHTML = renderForkCalloutHtml(repo);
    }
  };

  tile.updateAi = (entry) => {
    const statusEl = tile.querySelector('[data-role="status"]');
    if (statusEl) {
      statusEl.dataset.status = entry.status;
      statusEl.title = getStatusTitle(entry.status);
    }

    const descBox = tile.querySelector('[data-role="desc-box"]');
    const descEl = tile.querySelector('[data-role="desc"]');
    if (descEl && entry.text) {
      descBox?.classList.add('repo-tile__desc-box--ai');
      descEl.innerHTML = `<span class="tile-sparkle-icon">✦ AI: </span>${escapeHtml(entry.text)}`;
    }
  };

  tile.setSelected = (isSelected) => {
    tile.classList.toggle('repo-tile--selected', isSelected);
  };

  return tile;
}

function renderTileStarsHtml(repo) {
  const hasUpstream = repo.isFork && repo.parentStars != null;
  const count = hasUpstream ? repo.parentStars : repo.stars;
  const title = hasUpstream
    ? `${repo.stars} stars on your fork · ${repo.parentStars.toLocaleString()} stars on upstream (${escapeHtml(repo.parent?.fullName || 'upstream')})`
    : (repo.isFork ? `${repo.stars} stars (fork)` : `${repo.stars} stars`);

  return `
    <span class="repo-tile__pill repo-tile__pill--stars ${hasUpstream ? 'repo-tile__pill--upstream' : ''}" title="${title}">
      <svg class="star-icon ${hasUpstream ? 'star-icon--upstream' : ''}" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>
      </svg>
      <span>${formatNumber(count)}</span>
      ${hasUpstream ? '<span class="stars-sublabel">up</span>' : ''}
    </span>
  `;
}

function renderForkCalloutHtml(repo) {
  if (!repo.isFork || !repo.parent) return '';
  return `
    <div class="repo-tile__fork-chip" title="Forked from ${escapeHtml(repo.parent.fullName)}">
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h4.5A2.25 2.25 0 0 0 12.5 6.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878ZM12.5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM8 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0V11a.75.75 0 0 1 .75-.75h.001A.75.75 0 0 1 8 11v3.872Z"/>
      </svg>
      <span>Forked from <strong>${escapeHtml(repo.parent.fullName)}</strong></span>
    </div>
  `;
}

function getStatusTitle(status) {
  const map = {
    'no-key': 'AI summary: API key not set in Settings',
    'pending': 'AI summary: Generating...',
    'ready': 'AI summary: Ready',
    'error': 'AI summary: Generation failed',
  };
  return map[status] || status;
}
