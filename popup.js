const trackingStatusEl = document.getElementById("tracking-status");
const activeDomainEl = document.getElementById("active-domain");
const openDashboardBtn = document.getElementById("open-dashboard");

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

async function loadStatus() {
  try {
    const data = await sendMessage({ type: "GET_TRACKING_STATUS" });
    trackingStatusEl.textContent = data.tracking ? "Tracking is active." : "Tracking is paused.";
    activeDomainEl.textContent = `Current site: ${data.domain || "-"}`;
  } catch {
    trackingStatusEl.textContent = "Tracking status unavailable.";
    activeDomainEl.textContent = "Current site: -";
  }
}

openDashboardBtn.addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  window.close();
});

document.addEventListener("DOMContentLoaded", loadStatus);
