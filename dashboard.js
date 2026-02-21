const periodSelect = document.getElementById("period");
const totalTimeEl = document.getElementById("total-time");
const uniqueSitesEl = document.getElementById("unique-sites");
const maxSiteEl = document.getElementById("max-site");
const topSitesListEl = document.getElementById("top-sites-list");
const clearPeriodBtn = document.getElementById("clear-period");
const clearAllBtn = document.getElementById("clear-all");
const statusEl = document.getElementById("status");
const AUTO_REFRESH_MS = 5000;
let autoRefreshTimer = null;
let isLoading = false;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#0f766e";
}

function renderTopSites(topSites) {
  topSitesListEl.innerHTML = "";

  if (!topSites || topSites.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No data for this period.";
    topSitesListEl.appendChild(li);
    return;
  }

  for (const site of topSites) {
    const li = document.createElement("li");
    li.textContent = `${site.domain} - ${site.durationText}`;
    topSitesListEl.appendChild(li);
  }
}

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

async function loadStats(options = {}) {
  if (isLoading) {
    return;
  }

  const { silent = false } = options;

  try {
    isLoading = true;
    if (!silent) {
      setStatus("Loading...");
    }

    const period = periodSelect.value;
    const data = await sendMessage({ type: "GET_STATS", period });

    totalTimeEl.textContent = data.totalTimeText;
    uniqueSitesEl.textContent = String(data.uniqueWebsites);
    maxSiteEl.textContent = data.maxWebsite
      ? `${data.maxWebsite.domain} (${data.maxWebsite.durationText})`
      : "-";
    renderTopSites(data.topSites);
    if (!silent) {
      setStatus("Updated.");
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    isLoading = false;
  }
}

async function clearData(period) {
  try {
    const message =
      period === "all"
        ? "Clear all tracked data permanently?"
        : `Clear ${period} tracked data?`;

    if (!window.confirm(message)) {
      return;
    }

    setStatus("Clearing...");
    await sendMessage({ type: "CLEAR_DATA", period });
    await loadStats();
    setStatus("Data cleared.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

periodSelect.addEventListener("change", loadStats);
clearPeriodBtn.addEventListener("click", () => clearData(periodSelect.value));
clearAllBtn.addEventListener("click", () => clearData("all"));

document.addEventListener("DOMContentLoaded", async () => {
  await loadStats();
  autoRefreshTimer = setInterval(() => {
    loadStats({ silent: true });
  }, AUTO_REFRESH_MS);
});

window.addEventListener("beforeunload", () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
});
