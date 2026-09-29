// overlay/modules/storage.js
//
// A thin wrapper around chrome.storage.local. Everything the dashboard
// persists — the GitHub token, the AI provider choice, per-provider
// API keys, and cached AI descriptions — goes through this one file so
// no other module has to know the actual storage keys or shape.

const SETTINGS_KEY = 'settings';

// AI description cache uses one storage key PER REPO ("desc_<id>")
// rather than one giant object. That way, generating a description
// for one repo only ever reads/writes that repo's key instead of
// re-serializing hundreds of cached descriptions on every save.
const DESC_CACHE_PREFIX = 'desc_';

/** Returns the saved settings, or sensible empty defaults on first run. */
export async function getSettings() {
  const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
  return settings ?? { githubToken: '', aiProvider: '', aiApiKeys: {} };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

/**
 * Returns { pushedAt, description } for a repo if we've generated one
 * before, or null if we haven't. Callers compare `pushedAt` against
 * the repo's current pushed_at to decide whether the cached text is
 * still valid — this is what makes descriptions "generate once".
 */
export async function getCachedDescription(repoId) {
  const key = DESC_CACHE_PREFIX + repoId;
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

export async function setCachedDescription(repoId, entry) {
  const key = DESC_CACHE_PREFIX + repoId;
  await chrome.storage.local.set({ [key]: entry });
}

/** Wipes every cached description (used by the "Clear cache" button). */
export async function clearDescriptionCache() {
  const all = await chrome.storage.local.get(null);
  const keysToRemove = Object.keys(all).filter((key) => key.startsWith(DESC_CACHE_PREFIX));
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}

const UI_PREFS_KEY = 'ui_prefs';

/** Returns saved UI preferences (viewMode, groupBy, inspectorOpen, activeFolderId) */
export async function getUiPreferences() {
  const { [UI_PREFS_KEY]: prefs } = await chrome.storage.local.get(UI_PREFS_KEY);
  return {
    viewMode: prefs?.viewMode ?? 'tiles', // 'tiles' | 'list'
    groupBy: prefs?.groupBy ?? 'none',   // 'none' | 'folder' | 'language' | 'type' | 'year'
    inspectorOpen: prefs?.inspectorOpen ?? true,
    activeFolderId: prefs?.activeFolderId ?? 'all', // 'all' | 'pinned' | folderId
  };
}

export async function saveUiPreferences(newPrefs) {
  const current = await getUiPreferences();
  const merged = { ...current, ...newPrefs };
  await chrome.storage.local.set({ [UI_PREFS_KEY]: merged });
  return merged;
}

const PINNED_REPOS_KEY = 'pinned_repos';
const FOLDERS_KEY = 'custom_folders';
const REPO_FOLDERS_KEY = 'repo_folders';

/** Returns array of pinned repo IDs (numbers) */
export async function getPinnedRepoIds() {
  const { [PINNED_REPOS_KEY]: ids } = await chrome.storage.local.get(PINNED_REPOS_KEY);
  return Array.isArray(ids) ? ids : [];
}

export async function setPinnedRepoIds(ids) {
  await chrome.storage.local.set({ [PINNED_REPOS_KEY]: ids });
}

export async function togglePinnedRepo(repoId) {
  const current = await getPinnedRepoIds();
  const index = current.indexOf(repoId);
  let isPinned = false;
  let updated;
  if (index >= 0) {
    updated = current.filter((id) => id !== repoId);
    isPinned = false;
  } else {
    updated = [...current, repoId];
    isPinned = true;
  }
  await setPinnedRepoIds(updated);
  return isPinned;
}

/** Returns array of folders: [ { id, name, icon, color, createdAt } ] */
export async function getFolders() {
  const { [FOLDERS_KEY]: folders } = await chrome.storage.local.get(FOLDERS_KEY);
  return Array.isArray(folders) ? folders : [];
}

export async function saveFolders(folders) {
  await chrome.storage.local.set({ [FOLDERS_KEY]: folders });
}

export async function createFolder({ name, color = '#0071e3' }) {
  const folders = await getFolders();
  const newFolder = {
    id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name: name.trim(),
    color: color || '#0071e3',
    createdAt: new Date().toISOString(),
  };
  folders.push(newFolder);
  await saveFolders(folders);
  return newFolder;
}

export async function updateFolder(folderId, { name, color }) {
  const folders = await getFolders();
  const folder = folders.find((f) => f.id === folderId);
  if (folder) {
    if (name !== undefined) folder.name = name.trim();
    if (color !== undefined) folder.color = color;
    await saveFolders(folders);
  }
  return folder;
}

export async function deleteFolder(folderId) {
  const folders = await getFolders();
  const updated = folders.filter((f) => f.id !== folderId);
  await saveFolders(updated);

  // Unassign any repos in this folder
  const repoFolders = await getRepoFolders();
  let changed = false;
  for (const [repoId, fId] of Object.entries(repoFolders)) {
    if (fId === folderId) {
      delete repoFolders[repoId];
      changed = true;
    }
  }
  if (changed) {
    await chrome.storage.local.set({ [REPO_FOLDERS_KEY]: repoFolders });
  }
}

/** Returns object mapping repoId -> folderId: { [repoId]: folderId } */
export async function getRepoFolders() {
  const { [REPO_FOLDERS_KEY]: map } = await chrome.storage.local.get(REPO_FOLDERS_KEY);
  return map && typeof map === 'object' ? map : {};
}

export async function setRepoFolder(repoId, folderId) {
  const repoFolders = await getRepoFolders();
  if (folderId) {
    repoFolders[repoId] = folderId;
  } else {
    delete repoFolders[repoId];
  }
  await chrome.storage.local.set({ [REPO_FOLDERS_KEY]: repoFolders });
}

export async function removeRepoFromFolder(repoId) {
  await setRepoFolder(repoId, null);
}

