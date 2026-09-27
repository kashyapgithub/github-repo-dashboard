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
 * Reshapes GitHub's large repo object into just what the dashboard
 * needs, plus one derived field: whether a fork looks untouched.
 */
function normalizeRepo(raw) {
  return {
    id: raw.id,
    name: raw.name,
    owner: raw.owner.login,
    url: raw.html_url,
    description: raw.description ?? '',
    language: raw.language,
    stars: raw.stargazers_count,
    isPrivate: raw.private,
    isFork: raw.fork,
    updatedAt: raw.updated_at,
    pushed_at: raw.pushed_at,
    createdAt: raw.created_at,
    // A forked repo whose last-push timestamp equals its creation
    // timestamp has never received a commit since the fork happened.
    // This is a free signal — no extra API call — for "forked and
    // forgotten", as opposed to a fork you've actually worked in.
    looksUntouched: raw.fork && raw.pushed_at === raw.created_at,
  };
}
