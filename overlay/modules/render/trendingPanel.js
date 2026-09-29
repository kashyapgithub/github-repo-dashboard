// overlay/modules/render/trendingPanel.js
//
// In-extension Trending & Topic Discovery Hub.
// Allows users to:
// 1. Discover breakout & surging open-source projects across GitHub.
// 2. Search & explore good repositories by topics (e.g. AI agents, model classifier, RAG, devtools).
// 3. Star favorite topics for 1-click access and category-only filtering.
// 4. Sort category-only repositories by Trending Velocity, Total Stars, Most Forks, or Recently Updated.
// 5. Understand exactly "Why It's Trending" via deterministic momentum heuristics and AI synthesis.

import { escapeHtml, formatNumber, getLanguageColor } from '../format.js';
import { fetchTrendingRepos, fetchReposByTopics } from '../github-api.js';
import { getTrendingWhy, generateHeuristicTrendingWhy } from '../ai/trendingWhy.js';
import { getStarredTopics, toggleStarredTopic } from '../storage.js';
import {
  TRENDING_TOPIC_CATEGORIES,
  getAllCuratedTopics,
  findTopicInfo,
  normalizeTopicSlug,
} from '../topics-data.js';

export function renderTrendingPanel(
  container,
  {
    token,
    aiProvider,
    aiApiKey,
    folders = [],
    pinnedRepoIds = [],
    onTogglePin,
    onAssignFolder,
    onViewRepo,
  } = {}
) {
  // Current active view mode: 'feed' (Trending Feeds) or 'topics' (Topic Explorer & Starred Topics)
  let activeTab = 'topics';

  // Feed state
  let feedTimeframe = 'week';
  let feedMode = 'breakout';
  let feedFilter = 'all';
  let feedRepos = [];

  // Topics Explorer state
  let selectedTopics = new Set(['ai-agents', 'model-classifier']);
  let topicSortBy = 'trending';
  let topicTimeframe = 'week';
  let topicMinStars = 100; // Default to >100 stars for "good repos"
  let topicRepos = [];
  let starredTopics = new Set();
  let topicCatalogExpanded = false;

  let isPanelOpen = false;
  let isLoading = false;
  let pinnedSet = new Set(pinnedRepoIds);

  container.innerHTML = `
    <div class="modal-backdrop trending-modal-backdrop" id="trending-modal-backdrop">
      <div class="modal trending-modal" role="dialog" aria-modal="true" aria-labelledby="trending-modal-title">
        
        <!-- Header -->
        <header class="trending-modal__header">
          <div class="trending-modal__title-wrap">
            <div class="trending-modal__icon-wrap">
              <svg class="trending-title-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.5 1.75a.75.75 0 0 0-1.5 0v12.5c0 .414.336.75.75.75h14.5a.75.75 0 0 0 0-1.5H1.5V1.75Z"/>
                <path d="M14.03 4.47a.75.75 0 0 0-1.06 0L8.72 8.72 6.53 6.53a.75.75 0 0 0-1.06 0l-3.5 3.5a.75.75 0 1 0 1.06 1.06l2.97-2.97 2.19 2.19a.75.75 0 0 0 1.06 0l4.75-4.75a.75.75 0 0 0 0-1.06Z"/>
              </svg>
            </div>
            <div>
              <h2 id="trending-modal-title" class="trending-modal__title">Discover & Topic Explorer</h2>
              <p class="trending-modal__subtitle">Explore breakout projects, search good repos by topics (AI agents, model classifier, etc.), and sort category-only repositories.</p>
            </div>
          </div>
          <button type="button" class="modal__close" id="btn-close-trending" title="Close (Esc or T)" aria-label="Close">✕</button>
        </header>

        <!-- Top Navigation Switcher Tabs -->
        <nav class="trending-nav-tabs" role="tablist">
          <button type="button" class="trending-nav-tab ${activeTab === 'topics' ? 'trending-nav-tab--active' : ''}" data-tab="topics">
            <svg viewBox="0 0 16 16" fill="currentColor" class="tab-icon">
              <path d="M1 2.75A1.75 1.75 0 0 1 2.75 1h10.5C14.216 1 15 1.784 15 2.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V2.75Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25H2.75ZM4 4.5h8v1.5H4V4.5Zm0 3h8V9H4V7.5Zm0 3h5V12H4v-1.5Z"/>
            </svg>
            <span>Topic Explorer & Starred Topics</span>
          </button>
          <button type="button" class="trending-nav-tab ${activeTab === 'feed' ? 'trending-nav-tab--active' : ''}" data-tab="feed">
            <svg viewBox="0 0 16 16" fill="currentColor" class="tab-icon">
              <path d="M14.03 4.47a.75.75 0 0 0-1.06 0L8.72 8.72 6.53 6.53a.75.75 0 0 0-1.06 0l-3.5 3.5a.75.75 0 1 0 1.06 1.06l2.97-2.97 2.19 2.19a.75.75 0 0 0 1.06 0l4.75-4.75a.75.75 0 0 0 0-1.06Z"/>
            </svg>
            <span>Trending Feeds</span>
          </button>
        </nav>

        <!-- Topic Explorer Toolbar Container -->
        <div class="topic-explorer-section ${activeTab === 'topics' ? '' : 'is-hidden'}" id="topic-explorer-section">
          <!-- Starred Topics Shelf -->
          <div class="starred-topics-bar">
            <div class="starred-topics-label">
              <span class="star-icon">★</span>
              <span>Starred Topics:</span>
            </div>
            <div class="starred-topics-list" id="starred-topics-list">
              <!-- Rendered dynamically -->
            </div>
            <button type="button" class="btn-starred-filter" id="btn-filter-all-starred" title="Filter repos by all starred topics at once">
              Select All Starred
            </button>
          </div>

          <!-- Topic Search & Controls Row -->
          <div class="topic-controls-row">
            <!-- Custom Topic / Search Input -->
            <div class="topic-search-wrap">
              <svg class="topic-search-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/>
              </svg>
              <input type="search" id="topic-search-input" placeholder="Search or add topics (e.g. ai-agents, model-classifier, rag)…" autocomplete="off" spellcheck="false" />
              <button type="button" class="btn-add-custom-topic" id="btn-add-topic" title="Add topic to active filter">+ Add Topic</button>
            </div>

            <!-- Sort By Selector -->
            <div class="topic-select-group">
              <span class="topic-select-label">Sort:</span>
              <div class="trending-select-wrap">
                <select id="topic-sort-select" aria-label="Sort topic repositories by">
                  <option value="trending" selected>Trending Velocity (+stars/day)</option>
                  <option value="stars">Most Stars (All-Time)</option>
                  <option value="forks">Most Forks</option>
                  <option value="updated">Recently Updated</option>
                </select>
                <svg class="select-chevron" viewBox="0 0 16 16" fill="currentColor">
                  <path d="m4.427 6.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427Z"/>
                </svg>
              </div>
            </div>

            <!-- Timeframe Selector (Only for Trending sort) -->
            <div class="topic-timeframe-wrap" id="topic-timeframe-wrap">
              <div class="trending-segmented" role="group" aria-label="Topic Timeframe">
                <button type="button" class="trending-segment ${topicTimeframe === 'today' ? 'trending-segment--active' : ''}" data-topic-timeframe="today">Today</button>
                <button type="button" class="trending-segment ${topicTimeframe === 'week' ? 'trending-segment--active' : ''}" data-topic-timeframe="week">Week</button>
                <button type="button" class="trending-segment ${topicTimeframe === 'month' ? 'trending-segment--active' : ''}" data-topic-timeframe="month">Month</button>
              </div>
            </div>

            <!-- Quality Threshold: Min Stars -->
            <div class="topic-select-group">
              <span class="topic-select-label">Quality:</span>
              <div class="trending-select-wrap">
                <select id="topic-minstars-select" aria-label="Minimum stars threshold">
                  <option value="0">Any Stars</option>
                  <option value="100" selected>&gt;100 ★ (Good Repos)</option>
                  <option value="500">&gt;500 ★</option>
                  <option value="1000">&gt;1,000 ★ (Popular)</option>
                  <option value="5000">&gt;5,000 ★ (Top Tier)</option>
                </select>
                <svg class="select-chevron" viewBox="0 0 16 16" fill="currentColor">
                  <path d="m4.427 6.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427Z"/>
                </svg>
              </div>
            </div>

            <!-- Toggle Curated Directory Button -->
            <button type="button" class="btn-toggle-catalog" id="btn-toggle-catalog" title="Browse full curated topics catalog">
              <span>Trending Topics</span>
              <span class="catalog-badge">50+</span>
            </button>
          </div>

          <!-- Collapsible Curated Trending Topics Directory -->
          <div class="curated-catalog-panel ${topicCatalogExpanded ? 'is-expanded' : ''}" id="curated-catalog-panel">
            <div class="curated-catalog-header">
              <span class="curated-catalog-title">Curated Trending Topics Catalog (Click to select for category filter, ★ to star)</span>
              <button type="button" class="btn-close-catalog" id="btn-close-catalog">Close Catalog</button>
            </div>
            <div class="curated-categories-grid" id="curated-categories-grid">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- Active Categories Filter Banner -->
          <div class="active-topics-bar" id="active-topics-bar">
            <span class="active-topics-label">Filtering Categories:</span>
            <div class="active-topics-chips" id="active-topics-chips">
              <!-- Rendered dynamically -->
            </div>
            <button type="button" class="btn-clear-topics" id="btn-clear-topics" title="Clear all category filters">Clear All</button>
          </div>
        </div>

        <!-- Global Trending Feeds Toolbar -->
        <div class="trending-toolbar ${activeTab === 'feed' ? '' : 'is-hidden'}" id="trending-feed-toolbar">
          <div class="trending-toolbar__row">
            <div class="trending-search-wrap">
              <svg class="trending-search-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/>
              </svg>
              <input type="search" id="trending-search-input" placeholder="Filter trending projects by name, description, or topic…" autocomplete="off" spellcheck="false" />
              <button type="button" class="trending-search-clear" id="trending-search-clear" hidden title="Clear search">✕</button>
            </div>

            <div class="trending-segmented" role="group" aria-label="Timeframe">
              <button type="button" class="trending-segment ${feedTimeframe === 'today' ? 'trending-segment--active' : ''}" data-feed-timeframe="today">Today</button>
              <button type="button" class="trending-segment ${feedTimeframe === 'week' ? 'trending-segment--active' : ''}" data-feed-timeframe="week">This Week</button>
              <button type="button" class="trending-segment ${feedTimeframe === 'month' ? 'trending-segment--active' : ''}" data-feed-timeframe="month">This Month</button>
            </div>

            <div class="trending-segmented" role="group" aria-label="Discovery Mode">
              <button type="button" class="trending-segment ${feedMode === 'breakout' ? 'trending-segment--active' : ''}" data-feed-mode="breakout" title="Brand-new repositories created recently">Breakout Launches</button>
              <button type="button" class="trending-segment ${feedMode === 'surging' ? 'trending-segment--active' : ''}" data-feed-mode="surging" title="Established repositories with high recent momentum">Surging & Active</button>
            </div>

            <button type="button" class="trending-refresh-btn" id="btn-trending-refresh" title="Refresh trending repositories">
              <svg class="icon-refresh" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"/>
              </svg>
            </button>
          </div>

          <div class="trending-topic-chips" role="tablist" aria-label="Filter by topic or language">
            <button type="button" class="filter-chip filter-chip--active" data-feed-topic="all">All Topics</button>
            <button type="button" class="filter-chip" data-feed-topic="ai">AI & LLMs</button>
            <button type="button" class="filter-chip" data-feed-topic="typescript">TypeScript</button>
            <button type="button" class="filter-chip" data-feed-topic="python">Python</button>
            <button type="button" class="filter-chip" data-feed-topic="rust">Rust</button>
            <button type="button" class="filter-chip" data-feed-topic="go">Go</button>
            <button type="button" class="filter-chip" data-feed-topic="devtools">DevTools</button>
          </div>
        </div>

        <!-- Result Summary Bar -->
        <div class="trending-summary-bar" id="trending-summary-bar">
          <span class="summary-text" id="summary-text">Ready to explore.</span>
          <span class="summary-meta" id="summary-meta"></span>
        </div>

        <!-- Content List -->
        <div class="trending-modal__content" id="trending-content">
          <div class="trending-loading">
            <div class="loading-spinner"></div>
            <p>Loading repositories…</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Element handles
  const modalBackdrop = container.querySelector('#trending-modal-backdrop');
  const closeBtn = container.querySelector('#btn-close-trending');
  const navTabs = container.querySelectorAll('.trending-nav-tab');
  const topicExplorerSection = container.querySelector('#topic-explorer-section');
  const feedToolbar = container.querySelector('#trending-feed-toolbar');
  const summaryText = container.querySelector('#summary-text');
  const summaryMeta = container.querySelector('#summary-meta');
  const contentArea = container.querySelector('#trending-content');

  // Starred shelf & catalog
  const starredListEl = container.querySelector('#starred-topics-list');
  const filterAllStarredBtn = container.querySelector('#btn-filter-all-starred');
  const curatedCatalogPanel = container.querySelector('#curated-catalog-panel');
  const btnToggleCatalog = container.querySelector('#btn-toggle-catalog');
  const btnCloseCatalog = container.querySelector('#btn-close-catalog');
  const curatedCategoriesGrid = container.querySelector('#curated-categories-grid');
  const activeTopicsChips = container.querySelector('#active-topics-chips');
  const btnClearTopics = container.querySelector('#btn-clear-topics');

  // Topic search & controls
  const topicSearchInput = container.querySelector('#topic-search-input');
  const btnAddTopic = container.querySelector('#btn-add-topic');
  const topicSortSelect = container.querySelector('#topic-sort-select');
  const topicMinStarsSelect = container.querySelector('#topic-minstars-select');
  const topicTimeframeWrap = container.querySelector('#topic-timeframe-wrap');
  const topicTimeframeBtns = container.querySelectorAll('[data-topic-timeframe]');

  // Feed controls
  const feedSearchInput = container.querySelector('#trending-search-input');
  const feedSearchClear = container.querySelector('#trending-search-clear');
  const feedRefreshBtn = container.querySelector('#btn-trending-refresh');
  const feedTimeframeBtns = container.querySelectorAll('[data-feed-timeframe]');
  const feedModeBtns = container.querySelectorAll('[data-feed-mode]');
  const feedTopicChips = container.querySelectorAll('[data-feed-topic]');

  // Initialize starred topics from storage
  getStarredTopics().then((topics) => {
    starredTopics = new Set(topics);
    renderStarredShelf();
    renderCuratedCatalog();
    renderActiveTopicsBar();
  });

  function open() {
    isPanelOpen = true;
    modalBackdrop.classList.add('modal-backdrop--visible');
    if (activeTab === 'topics' && topicRepos.length === 0) {
      loadTopicsRepos();
    } else if (activeTab === 'feed' && feedRepos.length === 0) {
      loadFeed();
    }
  }

  function close() {
    isPanelOpen = false;
    modalBackdrop.classList.remove('modal-backdrop--visible');
  }

  function isOpen() {
    return isPanelOpen;
  }

  closeBtn.addEventListener('click', close);
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) close();
  });

  // Top Nav Tab switching
  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (target === activeTab) return;
      activeTab = target;
      navTabs.forEach((t) => t.classList.toggle('trending-nav-tab--active', t.dataset.tab === activeTab));

      topicExplorerSection.classList.toggle('is-hidden', activeTab !== 'topics');
      feedToolbar.classList.toggle('is-hidden', activeTab !== 'feed');

      if (activeTab === 'topics') {
        if (topicRepos.length === 0) loadTopicsRepos();
        else renderTopicResults();
      } else {
        if (feedRepos.length === 0) loadFeed();
        else renderFeedResults();
      }
    });
  });

  // =========================================================================
  // Topic Explorer Logic
  // =========================================================================

  function renderStarredShelf() {
    if (!starredListEl) return;
    const slugs = Array.from(starredTopics);
    if (slugs.length === 0) {
      starredListEl.innerHTML = `<span class="starred-empty-hint">No starred topics yet. Click ★ on any topic to bookmark.</span>`;
      return;
    }

    starredListEl.innerHTML = slugs
      .map((slug) => {
        const info = findTopicInfo(slug);
        const isSelected = selectedTopics.has(slug);
        return `
          <button type="button" class="starred-topic-pill ${isSelected ? 'is-selected' : ''}" data-slug="${escapeHtml(slug)}">
            <span class="star-glyph">★</span>
            <span class="topic-label">${escapeHtml(info.label)}</span>
          </button>
        `;
      })
      .join('');

    starredListEl.querySelectorAll('.starred-topic-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slug = btn.dataset.slug;
        if (selectedTopics.has(slug)) {
          selectedTopics.delete(slug);
        } else {
          selectedTopics.add(slug);
        }
        renderStarredShelf();
        renderActiveTopicsBar();
        renderCuratedCatalog();
        loadTopicsRepos();
      });
    });
  }

  filterAllStarredBtn?.addEventListener('click', () => {
    if (starredTopics.size === 0) return;
    selectedTopics = new Set(starredTopics);
    renderStarredShelf();
    renderActiveTopicsBar();
    renderCuratedCatalog();
    loadTopicsRepos();
  });

  function renderCuratedCatalog() {
    if (!curatedCategoriesGrid) return;
    curatedCategoriesGrid.innerHTML = TRENDING_TOPIC_CATEGORIES.map((cat) => {
      return `
        <div class="topic-category-card">
          <div class="topic-category-card__head">
            <h4 class="topic-category-title">${escapeHtml(cat.name)}</h4>
            <span class="topic-category-desc">${escapeHtml(cat.description)}</span>
          </div>
          <div class="topic-category-chips">
            ${cat.topics
              .map((t) => {
                const isSelected = selectedTopics.has(t.slug);
                const isStarred = starredTopics.has(t.slug);
                return `
                  <div class="topic-chip ${isSelected ? 'topic-chip--selected' : ''}" data-slug="${escapeHtml(t.slug)}">
                    <span class="topic-chip__label" data-action="toggle-select">${escapeHtml(t.label)}</span>
                    <button type="button" class="topic-chip__star ${isStarred ? 'is-starred' : ''}" data-action="star" title="${isStarred ? 'Unstar topic' : 'Star topic'}">
                      ★
                    </button>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    }).join('');

    // Wire actions inside catalog
    curatedCategoriesGrid.querySelectorAll('.topic-chip').forEach((chip) => {
      const slug = chip.dataset.slug;
      chip.querySelector('[data-action="toggle-select"]')?.addEventListener('click', () => {
        if (selectedTopics.has(slug)) {
          selectedTopics.delete(slug);
        } else {
          selectedTopics.add(slug);
        }
        renderCuratedCatalog();
        renderActiveTopicsBar();
        renderStarredShelf();
        loadTopicsRepos();
      });

      chip.querySelector('[data-action="star"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isNowStarred = await toggleStarredTopic(slug);
        if (isNowStarred) starredTopics.add(slug);
        else starredTopics.delete(slug);

        renderCuratedCatalog();
        renderStarredShelf();
      });
    });
  }

  function renderActiveTopicsBar() {
    if (!activeTopicsChips) return;
    const slugs = Array.from(selectedTopics);
    if (slugs.length === 0) {
      activeTopicsChips.innerHTML = `<span class="active-topics-none">None selected (browse topics above or add custom topic)</span>`;
      return;
    }

    activeTopicsChips.innerHTML = slugs
      .map((slug) => {
        const info = findTopicInfo(slug);
        return `
          <span class="active-topic-chip">
            <span>${escapeHtml(info.label)}</span>
            <button type="button" class="btn-remove-active-topic" data-slug="${escapeHtml(slug)}" title="Remove ${escapeHtml(info.label)}">✕</button>
          </span>
        `;
      })
      .join('');

    activeTopicsChips.querySelectorAll('.btn-remove-active-topic').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedTopics.delete(btn.dataset.slug);
        renderActiveTopicsBar();
        renderCuratedCatalog();
        renderStarredShelf();
        loadTopicsRepos();
      });
    });
  }

  btnClearTopics?.addEventListener('click', () => {
    selectedTopics.clear();
    renderActiveTopicsBar();
    renderCuratedCatalog();
    renderStarredShelf();
    loadTopicsRepos();
  });

  // Toggle Curated Catalog
  btnToggleCatalog?.addEventListener('click', () => {
    topicCatalogExpanded = !topicCatalogExpanded;
    curatedCatalogPanel.classList.toggle('is-expanded', topicCatalogExpanded);
    btnToggleCatalog.classList.toggle('is-active', topicCatalogExpanded);
  });

  btnCloseCatalog?.addEventListener('click', () => {
    topicCatalogExpanded = false;
    curatedCatalogPanel.classList.remove('is-expanded');
    btnToggleCatalog.classList.remove('is-active');
  });

  // Custom Topic Search & Add
  function handleAddTopicInput() {
    const raw = topicSearchInput.value.trim();
    if (!raw) return;
    const slug = normalizeTopicSlug(raw);
    if (slug) {
      selectedTopics.add(slug);
      topicSearchInput.value = '';
      renderActiveTopicsBar();
      renderCuratedCatalog();
      renderStarredShelf();
      loadTopicsRepos();
    }
  }

  topicSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTopicInput();
    }
  });

  btnAddTopic?.addEventListener('click', handleAddTopicInput);

  // Topic Sorters & Quality Thresholds
  topicSortSelect?.addEventListener('change', () => {
    topicSortBy = topicSortSelect.value;
    topicTimeframeWrap.style.display = topicSortBy === 'trending' ? 'inline-flex' : 'none';
    loadTopicsRepos();
  });

  topicTimeframeBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      topicTimeframeBtns.forEach((b) => b.classList.remove('trending-segment--active'));
      btn.classList.add('trending-segment--active');
      topicTimeframe = btn.dataset.topicTimeframe;
      loadTopicsRepos();
    });
  });

  topicMinStarsSelect?.addEventListener('change', () => {
    topicMinStars = Number(topicMinStarsSelect.value) || 0;
    loadTopicsRepos();
  });

  async function loadTopicsRepos() {
    if (!token) {
      renderTokenRequired();
      return;
    }

    const topicsArr = Array.from(selectedTopics);
    if (topicsArr.length === 0) {
      contentArea.innerHTML = `
        <div class="trending-empty">
          <p class="trending-empty__title">Select Topics to Discover Repositories</p>
          <p class="trending-empty__desc">Choose topics from the catalog above (e.g. AI Agents, Model Classifier, RAG), or add any custom topic.</p>
        </div>
      `;
      summaryText.textContent = 'No topics selected.';
      summaryMeta.textContent = '';
      return;
    }

    isLoading = true;
    renderSkeletonLoading();
    summaryText.textContent = `Searching GitHub for good repositories matching: ${topicsArr.join(', ')}…`;
    summaryMeta.textContent = `Sort: ${topicSortBy === 'trending' ? 'Trending Velocity' : topicSortBy} | Min Stars: ${topicMinStars}`;

    try {
      topicRepos = await fetchReposByTopics(token, {
        topics: topicsArr,
        sortBy: topicSortBy,
        timeframe: topicTimeframe,
        minStars: topicMinStars,
        perPage: 30,
      });

      isLoading = false;
      renderTopicResults();
      enrichWithWhyAnalysis(topicRepos);
    } catch (err) {
      isLoading = false;
      contentArea.innerHTML = `
        <div class="trending-error">
          <p class="trending-error__title">Failed to load topic repositories</p>
          <p class="trending-error__desc">${escapeHtml(err.message)}</p>
          <button type="button" class="btn-primary btn-retry-trending" id="btn-retry-topics">Try Again</button>
        </div>
      `;
      contentArea.querySelector('#btn-retry-topics')?.addEventListener('click', loadTopicsRepos);
      summaryText.textContent = 'Error loading repositories.';
      summaryMeta.textContent = '';
    }
  }

  function renderTopicResults() {
    const topicsArr = Array.from(selectedTopics);
    const count = topicRepos.length;

    summaryText.innerHTML = `Showing <strong>${count}</strong> repositories in <em>${escapeHtml(topicsArr.join(', '))}</em>`;
    summaryMeta.textContent = `Sorted by ${topicSortBy === 'trending' ? `Trending Velocity (${topicTimeframe})` : topicSortBy} • Min Stars: ${topicMinStars}`;

    if (count === 0) {
      contentArea.innerHTML = `
        <div class="trending-empty">
          <p class="trending-empty__title">No repositories found matching criteria</p>
          <p class="trending-empty__desc">Try lowering the minimum star threshold, adjusting the timeframe, or adding related topics.</p>
        </div>
      `;
      return;
    }

    contentArea.innerHTML = `
      <div class="trending-grid">
        ${topicRepos.map((repo) => renderRepoCardHtml(repo)).join('')}
      </div>
    `;

    wireCardActions(contentArea);
  }

  // =========================================================================
  // Trending Feeds Logic
  // =========================================================================

  feedTimeframeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      feedTimeframeBtns.forEach((b) => b.classList.remove('trending-segment--active'));
      btn.classList.add('trending-segment--active');
      feedTimeframe = btn.dataset.feedTimeframe;
      loadFeed();
    });
  });

  feedModeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      feedModeBtns.forEach((b) => b.classList.remove('trending-segment--active'));
      btn.classList.add('trending-segment--active');
      feedMode = btn.dataset.feedMode;
      loadFeed();
    });
  });

  feedTopicChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      feedTopicChips.forEach((c) => c.classList.remove('filter-chip--active'));
      chip.classList.add('filter-chip--active');
      feedFilter = chip.dataset.feedTopic;
      loadFeed();
    });
  });

  feedSearchInput?.addEventListener('input', () => {
    const q = feedSearchInput.value.trim().toLowerCase();
    feedSearchClear.hidden = !q;
    renderFeedResults();
  });

  feedSearchClear?.addEventListener('click', () => {
    feedSearchInput.value = '';
    feedSearchClear.hidden = true;
    feedSearchInput.focus();
    renderFeedResults();
  });

  feedRefreshBtn?.addEventListener('click', () => {
    loadFeed();
  });

  async function loadFeed() {
    if (!token) {
      renderTokenRequired();
      return;
    }

    isLoading = true;
    feedRefreshBtn.classList.add('is-spinning');
    renderSkeletonLoading();

    summaryText.textContent = `Scanning GitHub for ${feedMode} repositories (${feedTimeframe})…`;
    summaryMeta.textContent = '';

    let langArg = '';
    let topicArg = '';
    if (['typescript', 'python', 'rust', 'go'].includes(feedFilter)) {
      langArg = feedFilter;
    } else if (['ai', 'devtools'].includes(feedFilter)) {
      topicArg = feedFilter;
    }

    try {
      feedRepos = await fetchTrendingRepos(token, {
        timeframe: feedTimeframe,
        mode: feedMode,
        language: langArg,
        topic: topicArg,
        perPage: 30,
      });

      isLoading = false;
      feedRefreshBtn.classList.remove('is-spinning');
      renderFeedResults();
      enrichWithWhyAnalysis(feedRepos);
    } catch (err) {
      isLoading = false;
      feedRefreshBtn.classList.remove('is-spinning');
      contentArea.innerHTML = `
        <div class="trending-error">
          <p class="trending-error__title">Failed to load trending repositories</p>
          <p class="trending-error__desc">${escapeHtml(err.message)}</p>
          <button type="button" class="btn-primary btn-retry-trending" id="btn-retry-feed">Try Again</button>
        </div>
      `;
      contentArea.querySelector('#btn-retry-feed')?.addEventListener('click', loadFeed);
    }
  }

  function renderFeedResults() {
    const q = feedSearchInput.value.trim().toLowerCase();
    const filtered = feedRepos.filter((repo) => {
      if (!q) return true;
      return (
        repo.name.toLowerCase().includes(q) ||
        repo.fullName.toLowerCase().includes(q) ||
        (repo.description || '').toLowerCase().includes(q) ||
        (repo.language || '').toLowerCase().includes(q) ||
        (repo.topics || []).some((t) => t.toLowerCase().includes(q))
      );
    });

    summaryText.innerHTML = `Found <strong>${filtered.length}</strong> trending projects`;
    summaryMeta.textContent = `${feedMode === 'breakout' ? 'Breakout Launches' : 'Surging & Active'} • ${feedTimeframe}`;

    if (filtered.length === 0) {
      contentArea.innerHTML = `
        <div class="trending-empty">
          <p class="trending-empty__title">No trending repositories found</p>
          <p class="trending-empty__desc">Try switching timeframes, changing topics, or clearing your search query.</p>
        </div>
      `;
      return;
    }

    contentArea.innerHTML = `
      <div class="trending-grid">
        ${filtered.map((repo) => renderRepoCardHtml(repo)).join('')}
      </div>
    `;

    wireCardActions(contentArea);
  }

  function renderTokenRequired() {
    contentArea.innerHTML = `
      <div class="trending-empty">
        <p class="trending-empty__title">GitHub Token Required</p>
        <p class="trending-empty__desc">Please configure your GitHub personal access token in settings to discover trending repositories and topics.</p>
      </div>
    `;
    summaryText.textContent = 'Token missing.';
    summaryMeta.textContent = '';
  }

  // =========================================================================
  // Repository Card HTML & Wire Actions
  // =========================================================================

  function renderRepoCardHtml(repo) {
    const langColor = repo.language ? getLanguageColor(repo.language) : null;
    const isPinned = pinnedSet.has(repo.id);
    const initialWhy = repo.whyTrending || generateHeuristicTrendingWhy(repo);

    let rankClass = 'trending-rank--other';
    if (repo.rank === 1) rankClass = 'trending-rank--1';
    else if (repo.rank === 2) rankClass = 'trending-rank--2';
    else if (repo.rank === 3) rankClass = 'trending-rank--3';

    return `
      <article class="trending-card ${repo.rank <= 3 ? 'trending-card--top-3' : ''} ${isPinned ? 'trending-card--pinned' : ''}" data-repo-id="${repo.id}">
        <!-- Top Row -->
        <div class="trending-card__top">
          <div class="trending-card__identity">
            <span class="trending-rank ${rankClass}" title="Rank #${repo.rank}">
              <span class="trending-rank__hash">#</span><span class="trending-rank__num">${repo.rank}</span>
            </span>

            ${
              repo.ownerAvatar
                ? `<img src="${repo.ownerAvatar}" alt="${escapeHtml(repo.owner)}" class="trending-avatar" loading="lazy" />`
                : ''
            }

            <div class="trending-name-wrap">
              <a href="${repo.url}" target="_blank" rel="noopener" class="trending-repo-name" title="${escapeHtml(repo.fullName)}">
                <span class="trending-owner">${escapeHtml(repo.owner)}/</span>${escapeHtml(repo.name)}
              </a>
              <div class="trending-meta-line">
                ${
                  repo.language
                    ? `<span class="trending-lang-tag">
                        <span class="trending-lang-dot" style="background-color: ${langColor};"></span>
                        <span>${escapeHtml(repo.language)}</span>
                      </span>`
                    : ''
                }
              </div>
            </div>
          </div>

          <div class="trending-card__metrics">
            <div class="trending-metric-pill" title="${repo.stars.toLocaleString()} total stars">
              <span class="star-glyph">★</span>
              <span class="metric-num">${formatNumber(repo.stars)}</span>
            </div>
            ${
              repo.starsPerDay > 0
                ? `<div class="trending-velocity-pill" title="Average stars per day since creation">
                    <span class="velocity-plus">+${formatNumber(repo.starsPerDay)}</span>
                    <span class="velocity-label">/day</span>
                  </div>`
                : ''
            }
            <div class="trending-metric-pill trending-metric-pill--forks" title="${repo.forks.toLocaleString()} forks">
              <svg class="icon-fork" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h4.5A2.25 2.25 0 0 0 12.5 6.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878ZM12.5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM8 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0V11a.75.75 0 0 1 .75-.75h.001A.75.75 0 0 1 8 11v3.872Z"/>
              </svg>
              <span class="metric-num">${formatNumber(repo.forks)}</span>
            </div>
          </div>
        </div>

        <!-- Description -->
        <p class="trending-card__desc">
          ${escapeHtml(repo.description || 'No description provided.')}
        </p>

        <!-- Topic Tags (Clickable to jump into Topic Explorer) -->
        ${
          repo.topics && repo.topics.length > 0
            ? `<div class="trending-tags">
                ${repo.topics
                  .slice(0, 6)
                  .map(
                    (t) =>
                      `<button type="button" class="trending-tag" data-action="explore-topic" data-topic="${escapeHtml(t)}" title="Filter by topic '${escapeHtml(t)}'">${escapeHtml(t)}</button>`
                  )
                  .join('')}
              </div>`
            : ''
        }

        <!-- "Why It's Trending" Feature Card -->
        <div class="trending-why-card" data-role="why-card">
          <div class="trending-why-header">
            <div class="trending-why-badge">
              <svg class="trending-why-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8.75.75a.75.75 0 0 0-1.5 0V2h-.5A2.25 2.25 0 0 0 4.5 4.25v.5h-.75a.75.75 0 0 0 0 1.5h.75v1.5h-.75a.75.75 0 0 0 0 1.5h.75v1.5h-.75a.75.75 0 0 0 0 1.5h.75v.5A2.25 2.25 0 0 0 6.75 14h.5v1.25a.75.75 0 0 0 1.5 0V14h1.5v1.25a.75.75 0 0 0 1.5 0V14h.5a2.25 2.25 0 0 0 2.25-2.25v-.5h.75a.75.75 0 0 0 0-1.5h-.75v-1.5h.75a.75.75 0 0 0 0-1.5h-.75v-1.5h.75a.75.75 0 0 0 0-1.5h-.75v-.5A2.25 2.25 0 0 0 11.25 2h-.5V.75a.75.75 0 0 0-1.5 0V2h-1.5V.75ZM6 4.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-7.5Z"/>
              </svg>
              <span>Why It's Trending</span>
            </div>
            <span class="trending-why-pill" data-role="why-pill">${repo.isAiWhy ? 'AI Analysis' : 'Momentum Analysis'}</span>
          </div>
          <p class="trending-why-text" data-role="why-text">${escapeHtml(initialWhy)}</p>
        </div>

        <!-- Quick Actions Bar -->
        <div class="trending-card__footer">
          <div class="trending-footer-left">
            <!-- Pin Button (Keep Pin Icon) -->
            <button
              type="button"
              class="trending-action-btn trending-action-btn--pin ${isPinned ? 'is-pinned' : ''}"
              data-action="pin"
              data-repo-id="${repo.id}"
              title="${isPinned ? 'Unpin repository' : 'Pin repository to dashboard'}"
            >
              <span class="pin-glyph">📌</span>
              <span class="pin-text">${isPinned ? 'Pinned' : 'Pin'}</span>
            </button>

            <!-- Save to Folder Dropdown -->
            ${
              folders.length > 0
                ? `<div class="trending-folder-select-wrap">
                    <select class="trending-folder-select" data-action="folder" data-repo-id="${repo.id}">
                      <option value="" disabled selected>Add to Folder…</option>
                      ${folders.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}
                    </select>
                    <svg class="select-chevron" viewBox="0 0 16 16" fill="currentColor">
                      <path d="m4.427 6.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427Z"/>
                    </svg>
                  </div>`
                : ''
            }
          </div>

          <div class="trending-footer-right">
            <!-- Copy Clone URL -->
            <button
              type="button"
              class="trending-action-btn"
              data-action="clone"
              data-clone-url="${escapeHtml(repo.cloneUrl)}"
              title="Copy git clone URL"
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25v-7.5Z"/>
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25v-7.5Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25h-7.5Z"/>
              </svg>
              <span>Copy</span>
            </button>

            <!-- Open on GitHub -->
            <a href="${repo.url}" target="_blank" rel="noopener" class="trending-action-btn trending-action-btn--primary">
              <span>GitHub</span>
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.75.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V3.56l-4.22 4.22a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.44 2.5H10.5a.75.75 0 0 1-.75-.75Z"/>
              </svg>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function wireCardActions(parentEl) {
    // Pin buttons
    parentEl.querySelectorAll('[data-action="pin"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const repoId = Number(btn.dataset.repoId);
        const isNowPinned = !pinnedSet.has(repoId);
        if (isNowPinned) pinnedSet.add(repoId);
        else pinnedSet.delete(repoId);

        btn.classList.toggle('is-pinned', isNowPinned);
        btn.querySelector('.pin-text').textContent = isNowPinned ? 'Pinned' : 'Pin';
        btn.closest('.trending-card')?.classList.toggle('trending-card--pinned', isNowPinned);

        if (onTogglePin) {
          await onTogglePin(repoId);
        }
      });
    });

    // Folder assignments
    parentEl.querySelectorAll('.trending-folder-select').forEach((select) => {
      select.addEventListener('change', async (e) => {
        e.stopPropagation();
        const repoId = Number(select.dataset.repoId);
        const folderId = select.value;
        if (folderId && onAssignFolder) {
          await onAssignFolder(repoId, folderId);
          select.classList.add('is-assigned');
          setTimeout(() => select.classList.remove('is-assigned'), 1500);
        }
      });
    });

    // Copy clone URL
    parentEl.querySelectorAll('[data-action="clone"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const cloneUrl = btn.dataset.cloneUrl;
        try {
          await navigator.clipboard.writeText(`git clone ${cloneUrl}`);
          const span = btn.querySelector('span');
          if (span) {
            const oldText = span.textContent;
            span.textContent = 'Copied!';
            setTimeout(() => (span.textContent = oldText), 1500);
          }
        } catch {
          // Fallback
        }
      });
    });

    // Clicking any topic badge jumps into Topic Explorer with that topic
    parentEl.querySelectorAll('[data-action="explore-topic"]').forEach((tagBtn) => {
      tagBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const topicSlug = normalizeTopicSlug(tagBtn.dataset.topic);
        if (!topicSlug) return;

        // Switch to topics view
        activeTab = 'topics';
        navTabs.forEach((t) => t.classList.toggle('trending-nav-tab--active', t.dataset.tab === 'topics'));
        topicExplorerSection.classList.remove('is-hidden');
        feedToolbar.classList.add('is-hidden');

        // Set topic as selected
        selectedTopics = new Set([topicSlug]);
        renderActiveTopicsBar();
        renderCuratedCatalog();
        renderStarredShelf();
        loadTopicsRepos();
      });
    });
  }

  async function enrichWithWhyAnalysis(targetRepos) {
    if (!targetRepos || targetRepos.length === 0) return;
    const topCandidates = targetRepos.slice(0, 10);

    for (const repo of topCandidates) {
      if (repo.isAiWhy) continue;
      const card = contentArea.querySelector(`[data-repo-id="${repo.id}"]`);
      if (!card) continue;

      const whyResult = await getTrendingWhy({
        repo,
        provider: aiProvider,
        apiKey: aiApiKey,
        githubToken: token,
      });

      repo.whyTrending = whyResult.text;
      repo.isAiWhy = whyResult.isAi;

      const whyTextEl = card.querySelector('[data-role="why-text"]');
      const whyPillEl = card.querySelector('[data-role="why-pill"]');
      if (whyTextEl) whyTextEl.textContent = whyResult.text;
      if (whyPillEl) whyPillEl.textContent = whyResult.isAi ? 'AI Analysis' : 'Momentum Analysis';
    }
  }

  function renderSkeletonLoading() {
    contentArea.innerHTML = `
      <div class="trending-grid">
        ${[1, 2, 3, 4]
          .map(
            () => `
            <div class="trending-card trending-card--skeleton">
              <div class="trending-card__top">
                <div class="trending-skeleton-pill" style="width: 140px;"></div>
                <div class="trending-skeleton-pill" style="width: 80px;"></div>
              </div>
              <div class="trending-skeleton-text" style="height: 14px; width: 90%; margin-top: 10px;"></div>
              <div class="trending-skeleton-text" style="height: 14px; width: 70%; margin-top: 6px;"></div>
              <div class="trending-skeleton-card" style="height: 70px; margin-top: 14px;"></div>
            </div>
          `
          )
          .join('')}
      </div>
    `;
  }

  function updatePinnedState(newPinnedIds) {
    pinnedSet = new Set(newPinnedIds);
    contentArea.querySelectorAll('.trending-card').forEach((card) => {
      const id = Number(card.dataset.repoId);
      const isPinned = pinnedSet.has(id);
      card.classList.toggle('trending-card--pinned', isPinned);
      const pinBtn = card.querySelector('[data-action="pin"]');
      if (pinBtn) {
        pinBtn.classList.toggle('is-pinned', isPinned);
        pinBtn.querySelector('.pin-text').textContent = isPinned ? 'Pinned' : 'Pin';
      }
    });
  }

  return {
    open,
    close,
    isOpen,
    updatePinnedState,
  };
}
