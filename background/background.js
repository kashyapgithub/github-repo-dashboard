// background/background.js
//
// Opens the dashboard as a large standalone window on top of whatever
// the user is currently looking at, when they click the toolbar icon.
//
// This uses a real chrome.windows.create() popup window rather than
// injecting an overlay into the current page. That sidesteps two
// headaches: host pages with strict CSPs blocking our injected
// scripts/styles, and z-index fights with the page's own UI. It also
// means the dashboard keeps loading data even if the user switches
// away from the tab underneath it.

const DASHBOARD_URL = chrome.runtime.getURL('overlay/overlay.html');

/** Reads back the window id of an already-open dashboard, if any. */
async function getOpenDashboardWindowId() {
  const { dashboardWindowId } = await chrome.storage.session.get('dashboardWindowId');
  return dashboardWindowId ?? null;
}

async function setOpenDashboardWindowId(windowId) {
  await chrome.storage.session.set({ dashboardWindowId: windowId });
}

chrome.action.onClicked.addListener(async () => {
  const existingId = await getOpenDashboardWindowId();

  if (existingId !== null) {
    try {
      // Dashboard is already open somewhere — bring it forward instead
      // of spawning a duplicate window.
      await chrome.windows.update(existingId, { focused: true });
      return;
    } catch {
      // The window was closed since we last recorded it; fall through
      // and open a fresh one.
    }
  }

  const created = await chrome.windows.create({
    url: DASHBOARD_URL,
    type: 'popup',
    width: 1280,
    height: 840,
    top: 40,
    left: 80,
  });

  await setOpenDashboardWindowId(created.id);
});

// Forget the tracked window once the user closes it, so a future click
// opens a new one instead of trying to focus a window that's gone.
chrome.windows.onRemoved.addListener(async (closedId) => {
  const existingId = await getOpenDashboardWindowId();
  if (closedId === existingId) {
    await chrome.storage.session.remove('dashboardWindowId');
  }
});
