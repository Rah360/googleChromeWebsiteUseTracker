const trackingStatusEl = document.getElementById("tracking-status");
const activeDomainEl = document.getElementById("active-domain");
const studyStatusEl = document.getElementById("study-status");
const studyMetaEl = document.getElementById("study-meta");
const toggleStudyModeBtn = document.getElementById("toggle-study-mode");
const playStatusEl = document.getElementById("play-status");
const playMetaEl = document.getElementById("play-meta");
const togglePlayModeBtn = document.getElementById("toggle-play-mode");
const markDistractingBtn = document.getElementById("mark-distracting");
const markDistractingStatusEl = document.getElementById("mark-distracting-status");
const openDashboardBtn = document.getElementById("open-dashboard");
const openSettingsBtn = document.getElementById("open-settings");
let currentActiveTab = { domain: null, url: null };

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || !response.ok) {
        reject(new Error(response?.error || "Unknown error"));
        return;
      }

      resolve(response.data);
    });
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.floor((Number(ms) || 0) / 1000);
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

function renderStudyMode(studyMode) {
  if (!studyMode || !studyMode.active) {
    studyStatusEl.textContent = "Study mode is off.";
    studyMetaEl.textContent = "Study time: 0s";
    toggleStudyModeBtn.textContent = "Start Study Mode";
    toggleStudyModeBtn.dataset.mode = "start";
    return;
  }

  const session = studyMode.session || {};
  const uniqueSites = Number(session.uniqueSites) || 0;
  studyStatusEl.textContent = `Study mode is on${studyMode.currentDomain ? ` on ${studyMode.currentDomain}` : ""}.`;
  studyMetaEl.textContent = `Study time: ${formatDuration(session.activeStudyTimeMs || 0)} | Sites visited: ${uniqueSites}`;
  toggleStudyModeBtn.textContent = "Stop Study Mode";
  toggleStudyModeBtn.dataset.mode = "stop";
}

function renderPlayMode(playMode, playQuota) {
  const quota = playQuota || { remainingText: "0s", exhausted: false, message: null };
  if (quota.exhausted && (!playMode || !playMode.active)) {
    playStatusEl.textContent = quota.message || "Play Quota Exhausted. System locked in Study Mode until 4:00 AM.";
    playMetaEl.textContent = `Play time remaining: ${quota.remainingText}`;
    togglePlayModeBtn.textContent = "Play Locked";
    togglePlayModeBtn.dataset.mode = "start";
    togglePlayModeBtn.disabled = true;
    return;
  }

  togglePlayModeBtn.disabled = false;

  if (!playMode || !playMode.active) {
    playStatusEl.textContent = "Play mode is off.";
    playMetaEl.textContent = `Play time remaining: ${quota.remainingText}`;
    togglePlayModeBtn.textContent = "Start Play Mode";
    togglePlayModeBtn.dataset.mode = "start";
    return;
  }

  const session = playMode.session || {};
  const uniqueSites = Number(session.uniqueSites) || 0;
  playStatusEl.textContent = `Play mode is on${playMode.currentDomain ? ` on ${playMode.currentDomain}` : ""}.`;
  playMetaEl.textContent = `Play time: ${formatDuration(session.activePlayTimeMs || 0)} | Remaining: ${quota.remainingText} | Sites visited: ${uniqueSites}`;
  togglePlayModeBtn.textContent = "Stop Play Mode";
  togglePlayModeBtn.dataset.mode = "stop";
}

function setMarkDistractingStatus(message, isError = false) {
  markDistractingStatusEl.textContent = message;
  markDistractingStatusEl.style.color = isError ? "#b91c1c" : "#475569";
}

async function loadStatus() {
  try {
    const data = await sendMessage({ type: "GET_TRACKING_STATUS" });
    trackingStatusEl.textContent = data.tracking ? "Tracking is active." : "Tracking is paused.";
    activeDomainEl.textContent = `Current site: ${data.domain || "-"}`;
    currentActiveTab = data.activeTab || { domain: null, url: null };
    renderStudyMode(data.studyMode);
    renderPlayMode(data.playMode, data.playQuota);
    markDistractingBtn.disabled = !currentActiveTab.domain;
    setMarkDistractingStatus("");
  } catch {
    trackingStatusEl.textContent = "Tracking status unavailable.";
    activeDomainEl.textContent = "Current site: -";
    renderStudyMode({ active: false });
    renderPlayMode({ active: false }, { remainingText: "0s", exhausted: false, message: null });
    currentActiveTab = { domain: null, url: null };
    markDistractingBtn.disabled = true;
  }
}

openDashboardBtn.addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  window.close();
});

openSettingsBtn.addEventListener("click", async () => {
  await chrome.runtime.openOptionsPage();
  window.close();
});

toggleStudyModeBtn.addEventListener("click", async () => {
  const nextType =
    toggleStudyModeBtn.dataset.mode === "stop" ? "STOP_STUDY_MODE" : "START_STUDY_MODE";
  try {
    await sendMessage({ type: nextType });
    await loadStatus();
  } catch {
    studyStatusEl.textContent = "Study mode update failed.";
  }
});

togglePlayModeBtn.addEventListener("click", async () => {
  const nextType =
    togglePlayModeBtn.dataset.mode === "stop" ? "STOP_PLAY_MODE" : "START_PLAY_MODE";
  try {
    await sendMessage({ type: nextType });
    await loadStatus();
  } catch {
    playStatusEl.textContent = "Play mode update failed.";
  }
});

markDistractingBtn.addEventListener("click", async () => {
  if (!currentActiveTab.domain) {
    setMarkDistractingStatus("No trackable site is active.", true);
    return;
  }

  try {
    const data = await sendMessage({ type: "MARK_CURRENT_SITE_DISTRACTING" });
    if (data.alreadyMarked) {
      setMarkDistractingStatus(`${data.domain} is already marked as distracting.`);
      return;
    }
    if (data.pattern) {
      setMarkDistractingStatus(`Saved ${data.domain} and pattern ${data.pattern}`);
      return;
    }
    setMarkDistractingStatus(`Saved ${data.domain} as distracting.`);
  } catch (error) {
    setMarkDistractingStatus(error.message || "Unable to save.", true);
  }
});

document.addEventListener("DOMContentLoaded", loadStatus);
