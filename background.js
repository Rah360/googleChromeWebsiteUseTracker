const DB_NAME = "websiteUseTracker";
const DB_VERSION = 5;
const SESSION_STORE = "sessions";
const THOUGHT_PAUSE_STORE = "thought_pauses";
const TAB_EVENT_STORE = "tab_events";
const LOOP_PROMPT_STORE = "loop_prompts";
const STUDY_SESSION_STORE = "study_sessions";

const ACTIVE_SESSION_KEY = "activeSession";
const ALERT_STATE_KEY = "alertState";
const THOUGHT_PAUSE_SETTINGS_KEY = "thoughtPauseSettings";
const THOUGHT_PAUSE_STATE_KEY = "thoughtPauseState";
const TAB_EVENT_STATE_KEY = "tabEventState";
const LOOP_SETTINGS_KEY = "revisitLoopSettings";
const LOOP_STATE_KEY = "revisitLoopState";
const STUDY_MODE_KEY = "studyModeState";
const STUDY_SETTINGS_KEY = "studyModeSettings";
const ACTIVITY_STATE_KEY = "activityState";

const HEARTBEAT_ALARM = "trackingHeartbeat";
const RETENTION_ALARM = "retentionCleanup";
const DAILY_REPORT_ALARM = "dailySystemReport";

const HEARTBEAT_MINUTES = 1;
const MAX_SESSION_MS = 10 * 60 * 1000;
const RETENTION_DAYS = 90;
const ONE_DAY_MINUTES = 24 * 60;
const INACTIVITY_GRACE_MS = 2 * 60 * 1000;

const ONE_HOUR_MS = 60 * 60 * 1000;
const DAILY_FIRST_ALERT_MS = ONE_HOUR_MS;
const DAILY_SECOND_ALERT_MS = 3 * ONE_HOUR_MS;
const WEEKLY_ALERT_MS = 5 * ONE_HOUR_MS;
const RAPID_GAP_MS = 60 * 1000;
const DEFAULT_LOOP_WINDOW_MS = 4 * 60 * 1000;
const STUDY_ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const LOOP_LOCKOUT_WINDOW_MS = 10 * 60 * 1000;
const LOOP_LOCKOUT_THRESHOLD = 3;
const DEEP_DIVE_MAX_MS = 15 * 60 * 1000;
const COOLDOWN_PAGE_SECONDS = 60;
const REPORT_HOUR = 9;
const IDLE_DETECTION_SECONDS = 180;
const HEARTBEAT_STALE_MS = 3 * 60 * 1000;
const PRODUCTIVE_DOMAINS = [
  "github.com",
  "notion.so",
  "gemini.google.com",
  "leetcode.com",
  "chatgpt.com",
  "developer.mozilla.org",
  "docs.docker.com",
  "kubernetes.io",
  "stackoverflow.com",
  "cscsepic.blogspot.com",
];
const DEFAULT_DISTRACTION_DOMAINS = [
  "instagram.com",
  "reddit.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "tiktok.com",
  "hotstar.com",
  "epicsports.me",
  "linkedin.com",
  "news.ycombinator.com",
];

const DEFAULT_STUDY_SETTINGS = {
  distractingDomains: cloneDefaultDistractionDomains(),
  distractingUrlPatterns: [
    "https://www.youtube.com/shorts/*",
    "https://youtube.com/shorts/*",
    "https://www.instagram.com/reel/*",
    "https://instagram.com/reel/*",
    "https://www.instagram.com/reels/*",
    "https://instagram.com/reels/*",
  ],
};

const DOOMSCROLL_SURFACES = [
  {
    label: "YouTube Shorts",
    patterns: ["https://www.youtube.com/shorts/*", "https://youtube.com/shorts/*"],
  },
  {
    label: "Instagram Reels",
    patterns: [
      "https://www.instagram.com/reel/*",
      "https://instagram.com/reel/*",
      "https://www.instagram.com/reels/*",
      "https://instagram.com/reels/*",
    ],
  },
  {
    label: "TikTok",
    domains: ["tiktok.com"],
  },
];

function cloneDefaultDistractionDomains() {
  return [...DEFAULT_DISTRACTION_DOMAINS];
}

const loopSwitchQueue = [];
const loopCount = [];
const deepDiveTimers = new Map();
const DEEP_DIVE_PATTERNS = [
  "https://www.youtube.com/shorts/*",
  "https://youtube.com/shorts/*",
  "https://www.instagram.com/reels/*",
  "https://instagram.com/reels/*",
];
const EDUCATIONAL_KEYWORDS = [
  "java",
  "spring boot",
  "golang",
  "scala",
  "dsa",
  "backend",
  "system design",
  "coding",
  "tutorial",
  "kubernetes",
  "docker",
  "leetcode",
  "architecture",
];
const TITLE_ALLOW_KEYWORDS = ["tutorial", "coding", "system design", "engineering", "leetcode"];
const TITLE_BLOCK_KEYWORDS = ["trailer", "music video", "gaming", "comedy"];
const REQUIRED_DB_STORES = [
  SESSION_STORE,
  THOUGHT_PAUSE_STORE,
  TAB_EVENT_STORE,
  LOOP_PROMPT_STORE,
  STUDY_SESSION_STORE,
];

const analyticsCache = new Map();

const DEFAULT_THOUGHT_PAUSE_SETTINGS = {
  enabled: true,
  targetMode: "pause_list",
  domains: ["instagram.com", "youtube.com", "x.com", "twitter.com", "reddit.com"],
  quietHours: {
    enabled: false,
    startHour: 2,
    endHour: 7,
  },
  cooldownMinutes: 10,
  strictMode: false,
  autoDismissSeconds: 10,
  allowNote: true,
  quickChoices: [
    "Just checking something",
    "Avoiding something",
    "Feeling stressed",
    "Bored",
    "Other",
  ],
  triggers: {
    firstVisit: true,
    continuousUsage: true,
    rapidSwitch: true,
    threshold: true,
  },
  continuousMinutes: 5,
  rapidSwitchThreshold: 3,
  rapidSwitchWindowSeconds: 60,
  rapidSwitchCooldownMinutes: 10,
};

const DEFAULT_LOOP_SETTINGS = {
  enabled: true,
  windowMinutes: 4,
  minSwitches: 9,
  maxUniqueDomains: 3,
  cooldownMinutes: 15,
};

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

      if (!db.objectStoreNames.contains(THOUGHT_PAUSE_STORE)) {
        const thoughtStore = db.createObjectStore(THOUGHT_PAUSE_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        thoughtStore.createIndex("timestamp", "timestamp", { unique: false });
        thoughtStore.createIndex("dateKey", "dateKey", { unique: false });
        thoughtStore.createIndex("domain", "domain", { unique: false });
        thoughtStore.createIndex("triggerType", "triggerType", { unique: false });
      }

      if (!db.objectStoreNames.contains(TAB_EVENT_STORE)) {
        const tabStore = db.createObjectStore(TAB_EVENT_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        tabStore.createIndex("timestamp", "timestamp", { unique: false });
        tabStore.createIndex("dateKey", "dateKey", { unique: false });
        tabStore.createIndex("domain", "domain", { unique: false });
        tabStore.createIndex("minuteBucket", "minuteBucket", { unique: false });
      }

      if (!db.objectStoreNames.contains(LOOP_PROMPT_STORE)) {
        const loopStore = db.createObjectStore(LOOP_PROMPT_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        loopStore.createIndex("timestamp", "timestamp", { unique: false });
        loopStore.createIndex("dateKey", "dateKey", { unique: false });
        loopStore.createIndex("action", "action", { unique: false });
      }

      if (!db.objectStoreNames.contains(STUDY_SESSION_STORE)) {
        const studyStore = db.createObjectStore(STUDY_SESSION_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        studyStore.createIndex("startTime", "startTime", { unique: false });
        studyStore.createIndex("dateKey", "dateKey", { unique: false });
        studyStore.createIndex("endTime", "endTime", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("deleteDatabase blocked"));
  });
}

function getMissingStores(db) {
  const missing = [];
  for (const store of REQUIRED_DB_STORES) {
    if (!db.objectStoreNames.contains(store)) {
      missing.push(store);
    }
  }
  return missing;
}

async function ensureDbReady() {
  let db = await openDb();
  const missing = getMissingStores(db);
  if (missing.length === 0) {
    return db;
  }

  db.close();
  try {
    await deleteDb();
  } catch (error) {
    // If delete fails (blocked/old handles), continue and try normal open once.
  }

  db = await openDb();
  return db;
}

function getStore(storeName, mode = "readonly") {
  return ensureDbReady().then((db) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        throw new Error(`Missing store: ${storeName}`);
      }
      return db.transaction(storeName, mode).objectStore(storeName);
    } catch (error) {
      if (String(error?.name || "") === "NotFoundError") {
        throw new Error(`Missing store: ${storeName}`);
      }
      throw error;
    }
  });
}

function isMissingStoreError(error) {
  const message = String(error?.message || "");
  return message.includes("Missing store") || message.includes("object stores was not found");
}

function addSession(session) {
  return getStore(SESSION_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.add(session);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

function addThoughtPause(entry) {
  return getStore(THOUGHT_PAUSE_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.add(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

function addTabEvent(entry) {
  return getStore(TAB_EVENT_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.add(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

function addLoopPrompt(entry) {
  return getStore(LOOP_PROMPT_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.add(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  ).catch((error) => {
    if (isMissingStoreError(error)) {
      return;
    }
    throw error;
  });
}

function addStudySession(entry) {
  return getStore(STUDY_SESSION_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.add(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

function clearAllSessions() {
  return getStore(SESSION_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

function clearAllThoughtPauses() {
  return getStore(THOUGHT_PAUSE_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

function clearAllTabEvents() {
  return getStore(TAB_EVENT_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

function clearAllLoopPrompts() {
  return getStore(LOOP_PROMPT_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  ).catch((error) => {
    if (isMissingStoreError(error)) {
      return;
    }
    throw error;
  });
}

function clearAllStudySessions() {
  return getStore(STUDY_SESSION_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
  );
}

function deleteSessionsInRange(startMs, endMs) {
  return getStore(SESSION_STORE, "readwrite").then(
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

function deleteThoughtPausesInRange(startMs, endMs) {
  return getStore(THOUGHT_PAUSE_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("timestamp");
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

function deleteTabEventsInRange(startMs, endMs) {
  return getStore(TAB_EVENT_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("timestamp");
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

function deleteLoopPromptsInRange(startMs, endMs) {
  return getStore(LOOP_PROMPT_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("timestamp");
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
  ).catch((error) => {
    if (isMissingStoreError(error)) {
      return;
    }
    throw error;
  });
}

function deleteStudySessionsInRange(startMs, endMs) {
  return getStore(STUDY_SESSION_STORE, "readwrite").then(
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
  return getStore(SESSION_STORE, "readonly").then(
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

function getThoughtPausesInRange(startMs, endMs) {
  return getStore(THOUGHT_PAUSE_STORE, "readonly").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("timestamp");
        const keyRange = IDBKeyRange.bound(startMs, endMs, false, true);
        const request = index.getAll(keyRange);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      })
  );
}

function getTabEventsInRange(startMs, endMs) {
  return getStore(TAB_EVENT_STORE, "readonly").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("timestamp");
        const keyRange = IDBKeyRange.bound(startMs, endMs, false, true);
        const request = index.getAll(keyRange);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      })
  );
}

function getLoopPromptsInRange(startMs, endMs) {
  return getStore(LOOP_PROMPT_STORE, "readonly").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("timestamp");
        const keyRange = IDBKeyRange.bound(startMs, endMs, false, true);
        const request = index.getAll(keyRange);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      })
  ).catch((error) => {
    if (isMissingStoreError(error)) {
      return [];
    }
    throw error;
  });
}

function getStudySessionsInRange(startMs, endMs) {
  return getStore(STUDY_SESSION_STORE, "readonly").then(
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
  return getStore(SESSION_STORE, "readwrite").then(
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

function deleteThoughtPausesOlderThan(cutoffMs) {
  return getStore(THOUGHT_PAUSE_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("timestamp");
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

function deleteTabEventsOlderThan(cutoffMs) {
  return getStore(TAB_EVENT_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("timestamp");
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

function deleteLoopPromptsOlderThan(cutoffMs) {
  return getStore(LOOP_PROMPT_STORE, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const index = store.index("timestamp");
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
  ).catch((error) => {
    if (isMissingStoreError(error)) {
      return;
    }
    throw error;
  });
}

function deleteStudySessionsOlderThan(cutoffMs) {
  return getStore(STUDY_SESSION_STORE, "readwrite").then(
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

function isTrackableUrl(urlString) {
  if (!urlString) {
    return false;
  }

  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
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

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayKeyFromMs(ms) {
  return formatDateKey(new Date(ms));
}

function getWeekKeyFromMs(ms) {
  const date = new Date(ms);
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return formatDateKey(date);
}

function parseDateKeyToMs(key) {
  const time = Date.parse(`${key}T00:00:00`);
  return Number.isFinite(time) ? time : null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeThoughtPauseSettings(input) {
  const settings = clone(DEFAULT_THOUGHT_PAUSE_SETTINGS);
  if (!input || typeof input !== "object") {
    settings.enabled = true;
    settings.strictMode = true;
    settings.quietHours.enabled = false;
    return settings;
  }

  settings.enabled = true;
  settings.targetMode = input.targetMode === "all_tracked" ? "all_tracked" : "pause_list";
  settings.domains = Array.isArray(input.domains)
    ? [...new Set(input.domains.map((item) => normalizeDomain(`https://${item}`) || normalizeDomain(item)).filter(Boolean))]
    : settings.domains;

  const quiet = input.quietHours || {};
  settings.quietHours = {
    enabled: Boolean(quiet.enabled),
    startHour: Number.isInteger(quiet.startHour) ? Math.min(23, Math.max(0, quiet.startHour)) : 2,
    endHour: Number.isInteger(quiet.endHour) ? Math.min(23, Math.max(0, quiet.endHour)) : 7,
  };

  settings.cooldownMinutes = Math.max(1, Number(input.cooldownMinutes) || settings.cooldownMinutes);
  settings.strictMode = true;
  settings.autoDismissSeconds = Math.max(3, Number(input.autoDismissSeconds) || settings.autoDismissSeconds);
  settings.allowNote = input.allowNote !== false;

  settings.quickChoices = Array.isArray(input.quickChoices)
    ? input.quickChoices.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8)
    : settings.quickChoices;
  if (settings.quickChoices.length === 0) {
    settings.quickChoices = clone(DEFAULT_THOUGHT_PAUSE_SETTINGS.quickChoices);
  }

  const triggers = input.triggers || {};
  settings.triggers = {
    firstVisit: triggers.firstVisit !== false,
    continuousUsage: triggers.continuousUsage !== false,
    rapidSwitch: triggers.rapidSwitch !== false,
    threshold: triggers.threshold !== false,
  };

  settings.continuousMinutes = Math.max(1, Number(input.continuousMinutes) || settings.continuousMinutes);
  settings.rapidSwitchThreshold = Math.max(2, Number(input.rapidSwitchThreshold) || settings.rapidSwitchThreshold);
  settings.rapidSwitchWindowSeconds = Math.max(10, Number(input.rapidSwitchWindowSeconds) || settings.rapidSwitchWindowSeconds);
  settings.rapidSwitchCooldownMinutes = Math.max(1, Number(input.rapidSwitchCooldownMinutes) || settings.rapidSwitchCooldownMinutes);

  return settings;
}

function sanitizeLoopSettings(input) {
  const settings = clone(DEFAULT_LOOP_SETTINGS);
  if (!input || typeof input !== "object") {
    settings.enabled = true;
    return settings;
  }

  settings.enabled = true;
  settings.windowMinutes = Math.max(1, Number(input.windowMinutes) || settings.windowMinutes);
  settings.minSwitches = Math.max(2, Number(input.minSwitches) || settings.minSwitches);
  settings.maxUniqueDomains = Math.max(2, Math.min(6, Number(input.maxUniqueDomains) || settings.maxUniqueDomains));
  settings.cooldownMinutes = Math.max(1, Number(input.cooldownMinutes) || settings.cooldownMinutes);
  return settings;
}

function normalizeStudyPattern(pattern) {
  const value = String(pattern || "").trim().toLowerCase();
  return value || null;
}

function wildcardToRegExp(pattern) {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function urlMatchesPattern(url, pattern) {
  if (!url || !pattern) {
    return false;
  }

  try {
    return wildcardToRegExp(pattern).test(String(url).toLowerCase());
  } catch {
    return false;
  }
}

function sanitizeStudySettings(input) {
  const settings = clone(DEFAULT_STUDY_SETTINGS);
  if (!input || typeof input !== "object") {
    return settings;
  }

  settings.distractingDomains = Array.isArray(input.distractingDomains)
    ? [
        ...new Set(
          input.distractingDomains
            .map((item) => normalizeDomain(`https://${item}`) || normalizeDomain(item))
            .filter(Boolean)
        ),
      ]
    : settings.distractingDomains;

  settings.distractingUrlPatterns = Array.isArray(input.distractingUrlPatterns)
    ? [...new Set(input.distractingUrlPatterns.map(normalizeStudyPattern).filter(Boolean))]
    : settings.distractingUrlPatterns;

  return settings;
}

function inferDistractingPattern(url) {
  if (!url) {
    return null;
  }

  const normalizedUrl = String(url).toLowerCase();
  const knownPatterns = [
    "https://www.youtube.com/shorts/*",
    "https://youtube.com/shorts/*",
    "https://www.instagram.com/reel/*",
    "https://instagram.com/reel/*",
    "https://www.instagram.com/reels/*",
    "https://instagram.com/reels/*",
  ];

  for (const pattern of knownPatterns) {
    if (urlMatchesPattern(normalizedUrl, pattern)) {
      return pattern;
    }
  }

  return null;
}

async function getThoughtPauseSettings() {
  const data = await chrome.storage.local.get(THOUGHT_PAUSE_SETTINGS_KEY);
  return sanitizeThoughtPauseSettings(data[THOUGHT_PAUSE_SETTINGS_KEY]);
}

async function setThoughtPauseSettings(settings) {
  const normalized = sanitizeThoughtPauseSettings(settings);
  await chrome.storage.local.set({ [THOUGHT_PAUSE_SETTINGS_KEY]: normalized });
  return normalized;
}

async function getLoopSettings() {
  const data = await chrome.storage.local.get(LOOP_SETTINGS_KEY);
  return sanitizeLoopSettings(data[LOOP_SETTINGS_KEY]);
}

async function setLoopSettings(settings) {
  const normalized = sanitizeLoopSettings(settings);
  await chrome.storage.local.set({ [LOOP_SETTINGS_KEY]: normalized });
  return normalized;
}

async function getStudySettings() {
  const data = await chrome.storage.local.get(STUDY_SETTINGS_KEY);
  return sanitizeStudySettings(data[STUDY_SETTINGS_KEY]);
}

async function setStudySettings(settings) {
  const normalized = sanitizeStudySettings(settings);
  await chrome.storage.local.set({ [STUDY_SETTINGS_KEY]: normalized });
  return normalized;
}

async function addCurrentSiteToDistractingList(url) {
  if (!isTrackableUrl(url)) {
    throw new Error("Current page is not a trackable website.");
  }

  const domain = normalizeDomain(url);
  if (!domain) {
    throw new Error("Unable to determine current domain.");
  }

  const settings = await getStudySettings();
  const nextDomains = new Set(settings.distractingDomains || []);
  const alreadyHasDomain = nextDomains.has(domain);
  nextDomains.add(domain);

  const nextPatterns = new Set(settings.distractingUrlPatterns || []);
  const inferredPattern = inferDistractingPattern(url);
  const alreadyHasPattern = inferredPattern ? nextPatterns.has(inferredPattern) : false;
  if (inferredPattern) {
    nextPatterns.add(inferredPattern);
  }

  if (alreadyHasDomain && (!inferredPattern || alreadyHasPattern)) {
    return {
      domain,
      pattern: inferredPattern,
      alreadyMarked: true,
      settings,
    };
  }

  const updated = await setStudySettings({
    ...settings,
    distractingDomains: [...nextDomains],
    distractingUrlPatterns: [...nextPatterns],
  });

  return {
    domain,
    pattern: inferredPattern,
    alreadyMarked: false,
    settings: updated,
  };
}

async function getTabEventState() {
  const data = await chrome.storage.local.get(TAB_EVENT_STATE_KEY);
  const state = data[TAB_EVENT_STATE_KEY] || {};
  return {
    lastDomain: typeof state.lastDomain === "string" ? state.lastDomain : null,
    lastUrl: typeof state.lastUrl === "string" ? state.lastUrl : null,
    lastTabId: Number.isInteger(state.lastTabId) ? state.lastTabId : null,
  };
}

async function setTabEventState(state) {
  await chrome.storage.local.set({ [TAB_EVENT_STATE_KEY]: state });
}

async function getLoopState() {
  const data = await chrome.storage.local.get(LOOP_STATE_KEY);
  const state = data[LOOP_STATE_KEY] || {};
  return {
    lastPromptTimestamp: Number(state.lastPromptTimestamp) || 0,
    snoozeDateKey: typeof state.snoozeDateKey === "string" ? state.snoozeDateKey : null,
  };
}

async function setLoopState(state) {
  await chrome.storage.local.set({ [LOOP_STATE_KEY]: state });
}

function createEmptyStudyModeState(now = Date.now()) {
  return {
    active: false,
    startedAt: null,
    currentDomain: null,
    currentUrl: null,
    chunkStartTime: null,
    lastSeenTime: null,
    totalActiveMs: 0,
    totalDistractingMs: 0,
    totalDoomscrollMs: 0,
    totalSwitches: 0,
    siteStats: {},
    doomscrollBySurface: {},
    deepDiveCount: 0,
    deepDiveEpisodes: [],
    currentDoomscrollBlock: null,
    lastDistractionAlertAt: 0,
    lastDistractionAlertUrl: null,
    lastUpdatedAt: now,
  };
}

function normalizeStudySiteStats(input) {
  const stats = {};
  if (!input || typeof input !== "object") {
    return stats;
  }

  for (const [domain, raw] of Object.entries(input)) {
    if (!domain) {
      continue;
    }

    stats[domain] = {
      domain,
      visits: Math.max(0, Number(raw?.visits) || 0),
      durationMs: Math.max(0, Number(raw?.durationMs) || 0),
      isDistracting: Boolean(raw?.isDistracting),
      doomscrollMs: Math.max(0, Number(raw?.doomscrollMs) || 0),
      lastUrl: typeof raw?.lastUrl === "string" ? raw.lastUrl : null,
    };
  }

  return stats;
}

function sortStudySites(siteStats) {
  return Object.values(siteStats)
    .sort((a, b) => b.durationMs - a.durationMs)
    .map((item) => ({
      ...item,
      durationText: formatDuration(item.durationMs),
    }));
}

function domainMatchesList(domain, domains) {
  return domains.some((item) => domain === item || domain.endsWith(`.${item}`));
}

function isProductiveDomain(domain) {
  if (!domain) {
    return false;
  }
  return domainMatchesList(domain, PRODUCTIVE_DOMAINS);
}

function getDoomscrollSurface(domain, url) {
  for (const surface of DOOMSCROLL_SURFACES) {
    if (Array.isArray(surface.domains) && domainMatchesList(domain, surface.domains)) {
      return surface.label;
    }

    if (Array.isArray(surface.patterns) && surface.patterns.some((pattern) => urlMatchesPattern(url, pattern))) {
      return surface.label;
    }
  }

  return null;
}

function classifyStudyVisit(domain, url, settings) {
  const studySettings = settings || DEFAULT_STUDY_SETTINGS;
  const domainMatch = domainMatchesList(domain, studySettings.distractingDomains || []);
  const patternMatch = (studySettings.distractingUrlPatterns || []).some((pattern) =>
    urlMatchesPattern(url, pattern)
  );
  const doomscrollSurface = getDoomscrollSurface(domain, url);

  return {
    isDistracting: domainMatch || patternMatch || Boolean(doomscrollSurface),
    doomscrollSurface,
  };
}

async function getStudyModeState() {
  const data = await chrome.storage.local.get(STUDY_MODE_KEY);
  const raw = data[STUDY_MODE_KEY];
  if (!raw || typeof raw !== "object") {
    return createEmptyStudyModeState();
  }

  return {
    active: Boolean(raw.active),
    startedAt: Number.isFinite(raw.startedAt) ? raw.startedAt : null,
    currentDomain: typeof raw.currentDomain === "string" ? raw.currentDomain : null,
    currentUrl: typeof raw.currentUrl === "string" ? raw.currentUrl : null,
    chunkStartTime: Number.isFinite(raw.chunkStartTime) ? raw.chunkStartTime : null,
    lastSeenTime: Number.isFinite(raw.lastSeenTime) ? raw.lastSeenTime : null,
    totalActiveMs: Math.max(0, Number(raw.totalActiveMs) || 0),
    totalDistractingMs: Math.max(0, Number(raw.totalDistractingMs) || 0),
    totalDoomscrollMs: Math.max(0, Number(raw.totalDoomscrollMs) || 0),
    totalSwitches: Math.max(0, Number(raw.totalSwitches) || 0),
    siteStats: normalizeStudySiteStats(raw.siteStats),
    doomscrollBySurface: raw.doomscrollBySurface && typeof raw.doomscrollBySurface === "object"
      ? raw.doomscrollBySurface
      : {},
    deepDiveCount: Math.max(0, Number(raw.deepDiveCount) || 0),
    deepDiveEpisodes: Array.isArray(raw.deepDiveEpisodes)
      ? raw.deepDiveEpisodes.filter((item) => item && Number.isFinite(item.durationMs))
      : [],
    currentDoomscrollBlock:
      raw.currentDoomscrollBlock && typeof raw.currentDoomscrollBlock === "object"
        ? {
            label: typeof raw.currentDoomscrollBlock.label === "string" ? raw.currentDoomscrollBlock.label : null,
            startedAt: Number.isFinite(raw.currentDoomscrollBlock.startedAt)
              ? raw.currentDoomscrollBlock.startedAt
              : null,
          }
        : null,
    lastDistractionAlertAt: Math.max(0, Number(raw.lastDistractionAlertAt) || 0),
    lastDistractionAlertUrl: typeof raw.lastDistractionAlertUrl === "string" ? raw.lastDistractionAlertUrl : null,
    lastUpdatedAt: Number.isFinite(raw.lastUpdatedAt) ? raw.lastUpdatedAt : Date.now(),
  };
}

async function setStudyModeState(state) {
  await chrome.storage.local.set({ [STUDY_MODE_KEY]: state });
}

async function clearStudyModeState() {
  await chrome.storage.local.remove(STUDY_MODE_KEY);
}

function createDefaultActivityState() {
  return {
    chromeFocused: true,
    idleState: "active",
    waitingForInteraction: true,
    lastHeartbeatAt: 0,
    lastHeartbeatTabId: null,
    lastHeartbeatWindowId: null,
  };
}

async function getActivityState() {
  const data = await chrome.storage.local.get(ACTIVITY_STATE_KEY);
  const raw = data[ACTIVITY_STATE_KEY];
  if (!raw || typeof raw !== "object") {
    return createDefaultActivityState();
  }

  return {
    chromeFocused: raw.chromeFocused !== false,
    idleState: typeof raw.idleState === "string" ? raw.idleState : "active",
    waitingForInteraction: raw.waitingForInteraction !== false,
    lastHeartbeatAt: Math.max(0, Number(raw.lastHeartbeatAt) || 0),
    lastHeartbeatTabId: Number.isInteger(raw.lastHeartbeatTabId) ? raw.lastHeartbeatTabId : null,
    lastHeartbeatWindowId: Number.isInteger(raw.lastHeartbeatWindowId) ? raw.lastHeartbeatWindowId : null,
  };
}

async function setActivityState(state) {
  await chrome.storage.local.set({ [ACTIVITY_STATE_KEY]: state });
}

function isHeartbeatFresh(state, now = Date.now()) {
  return Number(state?.lastHeartbeatAt) > 0 && now - Number(state.lastHeartbeatAt) <= HEARTBEAT_STALE_MS;
}

function canTrackActively(state, now = Date.now()) {
  return (
    Boolean(state?.chromeFocused) &&
    state?.idleState === "active" &&
    state?.waitingForInteraction === false &&
    isHeartbeatFresh(state, now)
  );
}

async function pauseActiveTracking(reason = "inactive") {
  await commitActiveSession(reason);
  await syncStudyMode(null, null, reason);
  await clearStudyDistractionBadge();
}

async function requireFreshInteraction(reason = "inactive") {
  const state = await getActivityState();
  await setActivityState({
    ...state,
    waitingForInteraction: true,
  });
  await pauseActiveTracking(reason);
}

async function expireTrackingWithoutHeartbeat(now = Date.now()) {
  const state = await getActivityState();
  if (!state.chromeFocused || state.idleState !== "active") {
    return false;
  }
  if (!state.lastHeartbeatAt || now - state.lastHeartbeatAt <= HEARTBEAT_STALE_MS) {
    return false;
  }

  await setActivityState({
    ...state,
    waitingForInteraction: true,
  });
  await pauseActiveTracking("heartbeatTimeout");
  return true;
}

async function getActiveSession() {
  const data = await chrome.storage.local.get(ACTIVE_SESSION_KEY);
  return data[ACTIVE_SESSION_KEY] || null;
}

async function markCurrentSessionProductive(metadata = {}) {
  const active = await getActiveSession();
  if (!active || !active.domain) {
    return false;
  }

  await setActiveSession({
    ...active,
    productivityHint: "productive",
    productivitySource: "youtube_metadata",
    productivityTitle: typeof metadata.title === "string" ? metadata.title.slice(0, 200) : null,
    productivityKeywords: Array.isArray(metadata.keywords) ? metadata.keywords.slice(0, 20) : [],
  });
  return true;
}

async function getAlertState() {
  const data = await chrome.storage.local.get(ALERT_STATE_KEY);
  const state = data[ALERT_STATE_KEY] || {};
  return {
    daily: state.daily || {},
    weekly: state.weekly || {},
  };
}

async function setAlertState(state) {
  await chrome.storage.local.set({ [ALERT_STATE_KEY]: state });
}

function createDefaultThoughtPauseState() {
  return {
    daily: {},
    weekly: {},
    lastPromptAtMs: 0,
    lastRapidSwitchPromptAtMs: 0,
    switchEvents: [],
    lastDomain: null,
  };
}

async function getThoughtPauseState() {
  const data = await chrome.storage.local.get(THOUGHT_PAUSE_STATE_KEY);
  const state = data[THOUGHT_PAUSE_STATE_KEY] || createDefaultThoughtPauseState();
  return {
    daily: state.daily || {},
    weekly: state.weekly || {},
    lastPromptAtMs: Number(state.lastPromptAtMs) || 0,
    lastRapidSwitchPromptAtMs: Number(state.lastRapidSwitchPromptAtMs) || 0,
    switchEvents: Array.isArray(state.switchEvents) ? state.switchEvents.filter((ts) => Number.isFinite(ts)) : [],
    lastDomain: typeof state.lastDomain === "string" ? state.lastDomain : null,
  };
}

async function setThoughtPauseState(state) {
  await chrome.storage.local.set({ [THOUGHT_PAUSE_STATE_KEY]: state });
}

function getThoughtPauseDailyDomainState(state, dayKey, domain) {
  state.daily[dayKey] = state.daily[dayKey] || { domains: {} };
  state.daily[dayKey].domains[domain] = state.daily[dayKey].domains[domain] || {
    firstVisitShown: false,
    continuousShown: false,
    snoozed: false,
    threshold1hShown: false,
    threshold3hShown: false,
  };
  return state.daily[dayKey].domains[domain];
}

function getThoughtPauseWeeklyDomainState(state, weekKey, domain) {
  state.weekly[weekKey] = state.weekly[weekKey] || { domains: {} };
  state.weekly[weekKey].domains[domain] = state.weekly[weekKey].domains[domain] || {
    threshold5hShown: false,
  };
  return state.weekly[weekKey].domains[domain];
}

function isInQuietHours(settings, nowMs) {
  return false;
}

function domainMatchesPauseTarget(settings, domain) {
  if (!domain) {
    return false;
  }

  if (settings.targetMode === "all_tracked") {
    return true;
  }

  for (const item of settings.domains) {
    if (domain === item || domain.endsWith(`.${item}`)) {
      return true;
    }
  }

  return false;
}

async function setActiveSession(session) {
  await chrome.storage.local.set({ [ACTIVE_SESSION_KEY]: session });
}

async function clearActiveSession() {
  await chrome.storage.local.remove(ACTIVE_SESSION_KEY);
}

function ensureStudySite(state, domain, url = null, studySettings = DEFAULT_STUDY_SETTINGS) {
  if (!domain) {
    return null;
  }

  const classification = classifyStudyVisit(domain, url, studySettings);

  if (!state.siteStats[domain]) {
    state.siteStats[domain] = {
      domain,
      visits: 0,
      durationMs: 0,
      isDistracting: classification.isDistracting,
      doomscrollMs: 0,
      lastUrl: null,
    };
  }

  state.siteStats[domain].isDistracting = classification.isDistracting;
  if (url) {
    state.siteStats[domain].lastUrl = url;
  }

  return state.siteStats[domain];
}

function applyStudyChunkToState(state, studySettings = DEFAULT_STUDY_SETTINGS, now = Date.now()) {
  if (!state.active || !state.currentDomain || !state.chunkStartTime) {
    state.lastUpdatedAt = now;
    return 0;
  }

  const lastSeenTime =
    typeof state.lastSeenTime === "number" ? state.lastSeenTime : state.chunkStartTime;
  const cappedEndTime = Math.min(now, lastSeenTime + INACTIVITY_GRACE_MS);
  const endTime = Math.max(state.chunkStartTime, cappedEndTime);
  const durationMs = Math.max(0, endTime - state.chunkStartTime);
  if (durationMs <= 0) {
    state.lastUpdatedAt = now;
    return 0;
  }

  const classification = classifyStudyVisit(state.currentDomain, state.currentUrl, studySettings);
  const site = ensureStudySite(state, state.currentDomain, state.currentUrl, studySettings);
  site.durationMs += durationMs;
  state.totalActiveMs += durationMs;
  if (classification.isDistracting) {
    state.totalDistractingMs += durationMs;
  }
  if (classification.doomscrollSurface) {
    if (
      !state.currentDoomscrollBlock ||
      state.currentDoomscrollBlock.label !== classification.doomscrollSurface
    ) {
      state.currentDoomscrollBlock = {
        label: classification.doomscrollSurface,
        startedAt: state.chunkStartTime,
      };
    }
    site.doomscrollMs += durationMs;
    state.totalDoomscrollMs += durationMs;
    state.doomscrollBySurface[classification.doomscrollSurface] =
      (state.doomscrollBySurface[classification.doomscrollSurface] || 0) + durationMs;
  } else if (state.currentDoomscrollBlock?.startedAt) {
    const blockDurationMs = Math.max(0, endTime - state.currentDoomscrollBlock.startedAt);
    if (blockDurationMs >= DEEP_DIVE_MAX_MS) {
      state.deepDiveCount += 1;
      state.deepDiveEpisodes.push({
        label: state.currentDoomscrollBlock.label,
        durationMs: blockDurationMs,
      });
    }
    state.currentDoomscrollBlock = null;
  }

  state.chunkStartTime = now;
  state.lastSeenTime = now;
  state.lastUpdatedAt = now;
  return durationMs;
}

function createStudySessionRecord(state, endTime = Date.now()) {
  if (state.currentDoomscrollBlock?.startedAt) {
    const blockDurationMs = Math.max(0, endTime - state.currentDoomscrollBlock.startedAt);
    if (blockDurationMs >= DEEP_DIVE_MAX_MS) {
      state.deepDiveCount += 1;
      state.deepDiveEpisodes.push({
        label: state.currentDoomscrollBlock.label,
        durationMs: blockDurationMs,
      });
    }
    state.currentDoomscrollBlock = null;
  }

  const sites = sortStudySites(state.siteStats);
  const uniqueSites = sites.length;
  const distractingSites = sites.filter((site) => site.isDistracting);
  const focusTimeMs = Math.max(0, state.totalActiveMs - state.totalDistractingMs);
  const focusRatio =
    state.totalActiveMs > 0 ? Number((focusTimeMs / state.totalActiveMs).toFixed(2)) : 0;

  return {
    dateKey: getDayKeyFromMs(state.startedAt || endTime),
    startTime: state.startedAt || endTime,
    endTime,
    durationMs: Math.max(0, endTime - (state.startedAt || endTime)),
    activeStudyTimeMs: state.totalActiveMs,
    distractionTimeMs: state.totalDistractingMs,
    doomscrollTimeMs: state.totalDoomscrollMs,
    focusTimeMs,
    focusRatio,
    uniqueSites,
    totalSwitches: state.totalSwitches || 0,
    deepDiveCount: state.deepDiveCount || 0,
    sites,
    distractingSites,
    doomscrollSurfaces: Object.entries(state.doomscrollBySurface || {})
      .map(([label, durationMs]) => ({
        label,
        durationMs,
        durationText: formatDuration(durationMs),
      }))
      .sort((a, b) => b.durationMs - a.durationMs),
    deepDiveEpisodes: [...(state.deepDiveEpisodes || [])],
  };
}

function getStudyModeSnapshot(state, studySettings = DEFAULT_STUDY_SETTINGS) {
  const now = Date.now();
  const snapshot = clone(state);
  applyStudyChunkToState(snapshot, studySettings, now);
  return createStudySessionRecord(snapshot, now);
}

async function startStudyMode() {
  const now = Date.now();
  const existing = await getStudyModeState();
  const studySettings = await getStudySettings();
  if (existing.active) {
    return {
      active: true,
      session: getStudyModeSnapshot(existing, studySettings),
    };
  }

  const tab = await getCurrentActiveTab();
  const domain = normalizeDomain(tab?.url);
  const state = createEmptyStudyModeState(now);
  state.active = true;
  state.startedAt = now;
  state.currentDomain = domain;
  state.currentUrl = tab?.url || null;
  state.chunkStartTime = domain ? now : null;
  state.lastSeenTime = domain ? now : null;

  if (domain) {
    const site = ensureStudySite(state, domain, tab?.url || null, studySettings);
    site.visits = 1;
  }

  await setStudyModeState(state);
  return {
    active: true,
    session: getStudyModeSnapshot(state, studySettings),
  };
}

async function stopStudyMode() {
  const state = await getStudyModeState();
  const studySettings = await getStudySettings();
  if (!state.active || !state.startedAt) {
    return {
      active: false,
      session: null,
    };
  }

  const now = Date.now();
  const finalState = clone(state);
  applyStudyChunkToState(finalState, studySettings, now);
  const session = createStudySessionRecord(finalState, now);

  if (session.activeStudyTimeMs > 0 || session.uniqueSites > 0) {
    await addStudySession(session);
  }

  await clearStudyModeState();
  await clearStudyDistractionBadge();
  analyticsCache.clear();

  return {
    active: false,
    session,
  };
}

async function syncStudyMode(domain, url, reason = "sync") {
  const state = await getStudyModeState();
  const studySettings = await getStudySettings();
  if (!state.active || !state.startedAt) {
    return null;
  }

  const now = Date.now();
  const nextDomain = domain || null;
  const nextUrl = url || null;

  if (!nextDomain) {
    applyStudyChunkToState(state, studySettings, now);
    state.currentDomain = null;
    state.currentUrl = null;
    state.chunkStartTime = null;
    state.lastSeenTime = null;
    await setStudyModeState(state);
    return getStudyModeSnapshot(state, studySettings);
  }

  if (!state.currentDomain) {
    const site = ensureStudySite(state, nextDomain, nextUrl, studySettings);
    if (site.visits === 0) {
      site.visits = 1;
    }
    state.currentDomain = nextDomain;
    state.currentUrl = nextUrl;
    state.chunkStartTime = now;
    state.lastSeenTime = now;
    state.lastUpdatedAt = now;
    await setStudyModeState(state);
    return getStudyModeSnapshot(state, studySettings);
  }

  if (state.currentDomain === nextDomain) {
    const currentClassification = classifyStudyVisit(state.currentDomain, state.currentUrl, studySettings);
    const nextClassification = classifyStudyVisit(nextDomain, nextUrl, studySettings);
    const changedMode =
      currentClassification.doomscrollSurface !== nextClassification.doomscrollSurface;

    if (reason === "heartbeat" || changedMode) {
      applyStudyChunkToState(state, studySettings, now);
      state.currentUrl = nextUrl;
    } else {
      state.currentUrl = nextUrl;
      state.lastSeenTime = now;
      state.lastUpdatedAt = now;
    }
    await setStudyModeState(state);
    return getStudyModeSnapshot(state, studySettings);
  }

  applyStudyChunkToState(state, studySettings, now);
  state.totalSwitches += 1;
  const site = ensureStudySite(state, nextDomain, nextUrl, studySettings);
  site.visits += 1;
  state.currentDomain = nextDomain;
  state.currentUrl = nextUrl;
  state.chunkStartTime = now;
  state.lastSeenTime = now;
  state.lastUpdatedAt = now;
  await setStudyModeState(state);
  return getStudyModeSnapshot(state, studySettings);
}

async function commitActiveSession(reason = "switch") {
  const active = await getActiveSession();
  if (!active || !active.domain || !active.startTime) {
    return;
  }

  const now = Date.now();
  const lastSeenTime =
    typeof active.lastSeenTime === "number" ? active.lastSeenTime : active.startTime;
  const cappedEndTime = Math.min(now, lastSeenTime + INACTIVITY_GRACE_MS);
  const endTime = Math.max(active.startTime, cappedEndTime);
  const durationMs = Math.max(0, endTime - active.startTime);
  if (durationMs > 0) {
    await addSession({
      domain: active.domain,
      startTime: active.startTime,
      endTime,
      durationMs,
      reason,
      productivityHint: active.productivityHint || null,
      productivitySource: active.productivitySource || null,
      productivityTitle: active.productivityTitle || null,
      productivityKeywords: Array.isArray(active.productivityKeywords)
        ? active.productivityKeywords.slice(0, 20)
        : [],
    });
  }

  await clearActiveSession();
}

async function recoverActiveSessionOnStartup() {
  const active = await getActiveSession();
  if (!active || !active.domain || !active.startTime) {
    return;
  }

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
      productivityHint: active.productivityHint || null,
      productivitySource: active.productivitySource || null,
      productivityTitle: active.productivityTitle || null,
      productivityKeywords: Array.isArray(active.productivityKeywords)
        ? active.productivityKeywords.slice(0, 20)
        : [],
    });
  }

  await clearActiveSession();
}

async function trackDomain(domain, reason = "activate") {
  const now = Date.now();
  const active = await getActiveSession();

  if (active && active.domain === domain) {
    const continuousStartTime =
      typeof active.continuousStartTime === "number" ? active.continuousStartTime : active.startTime;

    if (reason === "heartbeat" || now - active.startTime > MAX_SESSION_MS) {
      await commitActiveSession("heartbeat");
      await setActiveSession({
        domain,
        startTime: now,
        lastSeenTime: now,
        continuousStartTime: continuousStartTime || now,
      });
      return { switched: false, started: true };
    }

    await setActiveSession({
      ...active,
      lastSeenTime: now,
      continuousStartTime: continuousStartTime || now,
    });

    return { switched: false, started: false };
  }

  if (active) {
    await commitActiveSession(reason);
  }

  if (domain) {
    await setActiveSession({
      domain,
      startTime: now,
      lastSeenTime: now,
      continuousStartTime: now,
    });
    return { switched: true, started: true };
  }

  return { switched: Boolean(active), started: false };
}

async function getCurrentActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tabs || tabs.length === 0) {
    return null;
  }
  return tabs[0];
}

async function getCurrentDomainFromActiveTab() {
  const tab = await getCurrentActiveTab();
  return normalizeDomain(tab?.url);
}

function sendUsageAlert(title, message) {
  const primaryOptions = {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon.png"),
    title,
    message,
    priority: 1,
  };

  chrome.notifications.create(primaryOptions, () => {
    const firstError = chrome.runtime.lastError;
    if (!firstError) {
      return;
    }

    // Retry with a simpler icon path and callback-based API to avoid unhandled promises.
    chrome.notifications.create(
      {
        type: "basic",
        iconUrl: "icon.png",
        title,
        message,
        priority: 1,
      },
      () => {
        // Consume lastError to avoid "Unchecked runtime.lastError".
        const secondError = chrome.runtime.lastError;
        void secondError;
      }
    );
  });
}

function getThoughtPauseReasonText(triggerType, domain) {
  if (triggerType === "rapid_switch") {
    return "You were rapidly switching between tabs.";
  }

  if (triggerType === "first_visit") {
    return `You opened ${domain} again.`;
  }

  if (triggerType === "continuous_5min") {
    return `You stayed on ${domain} continuously for a while.`;
  }

  if (triggerType === "threshold_1h") {
    return `You crossed 1 hour on ${domain} today.`;
  }

  if (triggerType === "threshold_3h") {
    return `You crossed 3 hours on ${domain} today.`;
  }

  if (triggerType === "threshold_5h_weekly") {
    return `You crossed 5 hours on ${domain} this week.`;
  }

  if (triggerType === "youtube_non_educational") {
    return `This YouTube video does not look educational based on its title and metadata.`;
  }

  if (triggerType === "youtube_blocked_title") {
    return `This YouTube title looks entertainment-oriented rather than study-related.`;
  }

  return "This is a short check-in to build awareness.";
}

function isIgnorableTabMessagingError(error) {
  const message = String(error || "");
  return (
    message.includes("Could not establish connection") ||
    message.includes("Receiving end does not exist") ||
    message.includes("The message port closed before a response was received") ||
    message.includes("Extension context invalidated")
  );
}

async function swallowIgnorableAsync(task) {
  try {
    return await task();
  } catch (error) {
    if (isIgnorableTabMessagingError(error?.message || error)) {
      return null;
    }
    throw error;
  }
}

async function ensureContentScriptInjected(tabId) {
  if (!Number.isInteger(tabId)) {
    return false;
  }

  const tab = await chrome.tabs.get(tabId);
  if (!tab?.url || !isTrackableUrl(tab.url)) {
    return false;
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
  return true;
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    const attemptSend = () => {
      chrome.tabs.sendMessage(tabId, message, async (response) => {
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message || "Unknown tab messaging error";
          if (
            errorMessage.includes("Could not establish connection") ||
            errorMessage.includes("Receiving end does not exist")
          ) {
            try {
              const injected = await ensureContentScriptInjected(tabId);
              if (!injected) {
                resolve(null);
                return;
              }
              chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
                if (chrome.runtime.lastError) {
                  const retryMessage =
                    chrome.runtime.lastError.message || "Unknown tab messaging error";
                  if (isIgnorableTabMessagingError(retryMessage)) {
                    resolve(null);
                    return;
                  }
                  reject(new Error(retryMessage));
                  return;
                }
                resolve(retryResponse || null);
              });
            } catch (injectError) {
              if (isIgnorableTabMessagingError(injectError?.message || injectError)) {
                resolve(null);
                return;
              }
              reject(injectError);
            }
            return;
          }

          if (isIgnorableTabMessagingError(errorMessage)) {
            resolve(null);
            return;
          }
          reject(new Error(errorMessage));
          return;
        }
        resolve(response || null);
      });
    };

    attemptSend();
  });
}

async function clearStudyDistractionBadge() {
  await chrome.action.setBadgeText({ text: "" });
  await chrome.action.setTitle({ title: "Website Use Tracker" });
}

async function setStudyDistractionBadge(domain) {
  await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  await chrome.action.setBadgeText({ text: "!!" });
  await chrome.action.setTitle({
    title: domain
      ? `Study Mode distraction detected on ${domain}`
      : "Study Mode distraction detected",
  });
}

async function updateStudyDistractionBadge(domain, url) {
  const [studyState, studySettings] = await Promise.all([getStudyModeState(), getStudySettings()]);
  if (!studyState.active || !domain || !url) {
    await clearStudyDistractionBadge();
    return false;
  }

  const classification = classifyStudyVisit(domain, url, studySettings);
  if (!classification.isDistracting) {
    await clearStudyDistractionBadge();
    return false;
  }

  await setStudyDistractionBadge(domain);
  return true;
}

async function maybeShowStudyAlert(tab, domain, url) {
  if (!tab?.id || !domain || !url || !isTrackableUrl(url)) {
    await clearStudyDistractionBadge();
    return false;
  }

  const [studyState, studySettings] = await Promise.all([getStudyModeState(), getStudySettings()]);
  if (!studyState.active) {
    await clearStudyDistractionBadge();
    return false;
  }

  const classification = classifyStudyVisit(domain, url, studySettings);
  if (!classification.isDistracting) {
    await clearStudyDistractionBadge();
    return false;
  }

  await setStudyDistractionBadge(domain);

  const now = Date.now();
  const lastAlertAt = Number(studyState.lastDistractionAlertAt) || 0;
  const lastAlertUrl = studyState.lastDistractionAlertUrl || null;
  if (lastAlertUrl === url && now - lastAlertAt < STUDY_ALERT_COOLDOWN_MS) {
    return false;
  }

  try {
    await withTimeout(
      sendMessageToTab(tab.id, {
        type: "SHOW_STUDY_ALERT",
        payload: {
          domain,
          url,
          siteName: domain,
        },
      }),
      30000
    );
  } catch {
    return false;
  }

  studyState.lastDistractionAlertAt = now;
  studyState.lastDistractionAlertUrl = url;
  await setStudyModeState(studyState);
  return true;
}

function isDeepDiveUrl(url) {
  return DEEP_DIVE_PATTERNS.some((pattern) => urlMatchesPattern(url, pattern));
}

function clearDeepDiveTimer(tabId) {
  const existing = deepDiveTimers.get(tabId);
  if (existing) {
    clearTimeout(existing.timerId);
    deepDiveTimers.delete(tabId);
  }
}

async function startDeepDiveTimer(tabId, url) {
  if (!Number.isInteger(tabId) || !url || !isDeepDiveUrl(url)) {
    return;
  }

  const existing = deepDiveTimers.get(tabId);
  if (existing?.url === url) {
    return;
  }

  clearDeepDiveTimer(tabId);
  const timerId = setTimeout(() => {
    chrome.tabs.get(tabId, (tab) => {
      const error = chrome.runtime.lastError;
      if (error || !tab || tab.url !== url) {
        clearDeepDiveTimer(tabId);
        return;
      }

      chrome.tabs.remove(tabId, () => {
        const removeError = chrome.runtime.lastError;
        void removeError;
      });
      sendUsageAlert(
        "Deep dive closed",
        "A Shorts/Reels tab was closed after 15 minutes to interrupt doomscrolling."
      );
      clearDeepDiveTimer(tabId);
    });
  }, DEEP_DIVE_MAX_MS);

  deepDiveTimers.set(tabId, { timerId, url });
}

async function syncDeepDiveTimer(tab) {
  if (!tab || !Number.isInteger(tab.id)) {
    return;
  }

  if (!isTrackableUrl(tab.url) || !isDeepDiveUrl(tab.url)) {
    clearDeepDiveTimer(tab.id);
    return;
  }

  await startDeepDiveTimer(tab.id, tab.url);
}

async function maybeTriggerLoopLockout(tab) {
  const now = Date.now();
  loopCount.push(now);
  while (loopCount.length > 0 && now - loopCount[0] > LOOP_LOCKOUT_WINDOW_MS) {
    loopCount.shift();
  }

  if (loopCount.length < LOOP_LOCKOUT_THRESHOLD) {
    return false;
  }

  if (!tab?.id) {
    return false;
  }

  loopCount.length = 0;
  await chrome.tabs.update(tab.id, {
    url: chrome.runtime.getURL(`cooldown.html?seconds=${COOLDOWN_PAGE_SECONDS}`),
  });
  return true;
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function pruneLoopQueue(nowMs, windowMs) {
  while (loopSwitchQueue.length > 0 && nowMs - loopSwitchQueue[0].ts > windowMs) {
    loopSwitchQueue.shift();
  }
}

function getTopDomainsInQueue(maxDomains = 3) {
  const counts = new Map();
  for (const item of loopSwitchQueue) {
    counts.set(item.domain, (counts.get(item.domain) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxDomains)
    .map((item) => item.domain);
}

async function showRevisitLoopPrompt(payload) {
  const tab = await getCurrentActiveTab();
  if (!tab || !tab.id || !isTrackableUrl(tab.url)) {
    return null;
  }

  const response = await withTimeout(
    sendMessageToTab(tab.id, {
      type: "SHOW_REVISIT_LOOP",
      payload,
    }),
    30000
  );

  return response || { action: "dismiss" };
}

async function maybeTriggerRevisitLoopPrompt({ ts, domain }) {
  const settings = await getLoopSettings();
  if (!settings.enabled) {
    return;
  }

  const windowMs = settings.windowMinutes * 60 * 1000;
  loopSwitchQueue.push({ ts, domain });
  pruneLoopQueue(ts, windowMs);

  const switchCount = loopSwitchQueue.length;
  const uniqueDomains = new Set(loopSwitchQueue.map((item) => item.domain));
  if (switchCount < settings.minSwitches) {
    return;
  }

  if (uniqueDomains.size < 2 || uniqueDomains.size > settings.maxUniqueDomains) {
    return;
  }

  const state = await getLoopState();
  const todayKey = getDayKeyFromMs(ts);
  if (state.snoozeDateKey === todayKey) {
    return;
  }

  const cooldownMs = settings.cooldownMinutes * 60 * 1000;
  if (state.lastPromptTimestamp && ts - state.lastPromptTimestamp < cooldownMs) {
    return;
  }

  const domains = getTopDomainsInQueue(settings.maxUniqueDomains);
  const activeTab = await getCurrentActiveTab();
  const response = await showRevisitLoopPrompt({
    switchCount,
    windowMinutes: settings.windowMinutes,
    domains,
  });

  const action = response?.action || "dismiss";
  const nextState = {
    lastPromptTimestamp: ts,
    snoozeDateKey: action === "snooze_today" ? todayKey : state.snoozeDateKey,
  };
  await setLoopState(nextState);

  await addLoopPrompt({
    timestamp: ts,
    dateKey: todayKey,
    switchCount,
    windowMinutes: settings.windowMinutes,
    domains,
    action,
  });
  analyticsCache.clear();

  if (action === "break") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html#take-break") });
  }

  await maybeTriggerLoopLockout(activeTab);
}

async function maybeLogTabEvent(tab, reason = "activeChange") {
  if (!tab || !Number.isInteger(tab.id) || !isTrackableUrl(tab.url)) {
    const state = await getTabEventState();
    if (state.lastDomain !== null) {
      await setTabEventState({
        ...state,
        lastDomain: null,
        lastUrl: null,
        lastTabId: Number.isInteger(tab?.id) ? tab.id : null,
      });
    }
    return;
  }

  const domain = normalizeDomain(tab.url);
  if (!domain) {
    return;
  }

  const state = await getTabEventState();
  const prevDomain = state.lastDomain;

  // Only log on meaningful active-domain changes and avoid refresh duplicates.
  if (prevDomain === domain) {
    await setTabEventState({
      lastDomain: domain,
      lastUrl: tab.url,
      lastTabId: tab.id,
    });
    return;
  }

  const now = Date.now();
  const date = new Date(now);
  const hour = date.getHours();
  const minuteBucket = Math.floor(now / 60000);

  await addTabEvent({
    timestamp: now,
    dateKey: getDayKeyFromMs(now),
    domain,
    prevDomain,
    url: tab.url,
    hour,
    minuteBucket,
    isTracked: true,
    reason,
  });

  await maybeTriggerRevisitLoopPrompt({ ts: now, domain });
  analyticsCache.clear();

  await setTabEventState({
    lastDomain: domain,
    lastUrl: tab.url,
    lastTabId: tab.id,
  });
}

async function showThoughtPausePrompt(triggerType, domain) {
  const tab = await getCurrentActiveTab();
  if (!tab || !tab.id || !isTrackableUrl(tab.url) || normalizeDomain(tab.url) !== domain) {
    return null;
  }

  const settings = await getThoughtPauseSettings();
  const response = await withTimeout(
    sendMessageToTab(tab.id, {
      type: "SHOW_THOUGHT_PAUSE",
      payload: {
        triggerType,
        domain,
        url: tab.url,
        strictMode: settings.strictMode,
        autoDismissSeconds: settings.autoDismissSeconds,
        allowNote: settings.allowNote,
        quickChoices: settings.quickChoices,
        promptText: "Pause — What are you thinking right now?",
        reasonText: getThoughtPauseReasonText(triggerType, domain),
      },
    }),
    120000
  );

  return {
    tab,
    response,
  };
}

async function maybePromptThoughtPause({ triggerType, domain, url, thresholdKey = null, force = false }) {
  if (!domain) {
    return false;
  }

  const now = Date.now();
  const settings = await getThoughtPauseSettings();
  if (!settings.enabled) {
    return false;
  }

  if (!force && !domainMatchesPauseTarget(settings, domain)) {
    return false;
  }

  if (isInQuietHours(settings, now)) {
    return false;
  }

  const state = await getThoughtPauseState();
  const dayKey = getDayKeyFromMs(now);
  const weekKey = getWeekKeyFromMs(now);
  const dailyDomainState = getThoughtPauseDailyDomainState(state, dayKey, domain);
  const weeklyDomainState = getThoughtPauseWeeklyDomainState(state, weekKey, domain);

  if (dailyDomainState.snoozed) {
    return false;
  }

  if (
    !force &&
    triggerType !== "rapid_switch" &&
    state.lastPromptAtMs &&
    now - state.lastPromptAtMs < settings.cooldownMinutes * 60 * 1000
  ) {
    return false;
  }

  if (triggerType === "continuous_5min" && dailyDomainState.continuousShown) {
    return false;
  }

  if (triggerType === "rapid_switch") {
    if (state.lastRapidSwitchPromptAtMs && now - state.lastRapidSwitchPromptAtMs < settings.rapidSwitchCooldownMinutes * 60 * 1000) {
      return false;
    }
  }

  if (thresholdKey === "threshold_1h" && dailyDomainState.threshold1hShown) {
    return false;
  }

  if (thresholdKey === "threshold_3h" && dailyDomainState.threshold3hShown) {
    return false;
  }

  if (thresholdKey === "threshold_5h_weekly" && weeklyDomainState.threshold5hShown) {
    return false;
  }

  let promptResult;
  try {
    promptResult = await showThoughtPausePrompt(triggerType, domain);
  } catch (error) {
    return false;
  }

  if (!promptResult) {
    return false;
  }

  const response = promptResult.response || {};
  const action = response.action || "dismiss";
  const choice = typeof response.choice === "string" ? response.choice : null;
  const note = typeof response.note === "string" ? response.note.slice(0, 280) : "";
  const snoozeSiteToday = Boolean(response.snoozeSiteToday);

  if (snoozeSiteToday) {
    dailyDomainState.snoozed = true;
  }

  if (triggerType === "continuous_5min") {
    dailyDomainState.continuousShown = true;
  }

  if (triggerType === "rapid_switch") {
    state.lastRapidSwitchPromptAtMs = now;
  }

  if (thresholdKey === "threshold_1h") {
    dailyDomainState.threshold1hShown = true;
  }

  if (thresholdKey === "threshold_3h") {
    dailyDomainState.threshold3hShown = true;
  }

  if (thresholdKey === "threshold_5h_weekly") {
    weeklyDomainState.threshold5hShown = true;
  }

  state.lastPromptAtMs = now;
  await setThoughtPauseState(state);

  if (!response.storedByContent) {
    await addThoughtPause({
      timestamp: now,
      dateKey: dayKey,
      domain,
      url: url || promptResult.tab.url || null,
      triggerType,
      choice,
      note,
      action,
    });
  }

  return true;
}

function getRetentionCutoffMs() {
  return Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

function getOldestWeeklyKeyCutoffMs() {
  return Date.now() - 26 * 7 * 24 * 60 * 60 * 1000;
}

async function pruneAlertState() {
  const state = await getAlertState();
  const dailyCutoff = getRetentionCutoffMs();
  const weeklyCutoff = getOldestWeeklyKeyCutoffMs();

  for (const key of Object.keys(state.daily)) {
    const ms = parseDateKeyToMs(key);
    if (ms === null || ms < dailyCutoff) {
      delete state.daily[key];
    }
  }

  for (const key of Object.keys(state.weekly)) {
    const ms = parseDateKeyToMs(key);
    if (ms === null || ms < weeklyCutoff) {
      delete state.weekly[key];
    }
  }

  await setAlertState(state);
}

async function pruneThoughtPauseState() {
  const state = await getThoughtPauseState();
  const dailyCutoff = getRetentionCutoffMs();
  const weeklyCutoff = getOldestWeeklyKeyCutoffMs();

  for (const key of Object.keys(state.daily)) {
    const ms = parseDateKeyToMs(key);
    if (ms === null || ms < dailyCutoff) {
      delete state.daily[key];
    }
  }

  for (const key of Object.keys(state.weekly)) {
    const ms = parseDateKeyToMs(key);
    if (ms === null || ms < weeklyCutoff) {
      delete state.weekly[key];
    }
  }

  const switchWindowMs = 10 * 60 * 1000;
  const now = Date.now();
  state.switchEvents = state.switchEvents.filter((ts) => now - ts <= switchWindowMs);

  await setThoughtPauseState(state);
}

async function pruneOldSessions() {
  const cutoffMs = getRetentionCutoffMs();
  await deleteSessionsOlderThan(cutoffMs);
  await deleteThoughtPausesOlderThan(cutoffMs);
  await deleteTabEventsOlderThan(cutoffMs);
  await deleteLoopPromptsOlderThan(cutoffMs);
  await deleteStudySessionsOlderThan(cutoffMs);
  await pruneAlertState();
  await pruneThoughtPauseState();
  analyticsCache.clear();
}

async function getDomainUsageInRange(domain, startMs, endMs) {
  const sessions = await getSessionsInRange(startMs, endMs);
  let totalMs = 0;

  for (const session of sessions) {
    if (session.domain === domain && typeof session.durationMs === "number") {
      totalMs += session.durationMs;
    }
  }

  const active = await getActiveSession();
  if (active && active.domain === domain && typeof active.startTime === "number") {
    const overlapStart = Math.max(startMs, active.startTime);
    const lastSeenTime =
      typeof active.lastSeenTime === "number" ? active.lastSeenTime : active.startTime;
    const cappedActiveEnd = Math.min(Date.now(), lastSeenTime + INACTIVITY_GRACE_MS);
    const overlapEnd = Math.min(endMs, cappedActiveEnd);
    if (overlapEnd > overlapStart) {
      totalMs += overlapEnd - overlapStart;
    }
  }

  return totalMs;
}

async function maybeSendUsageAlerts(domain, url) {
  if (!domain) {
    return;
  }

  const now = Date.now();
  const dayKey = getDayKeyFromMs(now);
  const weekKey = getWeekKeyFromMs(now);
  const dailyBounds = getPeriodBounds("daily");
  const weeklyBounds = getPeriodBounds("weekly");

  const [dailyUsageMs, weeklyUsageMs, state, pauseSettings] = await Promise.all([
    getDomainUsageInRange(domain, dailyBounds.start, dailyBounds.end),
    getDomainUsageInRange(domain, weeklyBounds.start, weeklyBounds.end),
    getAlertState(),
    getThoughtPauseSettings(),
  ]);

  let changed = false;
  state.daily[dayKey] = state.daily[dayKey] || {};
  state.daily[dayKey][domain] = state.daily[dayKey][domain] || {
    oneHourSent: false,
    threeHourSent: false,
  };
  state.weekly[weekKey] = state.weekly[weekKey] || {};

  const dailyDomainState = state.daily[dayKey][domain];

  if (!dailyDomainState.oneHourSent && dailyUsageMs >= DAILY_FIRST_ALERT_MS) {
    sendUsageAlert("Daily limit reached", `You spent more than 1 hour on ${domain} today.`);
    dailyDomainState.oneHourSent = true;
    changed = true;
    if (pauseSettings.triggers.threshold) {
      await maybePromptThoughtPause({ triggerType: "threshold_1h", thresholdKey: "threshold_1h", domain, url });
    }
  }

  if (!dailyDomainState.threeHourSent && dailyUsageMs >= DAILY_SECOND_ALERT_MS) {
    sendUsageAlert("Daily high usage", `You spent more than 3 hours on ${domain} today.`);
    dailyDomainState.threeHourSent = true;
    changed = true;
    if (pauseSettings.triggers.threshold) {
      await maybePromptThoughtPause({ triggerType: "threshold_3h", thresholdKey: "threshold_3h", domain, url });
    }
  }

  if (!state.weekly[weekKey][domain] && weeklyUsageMs >= WEEKLY_ALERT_MS) {
    sendUsageAlert("Weekly limit reached", `You spent more than 5 hours on ${domain} this week.`);
    state.weekly[weekKey][domain] = true;
    changed = true;
    if (pauseSettings.triggers.threshold) {
      await maybePromptThoughtPause({
        triggerType: "threshold_5h_weekly",
        thresholdKey: "threshold_5h_weekly",
        domain,
        url,
      });
    }
  }

  if (changed) {
    await setAlertState(state);
  }
}

async function maybePromptFirstVisit(domain, url) {
  const settings = await getThoughtPauseSettings();
  if (!settings.triggers.firstVisit) {
    return;
  }

  await maybePromptThoughtPause({
    triggerType: "first_visit",
    domain,
    url,
  });
}

async function maybePromptContinuousUsage(domain, url) {
  const settings = await getThoughtPauseSettings();
  if (!settings.triggers.continuousUsage) {
    return;
  }

  const active = await getActiveSession();
  if (!active || active.domain !== domain || typeof active.startTime !== "number") {
    return;
  }

  const continuousStart =
    typeof active.continuousStartTime === "number" ? active.continuousStartTime : active.startTime;
  const elapsedMs = Date.now() - continuousStart;
  if (elapsedMs < settings.continuousMinutes * 60 * 1000) {
    return;
  }

  await maybePromptThoughtPause({
    triggerType: "continuous_5min",
    domain,
    url,
  });
}

async function maybePromptRapidSwitch(domain, url) {
  const settings = await getThoughtPauseSettings();
  if (!settings.triggers.rapidSwitch) {
    return;
  }

  const now = Date.now();
  const state = await getThoughtPauseState();
  const windowMs = settings.rapidSwitchWindowSeconds * 1000;
  state.switchEvents = state.switchEvents.filter((ts) => now - ts <= windowMs);
  state.switchEvents.push(now);
  await setThoughtPauseState(state);

  if (state.switchEvents.length < settings.rapidSwitchThreshold) {
    return;
  }

  await maybePromptThoughtPause({
    triggerType: "rapid_switch",
    domain,
    url,
  });
}

async function syncTrackingFromActiveTab(reason = "sync") {
  try {
    const tab = await getCurrentActiveTab();
    if (["tabActivated", "tabUpdated"].includes(reason)) {
      await maybeLogTabEvent(tab, reason);
    }

    const activityState = await getActivityState();
    if (!canTrackActively(activityState)) {
      await pauseActiveTracking(reason);
      return;
    }

    const domain = normalizeDomain(tab?.url);
    await trackDomain(domain, reason);
    await syncStudyMode(domain, tab?.url || null, reason);
    await swallowIgnorableAsync(() => updateStudyDistractionBadge(domain, tab?.url || null));

    await swallowIgnorableAsync(() => maybeSendUsageAlerts(domain, tab?.url || null));

    if (
      domain &&
      ["tabActivated", "tabUpdated", "startup", "install", "idleReturn", "interactionHeartbeat"].includes(reason)
    ) {
      await swallowIgnorableAsync(() => maybePromptFirstVisit(domain, tab?.url || null));
    }

    if (domain && reason === "heartbeat") {
      await swallowIgnorableAsync(() => maybePromptContinuousUsage(domain, tab?.url || null));
    }
  } catch (error) {
    if (isIgnorableTabMessagingError(error?.message || error)) {
      return;
    }
    console.error("syncTrackingFromActiveTab failed", error);
  }
}

function getTopSitesFromSessions(sessions) {
  const domainTotals = new Map();

  for (const session of sessions) {
    const value = typeof session.durationMs === "number" ? session.durationMs : 0;
    const previous = domainTotals.get(session.domain) || 0;
    domainTotals.set(session.domain, previous + value);
  }

  return [...domainTotals.entries()]
    .map(([domain, durationMs]) => ({ domain, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      domain: item.domain,
      durationMs: item.durationMs,
      durationText: formatDuration(item.durationMs),
    }));
}

function getThoughtPauseAnalytics(pauses, sessions) {
  const triggerBySite = new Map();
  const choices = new Map();
  const pauseCountBySite = new Map();
  const timeBySite = new Map();

  for (const pause of pauses) {
    const domain = pause.domain || "unknown";
    triggerBySite.set(domain, (triggerBySite.get(domain) || 0) + 1);
    pauseCountBySite.set(domain, (pauseCountBySite.get(domain) || 0) + 1);

    const choiceLabel = pause.choice || (pause.action === "continue" ? "Continue" : "No choice");
    choices.set(choiceLabel, (choices.get(choiceLabel) || 0) + 1);
  }

  for (const session of sessions) {
    const duration = typeof session.durationMs === "number" ? session.durationMs : 0;
    timeBySite.set(session.domain, (timeBySite.get(session.domain) || 0) + duration);
  }

  const topTriggerSites = [...triggerBySite.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const commonChoices = [...choices.entries()]
    .map(([choice, count]) => ({ choice, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const usageVsPauses = [...timeBySite.entries()]
    .map(([domain, durationMs]) => ({
      domain,
      durationMs,
      durationText: formatDuration(durationMs),
      pauses: pauseCountBySite.get(domain) || 0,
    }))
    .filter((item) => item.pauses > 0 || item.durationMs > 0)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

  return {
    totalPauses: pauses.length,
    topTriggerSites,
    commonChoices,
    usageVsPauses,
  };
}

function getStudyModeAnalytics(
  sessions,
  activeState = null,
  bounds = null,
  studySettings = DEFAULT_STUDY_SETTINGS
) {
  const sourceSessions = [...sessions];
  if (
    activeState &&
    activeState.active &&
    activeState.startedAt &&
    (!bounds || activeState.startedAt >= bounds.start)
  ) {
    sourceSessions.push(getStudyModeSnapshot(activeState, studySettings));
  }

  let totalStudyTimeMs = 0;
  let totalDistractingTimeMs = 0;
  let totalDoomscrollMs = 0;
  let deepDiveCount = 0;
  let totalSessions = 0;
  let totalSwitches = 0;
  const siteMap = new Map();
  const distractionMap = new Map();
  const doomscrollMap = new Map();
  const recentSessions = [];

  for (const session of sourceSessions) {
    totalSessions += 1;
    totalStudyTimeMs += Math.max(0, Number(session.activeStudyTimeMs) || 0);
    totalDistractingTimeMs += Math.max(0, Number(session.distractionTimeMs) || 0);
    totalDoomscrollMs += Math.max(0, Number(session.doomscrollTimeMs) || 0);
    deepDiveCount += Math.max(0, Number(session.deepDiveCount) || 0);
    totalSwitches += Math.max(0, Number(session.totalSwitches) || 0);

    const sites = Array.isArray(session.sites) ? session.sites : [];
    for (const site of sites) {
      const siteIsDistracting = classifyStudyVisit(
        site.domain,
        site.lastUrl || null,
        studySettings
      ).isDistracting;
      const current = siteMap.get(site.domain) || {
        domain: site.domain,
        durationMs: 0,
        visits: 0,
        sessions: 0,
        isDistracting: siteIsDistracting,
        doomscrollMs: 0,
      };
      current.durationMs += Math.max(0, Number(site.durationMs) || 0);
      current.visits += Math.max(0, Number(site.visits) || 0);
      current.sessions += 1;
      current.isDistracting = current.isDistracting || siteIsDistracting;
      current.doomscrollMs += Math.max(0, Number(site.doomscrollMs) || 0);
      siteMap.set(site.domain, current);

      if (siteIsDistracting) {
        distractionMap.set(site.domain, (distractionMap.get(site.domain) || 0) + (Number(site.durationMs) || 0));
      }
    }

    const doomscrollSurfaces = Array.isArray(session.doomscrollSurfaces) ? session.doomscrollSurfaces : [];
    for (const surface of doomscrollSurfaces) {
      doomscrollMap.set(
        surface.label,
        (doomscrollMap.get(surface.label) || 0) + Math.max(0, Number(surface.durationMs) || 0)
      );
    }

    recentSessions.push({
      startTime: session.startTime,
      endTime: session.endTime,
      durationMs: Math.max(0, Number(session.activeStudyTimeMs) || 0),
      durationText: formatDuration(Math.max(0, Number(session.activeStudyTimeMs) || 0)),
      uniqueSites: Math.max(0, Number(session.uniqueSites) || 0),
      distractingTimeText: formatDuration(Math.max(0, Number(session.distractionTimeMs) || 0)),
      doomscrollTimeText: formatDuration(Math.max(0, Number(session.doomscrollTimeMs) || 0)),
    });
  }

  const focusTimeMs = Math.max(0, totalStudyTimeMs - totalDistractingTimeMs);
  const focusRatio = totalStudyTimeMs > 0 ? Math.round((focusTimeMs / totalStudyTimeMs) * 100) : 0;
  const topStudySites = [...siteMap.values()]
    .filter((site) => !site.isDistracting)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10)
    .map((site) => ({
      ...site,
      durationText: formatDuration(site.durationMs),
    }));

  const distractingSites = [...distractionMap.entries()]
    .map(([domain, durationMs]) => ({
      domain,
      durationMs,
      durationText: formatDuration(durationMs),
    }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5);

  const doomscrollSurfaces = [...doomscrollMap.entries()]
    .map(([label, durationMs]) => ({
      label,
      durationMs,
      durationText: formatDuration(durationMs),
    }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5);

  recentSessions.sort((a, b) => b.startTime - a.startTime);

  return {
    totalSessions,
    totalStudyTimeMs,
    totalStudyTimeText: formatDuration(totalStudyTimeMs),
    totalDistractingTimeMs,
    totalDistractingTimeText: formatDuration(totalDistractingTimeMs),
    totalDoomscrollTimeMs: totalDoomscrollMs,
    totalDoomscrollTimeText: formatDuration(totalDoomscrollMs),
    deepDiveCount,
    focusRatio,
    focusTimeText: formatDuration(focusTimeMs),
    totalSwitches,
    topStudySites,
    distractingSites,
    doomscrollSurfaces,
    recentSessions: recentSessions.slice(0, 5),
  };
}

function bucketRevisitInterval(diffMs) {
  if (diffMs < 30 * 1000) {
    return "0-30s";
  }
  if (diffMs < 60 * 1000) {
    return "30-60s";
  }
  if (diffMs < 3 * 60 * 1000) {
    return "1-3m";
  }
  if (diffMs < 10 * 60 * 1000) {
    return "3-10m";
  }
  return "10m+";
}

function getBehavioralAnalyticsFromTabEvents(tabEvents, bounceThreshold = 5) {
  const revisitByDomain = new Map();
  const domainVisits = new Map();
  const lastSeenByDomain = new Map();
  const transitionMap = new Map();
  const switchingBuckets = new Array(144).fill(0);
  const hourDomainCounts = new Map();
  const loopHours = new Array(24).fill(0);
  let bypassAttempts = 0;

  const streakLengths = [];
  let currentStreakLength = 0;
  let currentStreakDomains = new Set();

  for (let i = 0; i < tabEvents.length; i += 1) {
    const event = tabEvents[i];
    const domain = event.domain;
    const timestamp = Number(event.timestamp) || 0;
    if (event.reason === "bypass_attempt") {
      bypassAttempts += 1;
    }
    domainVisits.set(domain, (domainVisits.get(domain) || 0) + 1);

    const hour = Number.isInteger(event.hour) ? event.hour : new Date(timestamp).getHours();
    const minute = new Date(timestamp).getMinutes();
    const tenBucket = hour * 6 + Math.floor(minute / 10);
    if (tenBucket >= 0 && tenBucket < 144) {
      switchingBuckets[tenBucket] += 1;
    }

    if (!hourDomainCounts.has(domain)) {
      hourDomainCounts.set(domain, new Array(24).fill(0));
    }
    hourDomainCounts.get(domain)[hour] += 1;

    const prevSeen = lastSeenByDomain.get(domain);
    if (typeof prevSeen === "number" && timestamp > prevSeen) {
      const bucket = bucketRevisitInterval(timestamp - prevSeen);
      if (!revisitByDomain.has(domain)) {
        revisitByDomain.set(domain, {
          "0-30s": 0,
          "30-60s": 0,
          "1-3m": 0,
          "3-10m": 0,
          "10m+": 0,
        });
      }
      revisitByDomain.get(domain)[bucket] += 1;
    }
    lastSeenByDomain.set(domain, timestamp);

    if (i > 0) {
      const prev = tabEvents[i - 1];
      if (prev.domain !== domain) {
        const gap = timestamp - prev.timestamp;
        const pairKey = `${prev.domain} -> ${domain}`;
        const current = transitionMap.get(pairKey) || {
          from: prev.domain,
          to: domain,
          count: 0,
          totalGapMs: 0,
        };
        current.count += 1;
        current.totalGapMs += Math.max(0, gap);
        transitionMap.set(pairKey, current);

        if (gap < RAPID_GAP_MS) {
          const reactiveHour = new Date(timestamp).getHours();
          if (reactiveHour >= 0 && reactiveHour < 24) {
            loopHours[reactiveHour] += 1;
          }
          if (currentStreakLength === 0) {
            currentStreakLength = 1;
            currentStreakDomains = new Set([prev.domain, domain]);
          } else {
            currentStreakDomains.add(domain);
            currentStreakDomains.add(prev.domain);
            if (currentStreakDomains.size <= 3) {
              currentStreakLength += 1;
            } else {
              if (currentStreakLength >= 2) {
                streakLengths.push(currentStreakLength);
              }
              currentStreakLength = 1;
              currentStreakDomains = new Set([prev.domain, domain]);
            }
          }
        } else {
          if (currentStreakLength >= 2) {
            streakLengths.push(currentStreakLength);
          }
          currentStreakLength = 0;
          currentStreakDomains = new Set();
        }
      }
    }
  }

  if (currentStreakLength >= 2) {
    streakLengths.push(currentStreakLength);
  }

  const topVisitedDomains = [...domainVisits.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);

  const revisitDistributionTop3 = topVisitedDomains.slice(0, 3).map((item) => ({
    domain: item.domain,
    visits: item.count,
    buckets: revisitByDomain.get(item.domain) || {
      "0-30s": 0,
      "30-60s": 0,
      "1-3m": 0,
      "3-10m": 0,
      "10m+": 0,
    },
  }));

  const topBouncePairs = [...transitionMap.values()]
    .map((pair) => ({
      ...pair,
      averageGapMs: pair.count > 0 ? Math.floor(pair.totalGapMs / pair.count) : 0,
      averageGapText: formatDuration(pair.count > 0 ? Math.floor(pair.totalGapMs / pair.count) : 0),
      highlight: pair.count >= bounceThreshold && pair.count > 0 && pair.totalGapMs / pair.count < RAPID_GAP_MS,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const switchingTimeline = switchingBuckets.map((count, index) => {
    const hour = Math.floor(index / 6);
    const minute = (index % 6) * 10;
    const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return { index, label, count };
  });

  const streakCount = streakLengths.length;
  const maxStreakLength = streakCount > 0 ? Math.max(...streakLengths) : 0;
  const averageStreakLength =
    streakCount > 0
      ? Number((streakLengths.reduce((sum, value) => sum + value, 0) / streakCount).toFixed(2))
      : 0;

  const streakHistogramMap = new Map();
  for (const length of streakLengths) {
    const key = length >= 6 ? "6+" : String(length);
    streakHistogramMap.set(key, (streakHistogramMap.get(key) || 0) + 1);
  }
  const streakHistogram = ["1", "2", "3", "4", "5", "6+"].map((label) => ({
    label,
    count: streakHistogramMap.get(label) || 0,
  }));

  const heatmapDomains = topVisitedDomains.slice(0, 5).map((item) => item.domain);
  const heatmap = heatmapDomains.map((domain) => ({
    domain,
    hourlyCounts: hourDomainCounts.get(domain) || new Array(24).fill(0),
  }));

  let mostReactiveHour = null;
  let maxLoopCount = 0;
  for (let hour = 0; hour < loopHours.length; hour += 1) {
    if (loopHours[hour] > maxLoopCount) {
      maxLoopCount = loopHours[hour];
      mostReactiveHour = hour;
    }
  }

  return {
    totalEvents: tabEvents.length,
    revisitDistributionTop3,
    topBouncePairs,
    switchingTimeline,
    rapidLoops: {
      streakCount,
      maxStreakLength,
      averageStreakLength,
      histogram: streakHistogram,
    },
    heatmap,
    loopHours,
    mostReactiveHour,
    bypassAttempts,
  };
}

async function getBehavioralAnalytics(period, bounceThreshold = 5) {
  const bounds = getPeriodBounds(period);
  const cacheKey = `${period}:${bounds.start}:${bounceThreshold}`;
  if (analyticsCache.has(cacheKey)) {
    return analyticsCache.get(cacheKey);
  }

  const tabEvents = await getTabEventsInRange(bounds.start, bounds.end);
  const data = getBehavioralAnalyticsFromTabEvents(tabEvents, bounceThreshold);
  analyticsCache.set(cacheKey, data);
  return data;
}

async function getLoopPromptSummary(nowMs = Date.now()) {
  const todayBounds = getPeriodBounds("daily");
  const sevenDayStart = nowMs - 7 * 24 * 60 * 60 * 1000;
  const [todayPrompts, weekPrompts] = await Promise.all([
    getLoopPromptsInRange(todayBounds.start, todayBounds.end),
    getLoopPromptsInRange(sevenDayStart, nowMs),
  ]);

  const domainCounts = new Map();
  const actionCounts = new Map();

  for (const prompt of weekPrompts) {
    const domains = Array.isArray(prompt.domains) ? prompt.domains : [];
    for (const domain of domains) {
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    }
    const action = prompt.action || "dismiss";
    actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
  }

  const topDomains = [...domainCounts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const mostSelectedAction =
    [...actionCounts.entries()]
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)[0] || null;

  return {
    todayCount: todayPrompts.length,
    topDomains,
    mostSelectedAction,
  };
}

function buildInsightLine(title, detail, tone = "neutral") {
  return { title, detail, tone };
}

function getPeriodLabel(period) {
  if (period === "daily") {
    return "today";
  }
  if (period === "weekly") {
    return "this week";
  }
  return "this month";
}

function formatHourLabel(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return "unknown";
  }
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00 ${suffix}`;
}

function getFragmentationMetrics(sessions, behavioral, studyMode) {
  const fragmentThresholdMs = 2 * 60 * 1000;
  const sortedSessions = [...sessions].sort((a, b) => a.startTime - b.startTime);
  let fragmentCount = 0;
  const totalSessionMs = sortedSessions.reduce(
    (sum, session) => sum + Math.max(0, Number(session.durationMs) || 0),
    0
  );
  const totalHours = totalSessionMs > 0 ? totalSessionMs / ONE_HOUR_MS : 0;

  for (let i = 0; i < sortedSessions.length - 1; i += 1) {
    const current = sortedSessions[i];
    const next = sortedSessions[i + 1];
    if (
      current.domain &&
      next.domain &&
      current.domain !== next.domain &&
      Number(current.durationMs) > 0 &&
      Number(current.durationMs) < fragmentThresholdMs
    ) {
      fragmentCount += 1;
    }
  }

  return {
    fragmentCount,
    focusFragmentIndex:
      totalHours > 0 ? Number((fragmentCount / totalHours).toFixed(2)) : fragmentCount,
    deepDiveCount: Number(studyMode?.deepDiveCount) || 0,
    mostReactiveHour: behavioral?.mostReactiveHour ?? null,
    mostReactiveHourLabel: formatHourLabel(behavioral?.mostReactiveHour ?? null),
  };
}

function getSystemHealth(sessions, fragmentation, studyMode) {
  let productiveMs = 0;
  for (const session of sessions) {
    const productive =
      session.productivityHint === "productive" || isProductiveDomain(session.domain);
    if (productive) {
      productiveMs += Math.max(0, Number(session.durationMs) || 0);
    }
  }

  return {
    uptimeMs: productiveMs,
    uptimeText: formatDuration(productiveMs),
    crashes: Number(studyMode?.deepDiveCount) || 0,
    jitter: Number(fragmentation?.focusFragmentIndex) || 0,
  };
}

function getLongestNonProductiveSession(sessions) {
  let longest = null;

  for (const session of sessions) {
    const productive =
      session.productivityHint === "productive" || isProductiveDomain(session.domain);
    const durationMs = Math.max(0, Number(session.durationMs) || 0);
    if (productive || durationMs <= 0) {
      continue;
    }

    if (!longest || durationMs > longest.durationMs) {
      longest = {
        domain: session.domain || "unknown",
        durationMs,
        durationText: formatDuration(durationMs),
      };
    }
  }

  return longest;
}

function getYesterdayBounds() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 1);
  return { start: start.getTime(), end: end.getTime() };
}

function getNextDailyReportTime() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(REPORT_HOUR, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

async function sendDailySystemReport() {
  const bounds = getYesterdayBounds();
  const [sessions, studySessions, studySettings, tabEvents] = await Promise.all([
    getSessionsInRange(bounds.start, bounds.end),
    getStudySessionsInRange(bounds.start, bounds.end),
    getStudySettings(),
    getTabEventsInRange(bounds.start, bounds.end),
  ]);
  const studyMode = getStudyModeAnalytics(studySessions, null, bounds, studySettings);
  const behavioral = getBehavioralAnalyticsFromTabEvents(tabEvents, 5);
  const fragmentation = getFragmentationMetrics(sessions, behavioral, studyMode);
  const health = getSystemHealth(sessions, fragmentation, studyMode);

  sendUsageAlert(
    "Daily System Report",
    `Yesterday: Uptime ${health.uptimeText}, Crashes ${health.crashes}.`
  );
}

function getInsights({ period, topSites, totalTimeMs, studyMode, thoughtPause, behavioral, fragmentation }) {
  const periodLabel = getPeriodLabel(period);
  const lines = [];
  const topOverall = topSites?.[0] || null;
  const topDistraction = studyMode?.distractingSites?.[0] || null;
  const topDoomscroll = studyMode?.doomscrollSurfaces?.[0] || null;
  const topBouncePair = behavioral?.topBouncePairs?.[0] || null;
  const totalPauses = Number(thoughtPause?.totalPauses) || 0;
  const focusRatio = Number(studyMode?.focusRatio) || 0;
  const distractingMs = Number(studyMode?.totalDistractingTimeMs) || 0;
  const studyMs = Number(studyMode?.totalStudyTimeMs) || 0;
  const doomscrollMs = Number(studyMode?.totalDoomscrollTimeMs) || 0;

  if (studyMs > 0) {
    lines.push(
      buildInsightLine(
        "Study time",
        `You spent ${studyMode.totalStudyTimeText} in Study Mode ${periodLabel}.`,
        studyMs >= 2 * 60 * 60 * 1000 ? "positive" : "neutral"
      )
    );

    lines.push(
      buildInsightLine(
        "Study leakage",
        distractingMs > 0
          ? `${studyMode.totalDistractingTimeText} of that study time went to distracting sites, leaving a focus ratio of ${focusRatio}%.`
          : `No distracting-site time was recorded during Study Mode ${periodLabel}.`,
        distractingMs > 0 && focusRatio < 75 ? "warning" : "positive"
      )
    );
  } else {
    lines.push(
      buildInsightLine(
        "Study time",
        `No Study Mode sessions were recorded ${periodLabel}, so you do not yet have a clean measure of focused work.`,
        "warning"
      )
    );
  }

  if (topDistraction) {
    lines.push(
      buildInsightLine(
        "Main distraction",
        `${topDistraction.domain} took the most distracting study time at ${topDistraction.durationText}.`,
        "warning"
      )
    );
  } else if (topOverall) {
    lines.push(
      buildInsightLine(
        "Main time sink",
        `${topOverall.domain} was your biggest overall site by time at ${topOverall.durationText}.`,
        "neutral"
      )
    );
  }

  if (doomscrollMs > 0 && topDoomscroll) {
    lines.push(
      buildInsightLine(
        "Doomscrolling",
        `You spent ${studyMode.totalDoomscrollTimeText} on short-form or scroll-heavy surfaces, mostly on ${topDoomscroll.label}.`,
        "warning"
      )
    );
  }

  if (topBouncePair && topBouncePair.count >= 2) {
    lines.push(
      buildInsightLine(
        "Switching pattern",
        `Your strongest bounce pattern ${periodLabel} was ${topBouncePair.from} -> ${topBouncePair.to}, repeated ${topBouncePair.count} times with an average gap of ${topBouncePair.averageGapText}.`,
        topBouncePair.highlight ? "warning" : "neutral"
      )
    );
  }

  if ((behavioral?.rapidLoops?.streakCount || 0) > 0) {
    lines.push(
      buildInsightLine(
        "Reactive browsing",
        `You had ${behavioral.rapidLoops.streakCount} rapid loop sessions ${periodLabel}; the longest loop was ${behavioral.rapidLoops.maxStreakLength} switches.`,
        behavioral.rapidLoops.maxStreakLength >= 4 ? "warning" : "neutral"
      )
    );
  }

  if (totalPauses > 0) {
    const topPauseSite = thoughtPause?.topTriggerSites?.[0];
    lines.push(
      buildInsightLine(
        "Awareness prompts",
        topPauseSite
          ? `Thought Pause triggered ${totalPauses} times ${periodLabel}, most often on ${topPauseSite.domain}.`
          : `Thought Pause triggered ${totalPauses} times ${periodLabel}.`,
        "neutral"
      )
    );
  }

  if (totalTimeMs > 0 && studyMs > 0) {
    const studyShare = Math.round((studyMs / totalTimeMs) * 100);
    lines.push(
      buildInsightLine(
        "Intentional vs general browsing",
        `${studyShare}% of your tracked browser time ${periodLabel} happened inside Study Mode.`,
        studyShare >= 50 ? "positive" : "warning"
      )
    );
  }

  if (fragmentation) {
    const reactiveHourText =
      fragmentation.mostReactiveHour !== null
        ? fragmentation.mostReactiveHourLabel
        : "not clear yet";
    lines.unshift(
      buildInsightLine(
        "Fragmentation summary",
        `${period === "daily" ? "Today" : "During this period"}, your focus was fragmented into ${fragmentation.fragmentCount} pieces. You fell into ${fragmentation.deepDiveCount} Deep Dives. Your most reactive hour was ${reactiveHourText}.`,
        fragmentation.fragmentCount > 0 || fragmentation.deepDiveCount > 0 ? "warning" : "positive"
      )
    );
  }

  return lines.slice(0, 6);
}

async function getStats(period) {
  const bounds = getPeriodBounds(period);
  const [sessions, pauses, studySessions, activeStudyState, studySettings, behavioral] = await Promise.all([
    getSessionsInRange(bounds.start, bounds.end),
    getThoughtPausesInRange(bounds.start, bounds.end),
    getStudySessionsInRange(bounds.start, bounds.end),
    getStudyModeState(),
    getStudySettings(),
    getBehavioralAnalytics(period, 5),
  ]);

  const domainTotals = new Map();
  let totalTimeMs = 0;

  for (const session of sessions) {
    const value = typeof session.durationMs === "number" ? session.durationMs : 0;
    totalTimeMs += value;
    const previous = domainTotals.get(session.domain) || 0;
    domainTotals.set(session.domain, previous + value);
  }

  const topSites = getTopSitesFromSessions(sessions);
  const maxWebsite = topSites.length > 0 ? topSites[0] : null;

  const dayBounds = getPeriodBounds("daily");
  const weekBounds = getPeriodBounds("weekly");
  const [todayPauses, weekPauses] = await Promise.all([
    getThoughtPausesInRange(dayBounds.start, dayBounds.end),
    getThoughtPausesInRange(weekBounds.start, weekBounds.end),
  ]);
  const loopPrompts = await getLoopPromptSummary();
  const studyMode = getStudyModeAnalytics(studySessions, activeStudyState, bounds, studySettings);
  const fragmentation = getFragmentationMetrics(sessions, behavioral, studyMode);
  const thoughtPause = {
    ...getThoughtPauseAnalytics(pauses, sessions),
    todayCount: todayPauses.length,
    weekCount: weekPauses.length,
  };
  const studyStatus = activeStudyState.active
    ? {
        active: true,
        currentDomain: activeStudyState.currentDomain,
        startedAt: activeStudyState.startedAt,
        currentSession: getStudyModeSnapshot(activeStudyState, studySettings),
      }
    : {
        active: false,
        currentDomain: null,
        startedAt: null,
        currentSession: null,
      };
  const systemHealth = getSystemHealth(sessions, fragmentation, studyMode);
  const longestNonProductiveSession = getLongestNonProductiveSession(sessions);

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
    thoughtPause,
    studyMode,
    studyStatus,
    fragmentation,
    systemHealth,
    longestNonProductiveSession,
    insights: getInsights({ period, topSites, totalTimeMs, studyMode, thoughtPause, behavioral, fragmentation }),
    loopPrompts,
  };
}

async function clearData(period) {
  if (period === "all") {
    await clearAllSessions();
    await clearAllThoughtPauses();
    await clearAllTabEvents();
    await clearAllLoopPrompts();
    await clearAllStudySessions();
    await clearActiveSession();
    await clearStudyModeState();
    await chrome.storage.local.remove(ALERT_STATE_KEY);
    await chrome.storage.local.remove(THOUGHT_PAUSE_STATE_KEY);
    await chrome.storage.local.remove(TAB_EVENT_STATE_KEY);
    await chrome.storage.local.remove(LOOP_STATE_KEY);
    await chrome.storage.local.remove(ACTIVITY_STATE_KEY);
    loopSwitchQueue.length = 0;
    analyticsCache.clear();
    return;
  }

  const bounds = getPeriodBounds(period);
  await deleteSessionsInRange(bounds.start, bounds.end);
  await deleteThoughtPausesInRange(bounds.start, bounds.end);
  await deleteTabEventsInRange(bounds.start, bounds.end);
  await deleteLoopPromptsInRange(bounds.start, bounds.end);
  await deleteStudySessionsInRange(bounds.start, bounds.end);
  analyticsCache.clear();
}

async function initializeAlarmsAndState() {
  chrome.idle.setDetectionInterval(IDLE_DETECTION_SECONDS);

  await chrome.alarms.create(HEARTBEAT_ALARM, {
    periodInMinutes: HEARTBEAT_MINUTES,
  });

  await chrome.alarms.create(RETENTION_ALARM, {
    periodInMinutes: ONE_DAY_MINUTES,
  });

  await chrome.alarms.create(DAILY_REPORT_ALARM, {
    when: getNextDailyReportTime(),
    periodInMinutes: ONE_DAY_MINUTES,
  });

  await pruneOldSessions();
  await recoverActiveSessionOnStartup();
}

initializeAlarmsAndState().catch(() => {});

chrome.runtime.onInstalled.addListener(async () => {
  await initializeAlarmsAndState();
  await syncTrackingFromActiveTab("install");
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeAlarmsAndState();
  await syncTrackingFromActiveTab("startup");
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === RETENTION_ALARM) {
    await pruneOldSessions();
    return;
  }

  if (alarm.name === DAILY_REPORT_ALARM) {
    await sendDailySystemReport();
    return;
  }

  if (alarm.name !== HEARTBEAT_ALARM) {
    return;
  }

  await expireTrackingWithoutHeartbeat();
  await syncTrackingFromActiveTab("heartbeat");
});

chrome.tabs.onActivated.addListener(async () => {
  const tab = await getCurrentActiveTab();
  const domain = normalizeDomain(tab?.url);
  await maybePromptRapidSwitch(domain, tab?.url || null);
  await syncTrackingFromActiveTab("tabActivated");
  await maybeShowStudyAlert(tab, domain, tab?.url || null);
  await syncDeepDiveTimer(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    await syncDeepDiveTimer(tab);
  }

  if (changeInfo.status !== "complete") {
    return;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab && activeTab.id === tabId) {
    await syncTrackingFromActiveTab("tabUpdated");
    await maybeShowStudyAlert(tab, normalizeDomain(tab?.url), tab?.url || null);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearDeepDiveTimer(tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    const state = await getActivityState();
    await setActivityState({
      ...state,
      chromeFocused: false,
      waitingForInteraction: true,
    });
    await pauseActiveTracking("windowBlur");
    return;
  }

  const state = await getActivityState();
  await setActivityState({
    ...state,
    chromeFocused: true,
    waitingForInteraction: true,
  });
  await pauseActiveTracking("windowFocusWait");
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === "active") {
    const state = await getActivityState();
    await setActivityState({
      ...state,
      idleState: "active",
      waitingForInteraction: true,
    });
    return;
  }
  const state = await getActivityState();
  await setActivityState({
    ...state,
    idleState: newState,
    waitingForInteraction: true,
  });
  await pauseActiveTracking(`idle:${newState}`);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  if (message.type === "USER_HEARTBEAT") {
    (async () => {
      const activeTab = await getCurrentActiveTab();
      if (!activeTab || !sender?.tab?.id || activeTab.id !== sender.tab.id) {
        return { accepted: false };
      }

      const now = Date.now();
      const state = await getActivityState();
      const nextState = {
        ...state,
        chromeFocused: true,
        idleState: "active",
        waitingForInteraction: false,
        lastHeartbeatAt: now,
        lastHeartbeatTabId: sender.tab.id,
        lastHeartbeatWindowId: Number.isInteger(sender.tab.windowId) ? sender.tab.windowId : null,
      };
      await setActivityState(nextState);
      await syncTrackingFromActiveTab("interactionHeartbeat");
      return { accepted: true };
    })()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_TRACKING_STATUS") {
    Promise.all([getActiveSession(), getStudyModeState(), getStudySettings(), getCurrentActiveTab()])
      .then(([active, studyMode, studySettings, tab]) =>
        sendResponse({
          ok: true,
          data: {
            tracking: true,
            domain: active?.domain || null,
            studyMode: studyMode.active
              ? {
                  active: true,
                  startedAt: studyMode.startedAt,
                  currentDomain: studyMode.currentDomain,
                  session: getStudyModeSnapshot(studyMode, studySettings),
                }
              : {
                  active: false,
                  startedAt: null,
                  currentDomain: null,
                  session: null,
                },
            activeTab: {
              domain: normalizeDomain(tab?.url) || null,
              url: tab?.url || null,
            },
          },
        })
      )
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "START_STUDY_MODE") {
    startStudyMode()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "STOP_STUDY_MODE") {
    stopStudyMode()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "MARK_CURRENT_SITE_DISTRACTING") {
    getCurrentActiveTab()
      .then((tab) => addCurrentSiteToDistractingList(tab?.url || null))
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "STORE_THOUGHT_PAUSE_RESPONSE") {
    const payload = message.payload || {};
    const timestamp = Date.now();
    addThoughtPause({
      timestamp,
      dateKey: getDayKeyFromMs(timestamp),
      domain: typeof payload.domain === "string" ? payload.domain : "unknown",
      url: typeof payload.url === "string" ? payload.url : null,
      triggerType: typeof payload.triggerType === "string" ? payload.triggerType : "manual_continue",
      choice: typeof payload.choice === "string" ? payload.choice : null,
      note: typeof payload.note === "string" ? payload.note.slice(0, 280) : "",
      action: typeof payload.action === "string" ? payload.action : "continue",
    })
      .then(() => sendResponse({ ok: true, data: { stored: true } }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "LOG_BYPASS_ATTEMPT") {
    getCurrentActiveTab()
      .then((tab) => {
        const domain = normalizeDomain(tab?.url) || "unknown";
        const now = Date.now();
        return addTabEvent({
          timestamp: now,
          dateKey: getDayKeyFromMs(now),
          domain,
          prevDomain: null,
          url: tab?.url || null,
          hour: new Date(now).getHours(),
          minuteBucket: Math.floor(now / 60000),
          isTracked: true,
          reason: "bypass_attempt",
        });
      })
      .then(() => sendResponse({ ok: true, data: { logged: true } }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "PROCESS_YOUTUBE_METADATA") {
    const payload = message.payload || {};
    const url = typeof payload.url === "string" ? payload.url : null;
    const domain = normalizeDomain(url);
    const matchedKeywords = Array.isArray(payload.matchedKeywords)
      ? payload.matchedKeywords.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const allowKeywords = Array.isArray(payload.allowKeywords)
      ? payload.allowKeywords.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const blockKeywords = Array.isArray(payload.blockKeywords)
      ? payload.blockKeywords.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const title = typeof payload.title === "string" ? payload.title : "";

    Promise.resolve()
      .then(async () => {
        if (!domain || domain !== "youtube.com") {
          return { classification: "ignored" };
        }

        if (url && isDeepDiveUrl(url)) {
          const activeTab = await getCurrentActiveTab();
          await syncDeepDiveTimer(activeTab);
        }

        if (blockKeywords.length > 0) {
          await maybePromptThoughtPause({
            triggerType: "youtube_blocked_title",
            domain,
            url,
            force: true,
          });
          return { classification: "blocked", blockKeywords };
        }

        if (allowKeywords.length > 0) {
          await markCurrentSessionProductive({
            title,
            keywords: allowKeywords,
          });
          return { classification: "productive_title", matchedKeywords: allowKeywords };
        }

        if (matchedKeywords.length > 0) {
          await markCurrentSessionProductive({
            title,
            keywords: matchedKeywords,
          });
          return { classification: "productive", matchedKeywords };
        }

        await maybePromptThoughtPause({
          triggerType: "youtube_non_educational",
          domain,
          url,
          force: true,
        });
        return { classification: "non_productive" };
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_THOUGHT_PAUSE_SETTINGS") {
    getThoughtPauseSettings()
      .then((settings) => sendResponse({ ok: true, data: settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_BEHAVIORAL_ANALYTICS") {
    const period = message.period || "daily";
    const bounceThreshold = Math.max(1, Number(message.bounceThreshold) || 5);
    getBehavioralAnalytics(period, bounceThreshold)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "SAVE_THOUGHT_PAUSE_SETTINGS") {
    setThoughtPauseSettings(message.settings)
      .then((settings) => sendResponse({ ok: true, data: settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RESET_THOUGHT_PAUSE_SETTINGS") {
    setThoughtPauseSettings(DEFAULT_THOUGHT_PAUSE_SETTINGS)
      .then((settings) => sendResponse({ ok: true, data: settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_LOOP_SETTINGS") {
    getLoopSettings()
      .then((settings) => sendResponse({ ok: true, data: settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_STUDY_SETTINGS") {
    getStudySettings()
      .then((settings) => sendResponse({ ok: true, data: settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "SAVE_LOOP_SETTINGS") {
    setLoopSettings(message.settings)
      .then((settings) => sendResponse({ ok: true, data: settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "SAVE_STUDY_SETTINGS") {
    setStudySettings(message.settings)
      .then((settings) => sendResponse({ ok: true, data: settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RESET_LOOP_SETTINGS") {
    setLoopSettings(DEFAULT_LOOP_SETTINGS)
      .then((settings) => sendResponse({ ok: true, data: settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RESET_STUDY_SETTINGS") {
    setStudySettings(DEFAULT_STUDY_SETTINGS)
      .then((settings) => sendResponse({ ok: true, data: settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  sendResponse({ ok: false, error: "Unsupported message type" });
});
