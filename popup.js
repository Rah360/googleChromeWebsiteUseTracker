const trackingStatusEl = document.getElementById("tracking-status");
const activeDomainEl = document.getElementById("active-domain");
const studyStatusEl = document.getElementById("study-status");
const studyMetaEl = document.getElementById("study-meta");
const toggleStudyModeBtn = document.getElementById("toggle-study-mode");
const openDashboardBtn = document.getElementById("open-dashboard");
const openSettingsBtn = document.getElementById("open-settings");

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

async function loadStatus() {
  try {
    const data = await sendMessage({ type: "GET_TRACKING_STATUS" });
    trackingStatusEl.textContent = data.tracking ? "Tracking is active." : "Tracking is paused.";
    activeDomainEl.textContent = `Current site: ${data.domain || "-"}`;
    renderStudyMode(data.studyMode);
  } catch {
    trackingStatusEl.textContent = "Tracking status unavailable.";
    activeDomainEl.textContent = "Current site: -";
    renderStudyMode({ active: false });
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

document.addEventListener("DOMContentLoaded", loadStatus);
