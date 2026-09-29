// overlay/modules/github-api.js
//
// All direct communication with GitHub's REST API lives here. Nothing
// else in the extension should call fetch() against api.github.com —
// that keeps auth headers, error handling, and pagination in one spot.

const API_BASE = 'https://api.github.com';

/**
 * Fetches every repository the authenticated user owns — public and
 * private, original and forked. GitHub caps each page at 100 items,
 * so we keep requesting the next page until a page comes back with
 * fewer than 100 (the natural "that was the last page" signal).
 */
export async function fetchAllRepos(token) {
  const repos = [];
  let page = 1;

  // A hard ceiling on pages purely as a safety net against an infinite
  // loop if GitHub's API ever behaves unexpectedly — 50 pages is 5,000
  // repos, well beyond any personal account.
  const MAX_PAGES = 50;

  while (page <= MAX_PAGES) {
    const batch = await githubRequest(
      `/user/repos?per_page=100&page=${page}&affiliation=owner&sort=updated`,
      token
    );
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return repos.map(normalizeRepo);
}

/**
 * Fetches a repo's README as plain text, truncated for use as AI
 * input. Returns '' (not an error) if the repo simply has no README —
 * that's common for quick forks and shouldn't block description
 * generation, just make it rely on the repo's name/description/language.
 */
export async function fetchReadmeExcerpt(owner, repoName, token, maxChars = 3000) {
  try {
    const text = await githubRequest(`/repos/${owner}/${repoName}/readme`, token, {
      acceptRaw: true,
    });
    return typeof text === 'string' ? text.slice(0, maxChars) : '';
  } catch {
    return '';
  }
}

async function githubRequest(path, token, { acceptRaw = false } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: acceptRaw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(describeGithubError(response.status));
  }

  return acceptRaw ? response.text() : response.json();
}

function describeGithubError(status) {
  if (status === 401) return 'GitHub rejected the access token — check it in settings.';
  if (status === 403) return 'GitHub rate limit hit, or the token is missing the "repo" scope.';
  if (status === 404) return 'Not found.';
  return `GitHub API error: ${status}`;
}

/**
 * Validates a GitHub token by fetching the authenticated user's profile.
 * Returns { login, name, avatarUrl } or throws an informative Error.
 */
export async function testGithubToken(token) {
  if (!token?.trim()) {
    throw new Error('Please enter a GitHub personal access token.');
  }
  const user = await githubRequest('/user', token);
  return {
    login: user.login,
    name: user.name || user.login,
    avatarUrl: user.avatar_url,
  };
}

/**
 * Reshapes GitHub's large repo object into just what the dashboard
 * needs, plus one derived field: whether a fork looks untouched.
 */
function normalizeRepo(raw) {
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name || `${raw.owner?.login}/${raw.name}`,
    owner: raw.owner?.login || '',
    ownerAvatar: raw.owner?.avatar_url || '',
    url: raw.html_url,
    description: raw.description ?? '',
    language: raw.language,
    stars: raw.stargazers_count ?? 0,
    forksCount: raw.forks_count ?? 0,
    openIssues: raw.open_issues_count ?? 0,
    defaultBranch: raw.default_branch || 'main',
    isPrivate: Boolean(raw.private),
    isFork: Boolean(raw.fork),
    archived: Boolean(raw.archived),
    updatedAt: raw.updated_at,
    pushed_at: raw.pushed_at,
    createdAt: raw.created_at,
    cloneUrl: raw.clone_url || (raw.html_url ? `${raw.html_url}.git` : ''),
    sshUrl: raw.ssh_url || '',
    // A forked repo whose last-push timestamp equals its creation
    // timestamp has never received a commit since the fork happened.
    // This is a free signal — no extra API call — for "forked and
    // forgotten", as opposed to a fork you've actually worked in.
    looksUntouched: Boolean(raw.fork && raw.pushed_at === raw.created_at),
    parent: raw.parent
      ? {
          fullName: raw.parent.full_name,
          stars: raw.parent.stargazers_count ?? 0,
          forksCount: raw.parent.forks_count ?? 0,
          url: raw.parent.html_url,
        }
      : null,
    parentStars: raw.parent ? raw.parent.stargazers_count ?? 0 : null,
  };
}

/**
 * Enriches forked repos with upstream parent repository data
 * (including upstream stars, parent repository name, and fork count)
 * via GitHub's GraphQL API. Runs asynchronously in batches of 100.
 */
export async function enrichForksWithParent(repos, token, onRepoUpdated) {
  const forkMap = new Map();
  for (const repo of repos) {
    if (repo.isFork) {
      forkMap.set(repo.name.toLowerCase(), repo);
    }
  }

  if (forkMap.size === 0) return repos;

  try {
    let cursor = null;
    let hasNextPage = true;
    let pages = 0;
    const MAX_GRAPHQL_PAGES = 10;

    while (hasNextPage && pages < MAX_GRAPHQL_PAGES) {
      pages++;
      const query = `
        query($after: String) {
          viewer {
            repositories(first: 100, after: $after, isFork: true, affiliations: [OWNER]) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                name
                stargazerCount
                parent {
                  nameWithOwner
                  stargazerCount
                  forkCount
                  url
                }
              }
            }
          }
        }
      `;

      const response = await fetch(`${API_BASE}/graphql`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: { after: cursor } }),
      });

      if (!response.ok) break;
      const result = await response.json();
      const repositories = result.data?.viewer?.repositories;
      if (!repositories?.nodes) break;

      for (const node of repositories.nodes) {
        const repo = forkMap.get(node.name?.toLowerCase());
        if (repo && node.parent) {
          repo.parent = {
            fullName: node.parent.nameWithOwner,
            stars: node.parent.stargazerCount ?? 0,
            forksCount: node.parent.forkCount ?? 0,
            url: node.parent.url,
          };
          repo.parentStars = node.parent.stargazerCount ?? 0;
          if (onRepoUpdated) {
            onRepoUpdated(repo);
          }
        }
      }

      hasNextPage = Boolean(repositories.pageInfo?.hasNextPage);
      cursor = repositories.pageInfo?.endCursor || null;
    }
  } catch (err) {
    console.warn('Background fork enrichment skipped:', err);
  }

  return repos;
}

/**
 * REST fallback to fetch single repo metadata including parent info.
 */
export async function fetchRepoParent(owner, repoName, token) {
  try {
    const raw = await githubRequest(`/repos/${owner}/${repoName}`, token);
    if (!raw?.parent) return null;
    return {
      fullName: raw.parent.full_name,
      stars: raw.parent.stargazers_count ?? 0,
      forksCount: raw.parent.forks_count ?? 0,
      url: raw.parent.html_url,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches commits for a single repository.
 */
export async function fetchRepoCommits(owner, repoName, token, { perPage = 10 } = {}) {
  try {
    const rawCommits = await githubRequest(`/repos/${owner}/${repoName}/commits?per_page=${perPage}`, token);
    if (!Array.isArray(rawCommits)) return [];
    return rawCommits.map((item) => normalizeCommit(item, { owner, repoName }));
  } catch (err) {
    console.warn(`Failed to fetch commits for ${owner}/${repoName}:`, err);
    return [];
  }
}

/**
 * Fetches recent commits across the top most recently edited repositories.
 */
export async function fetchRecentCommitsAcrossRepos(repos, token, { maxRepos = 8, perRepo = 6 } = {}) {
  if (!repos?.length || !token) return [];

  // Sort repos by pushed_at or updatedAt descending to get most recently edited repos
  const sortedRepos = [...repos].sort((a, b) => {
    const dateA = new Date(a.pushed_at || a.updatedAt).getTime();
    const dateB = new Date(b.pushed_at || b.updatedAt).getTime();
    return dateB - dateA;
  });

  const targetRepos = sortedRepos.slice(0, maxRepos);
  const results = await Promise.allSettled(
    targetRepos.map(async (repo) => {
      const commits = await fetchRepoCommits(repo.owner, repo.name, token, { perPage: perRepo });
      return commits.map((c) => ({
        ...c,
        repoId: repo.id,
        repoName: repo.name,
        repoFullName: repo.fullName,
        repoUrl: repo.url,
        repoLanguage: repo.language,
        isPrivate: repo.isPrivate,
      }));
    })
  );

  const allCommits = [];
  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      allCommits.push(...res.value);
    }
  }

  // Sort chronologically (newest first)
  return allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function normalizeCommit(raw, repoInfo) {
  const commit = raw.commit || {};
  const message = commit.message || '';
  const [headline, ...rest] = message.split('\n');
  const body = rest.join('\n').trim();

  return {
    sha: raw.sha,
    shortSha: raw.sha ? raw.sha.slice(0, 7) : '',
    url: raw.html_url || (raw.url ? raw.url.replace('api.github.com/repos', 'github.com').replace('/commits/', '/commit/') : '#'),
    message,
    headline: headline || 'No commit message',
    body,
    authorName: commit.author?.name || raw.author?.login || 'Unknown',
    authorLogin: raw.author?.login || '',
    authorAvatar: raw.author?.avatar_url || '',
    date: commit.author?.date || commit.committer?.date || '',
    verified: Boolean(commit.verification?.verified),
  };
}

