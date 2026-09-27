// overlay/modules/render/repoCard.js
//
// Builds and updates a single repo's card. Split into three functions
// because a card has three lifecycle stages: created once with the
// GitHub data we already have, then updated later (possibly multiple
// times) as the AI description arrives or fails.

import { escapeHtml, timeAgo, truncate } from '../format.js';

/** Builds the card DOM element from GitHub data alone (no AI content yet). */
export function createRepoCard(repo) {
  const card = document.createElement('article');
  card.className = 'repo-card';
  card.dataset.repoId = repo.id;

  card.innerHTML = `
    <header class="repo-card__header">
      <a class="repo-card__name" href="${repo.url}" target="_blank" rel="noopener">
        ${escapeHtml(repo.name)}
      </a>
      <div class="repo-card__badges">
        ${repo.isPrivate
          ? '<span class="badge badge--private">Private</span>'
          : '<span class="badge badge--public">Public</span>'}
        ${repo.isFork
          ? '<span class="badge badge--fork">Fork</span>'
          : '<span class="badge badge--original">Original</span>'}
        ${repo.looksUntouched ? '<span class="badge badge--untouched">Untouched</span>' : ''}
      </div>
    </header>

    <p class="repo-card__meta">
      ${repo.language ? `<span class="repo-card__language">${escapeHtml(repo.language)}</span>` : ''}
      <span class="repo-card__stars">★ ${repo.stars}</span>
      <span class="repo-card__updated">updated ${timeAgo(repo.updatedAt)}</span>
    </p>

    <p class="repo-card__description">
      ${
        repo.description
          ? escapeHtml(truncate(repo.description, 140))
          : '<span class="repo-card__no-desc">No description on GitHub.</span>'
      }
    </p>

    <div class="repo-card__ai" data-role="ai-description">
      <span class="repo-card__ai-placeholder">Waiting to generate…</span>
    </div>
  `;

  return card;
}

/** Updates just the AI-description slot of an existing card. */
export function setCardDescription(card, text, { loading = false, muted = false } = {}) {
  const slot = card.querySelector('[data-role="ai-description"]');

  if (loading) {
    // Three shimmering bars stand in for the eventual 3-4 sentence
    // summary — motion that reflects real async progress rather than
    // a static "please wait" label.
    slot.innerHTML = `
      <div class="repo-card__ai-skeleton-wrap" aria-label="Generating summary">
        <div class="repo-card__ai-skeleton"></div>
        <div class="repo-card__ai-skeleton"></div>
        <div class="repo-card__ai-skeleton"></div>
      </div>
    `;
    return;
  }

  const className = muted ? 'repo-card__ai-muted' : 'repo-card__ai-text';
  slot.innerHTML = `<p class="${className}">${escapeHtml(text)}</p>`;
}

/** Shows an error in the AI-description slot instead of a summary. */
export function setCardError(card, error) {
  const slot = card.querySelector('[data-role="ai-description"]');
  slot.innerHTML = `<span class="repo-card__ai-error">Couldn't generate a summary: ${escapeHtml(
    error.message
  )}</span>`;
}
