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

/** Returns saved UI preferences (viewMode, groupBy, inspectorOpen) */
export async function getUiPreferences() {
  const { [UI_PREFS_KEY]: prefs } = await chrome.storage.local.get(UI_PREFS_KEY);
  return {
    viewMode: prefs?.viewMode ?? 'tiles', // 'tiles' | 'list'
    groupBy: prefs?.groupBy ?? 'none',   // 'none' | 'language' | 'type' | 'year'
    inspectorOpen: prefs?.inspectorOpen ?? true,
  };
}

export async function saveUiPreferences(newPrefs) {
  const current = await getUiPreferences();
  const merged = { ...current, ...newPrefs };
  await chrome.storage.local.set({ [UI_PREFS_KEY]: merged });
  return merged;
}
