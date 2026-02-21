const DB_NAME = "websiteUseTracker";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const ACTIVE_SESSION_KEY = "activeSession";
const HEARTBEAT_ALARM = "trackingHeartbeat";
const RETENTION_ALARM = "retentionCleanup";
const HEARTBEAT_MINUTES = 1;
const MAX_SESSION_MS = 10 * 60 * 1000;
const RETENTION_DAYS = 90;
const ONE_DAY_MINUTES = 24 * 60;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const store = db.createObjectStore(SESSION_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("startTime", "startTime", { unique: false });
        store.createIndex("domain", "domain", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStore(mode = "readonly") {
  return openDb().then((db) => db.transaction(SESSION_STORE, mode).objectStore(SESSION_STORE));
}

function addSession(session) {
  return getStore("readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.add(session);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

function clearAllSessions() {
  return getStore("readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

function deleteSessionsInRange(startMs, endMs) {
  return getStore("readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("startTime");
        const keyRange = IDBKeyRange.bound(startMs, endMs, false, true);
        const cursorRequest = index.openCursor(keyRange);

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            resolve();
            return;
          }
          cursor.delete();
          cursor.continue();
        };

        cursorRequest.onerror = () => reject(cursorRequest.error);
      })
  );
}

function getSessionsInRange(startMs, endMs) {
  return getStore("readonly").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("startTime");
        const keyRange = IDBKeyRange.bound(startMs, endMs, false, true);
        const request = index.getAll(keyRange);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      })
  );
}

function deleteSessionsOlderThan(cutoffMs) {
  return getStore("readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("startTime");
        const keyRange = IDBKeyRange.upperBound(cutoffMs, true);
        const cursorRequest = index.openCursor(keyRange);

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            resolve();
            return;
          }
          cursor.delete();
          cursor.continue();
        };

        cursorRequest.onerror = () => reject(cursorRequest.error);
      })
  );
}

function normalizeDomain(urlString) {
  if (!urlString) {
    return null;
  }

  try {
    const url = new URL(urlString);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function getPeriodBounds(period) {
  const now = new Date();
  const end = now.getTime();

  if (period === "daily") {
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    return { start: startDate.getTime(), end };
  }

  if (period === "weekly") {
    const startDate = new Date(now);
    const day = startDate.getDay();
    const diff = day === 0 ? 6 : day - 1;
    startDate.setDate(startDate.getDate() - diff);
    startDate.setHours(0, 0, 0, 0);
    return { start: startDate.getTime(), end };
  }

  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  startDate.setHours(0, 0, 0, 0);
  return { start: startDate.getTime(), end };
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

async function getActiveSession() {
  const data = await chrome.storage.local.get(ACTIVE_SESSION_KEY);
  return data[ACTIVE_SESSION_KEY] || null;
}

async function setActiveSession(session) {
  await chrome.storage.local.set({ [ACTIVE_SESSION_KEY]: session });
}

async function clearActiveSession() {
  await chrome.storage.local.remove(ACTIVE_SESSION_KEY);
}

async function commitActiveSession(reason = "switch") {
  const active = await getActiveSession();
  if (!active || !active.domain || !active.startTime) {
    return;
  }

  const endTime = Date.now();
  const durationMs = Math.max(0, endTime - active.startTime);
  if (durationMs > 0) {
    await addSession({
      domain: active.domain,
      startTime: active.startTime,
      endTime,
      durationMs,
      reason,
    });
  }

  await clearActiveSession();
}

async function recoverActiveSessionOnStartup() {
  const active = await getActiveSession();
  if (!active || !active.domain || !active.startTime) {
    return;
  }

  // Recovery path for abrupt browser/extension shutdown:
  // close the old session at last heartbeat/update to avoid counting offline time.
  const lastSeenTime = typeof active.lastSeenTime === "number" ? active.lastSeenTime : active.startTime;
  const endTime = Math.max(active.startTime, Math.min(lastSeenTime, Date.now()));
  const durationMs = Math.max(0, endTime - active.startTime);

  if (durationMs > 0) {
    await addSession({
      domain: active.domain,
      startTime: active.startTime,
      endTime,
      durationMs,
      reason: "recovered",
    });
  }

  await clearActiveSession();
}

async function trackDomain(domain, reason = "activate") {
  const now = Date.now();
  const active = await getActiveSession();

  if (active && active.domain === domain) {
    if (reason === "heartbeat" || now - active.startTime > MAX_SESSION_MS) {
      await commitActiveSession("heartbeat");
      await setActiveSession({ domain, startTime: now, lastSeenTime: now });
      return;
    }
    await setActiveSession({
      ...active,
      lastSeenTime: now,
    });
    return;
  }

  if (active) {
    await commitActiveSession(reason);
  }

  if (domain) {
    await setActiveSession({ domain, startTime: now, lastSeenTime: now });
  }
}

async function getCurrentDomainFromActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tabs || tabs.length === 0) {
    return null;
  }

  const [tab] = tabs;
  return normalizeDomain(tab.url);
}

async function syncTrackingFromActiveTab(reason = "sync") {
  try {
    const domain = await getCurrentDomainFromActiveTab();
    await trackDomain(domain, reason);
  } catch (error) {
    console.error("syncTrackingFromActiveTab failed", error);
  }
}

function getRetentionCutoffMs() {
  return Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

async function pruneOldSessions() {
  const cutoffMs = getRetentionCutoffMs();
  await deleteSessionsOlderThan(cutoffMs);
}

async function getStats(period) {
  const bounds = getPeriodBounds(period);
  const sessions = await getSessionsInRange(bounds.start, bounds.end);
  const domainTotals = new Map();
  let totalTimeMs = 0;

  for (const session of sessions) {
    const value = typeof session.durationMs === "number" ? session.durationMs : 0;
    totalTimeMs += value;

    const previous = domainTotals.get(session.domain) || 0;
    domainTotals.set(session.domain, previous + value);
  }

  const topSites = [...domainTotals.entries()]
    .map(([domain, durationMs]) => ({ domain, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      domain: item.domain,
      durationMs: item.durationMs,
      durationText: formatDuration(item.durationMs),
    }));

  const maxWebsite = topSites.length > 0 ? topSites[0] : null;

  return {
    period,
    start: bounds.start,
    end: bounds.end,
    totalTrackedSessions: sessions.length,
    uniqueWebsites: domainTotals.size,
    totalTimeMs,
    totalTimeText: formatDuration(totalTimeMs),
    maxWebsite,
    topSites,
  };
}

async function clearData(period) {
  if (period === "all") {
    await clearAllSessions();
    await clearActiveSession();
    return;
  }

  const bounds = getPeriodBounds(period);
  await deleteSessionsInRange(bounds.start, bounds.end);
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(HEARTBEAT_ALARM, {
    periodInMinutes: HEARTBEAT_MINUTES,
  });
  await chrome.alarms.create(RETENTION_ALARM, {
    periodInMinutes: ONE_DAY_MINUTES,
  });
  await pruneOldSessions();
  await recoverActiveSessionOnStartup();
  await syncTrackingFromActiveTab("install");
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create(HEARTBEAT_ALARM, {
    periodInMinutes: HEARTBEAT_MINUTES,
  });
  await chrome.alarms.create(RETENTION_ALARM, {
    periodInMinutes: ONE_DAY_MINUTES,
  });
  await pruneOldSessions();
  await recoverActiveSessionOnStartup();
  await syncTrackingFromActiveTab("startup");
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === RETENTION_ALARM) {
    await pruneOldSessions();
    return;
  }

  if (alarm.name !== HEARTBEAT_ALARM) {
    return;
  }
  await syncTrackingFromActiveTab("heartbeat");
});

chrome.tabs.onActivated.addListener(async () => {
  await syncTrackingFromActiveTab("tabActivated");
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab && activeTab.id === tabId) {
    await trackDomain(normalizeDomain(tab.url), "tabUpdated");
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await commitActiveSession("windowBlur");
    return;
  }
  await syncTrackingFromActiveTab("windowFocus");
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === "active") {
    await syncTrackingFromActiveTab("idleReturn");
    return;
  }
  await commitActiveSession(`idle:${newState}`);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    sendResponse({ ok: false, error: "Invalid message" });
    return;
  }

  if (message.type === "GET_STATS") {
    getStats(message.period || "daily")
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CLEAR_DATA") {
    clearData(message.period || "all")
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_TRACKING_STATUS") {
    getActiveSession()
      .then((active) =>
        sendResponse({
          ok: true,
          data: {
            tracking: true,
            domain: active?.domain || null,
          },
        })
      )
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  sendResponse({ ok: false, error: "Unsupported message type" });
});
