const els = {
  enabled: document.getElementById("enabled"),
  strictMode: document.getElementById("strict-mode"),
  allowNote: document.getElementById("allow-note"),
  targetAll: document.getElementById("target-all"),
  targetList: document.getElementById("target-list"),
  domains: document.getElementById("domains"),
  triggerFirstVisit: document.getElementById("trigger-first-visit"),
  triggerContinuous: document.getElementById("trigger-continuous"),
  triggerRapid: document.getElementById("trigger-rapid"),
  triggerThreshold: document.getElementById("trigger-threshold"),
  continuousMinutes: document.getElementById("continuous-minutes"),
  cooldownMinutes: document.getElementById("cooldown-minutes"),
  autoDismiss: document.getElementById("auto-dismiss"),
  rapidThreshold: document.getElementById("rapid-threshold"),
  rapidWindow: document.getElementById("rapid-window"),
  rapidCooldown: document.getElementById("rapid-cooldown"),
  quietEnabled: document.getElementById("quiet-enabled"),
  quietStart: document.getElementById("quiet-start"),
  quietEnd: document.getElementById("quiet-end"),
  quickChoices: document.getElementById("quick-choices"),
  loopEnabled: document.getElementById("loop-enabled"),
  loopWindowMinutes: document.getElementById("loop-window-minutes"),
  loopMinSwitches: document.getElementById("loop-min-switches"),
  loopMaxDomains: document.getElementById("loop-max-domains"),
  loopCooldownMinutes: document.getElementById("loop-cooldown-minutes"),
  studyDistractingDomains: document.getElementById("study-distracting-domains"),
  studyDistractingPatterns: document.getElementById("study-distracting-patterns"),
  save: document.getElementById("save"),
  reset: document.getElementById("reset"),
  status: document.getElementById("status"),
};

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.style.color = isError ? "#b91c1c" : "#0f766e";
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

function renderSettings(settings, loopSettings, studySettings) {
  els.enabled.checked = settings.enabled;
  els.strictMode.checked = settings.strictMode;
  els.allowNote.checked = settings.allowNote;

  if (settings.targetMode === "all_tracked") {
    els.targetAll.checked = true;
  } else {
    els.targetList.checked = true;
  }

  els.domains.value = settings.domains.join("\n");

  els.triggerFirstVisit.checked = settings.triggers.firstVisit;
  els.triggerContinuous.checked = settings.triggers.continuousUsage;
  els.triggerRapid.checked = settings.triggers.rapidSwitch;
  els.triggerThreshold.checked = settings.triggers.threshold;

  els.continuousMinutes.value = String(settings.continuousMinutes);
  els.cooldownMinutes.value = String(settings.cooldownMinutes);
  els.autoDismiss.value = String(settings.autoDismissSeconds);
  els.rapidThreshold.value = String(settings.rapidSwitchThreshold);
  els.rapidWindow.value = String(settings.rapidSwitchWindowSeconds);
  els.rapidCooldown.value = String(settings.rapidSwitchCooldownMinutes);

  els.quietEnabled.checked = settings.quietHours.enabled;
  els.quietStart.value = String(settings.quietHours.startHour);
  els.quietEnd.value = String(settings.quietHours.endHour);

  els.quickChoices.value = settings.quickChoices.join("\n");

  els.loopEnabled.checked = loopSettings.enabled;
  els.loopWindowMinutes.value = String(loopSettings.windowMinutes);
  els.loopMinSwitches.value = String(loopSettings.minSwitches);
  els.loopMaxDomains.value = String(loopSettings.maxUniqueDomains);
  els.loopCooldownMinutes.value = String(loopSettings.cooldownMinutes);

  els.studyDistractingDomains.value = (studySettings?.distractingDomains || []).join("\n");
  els.studyDistractingPatterns.value = (studySettings?.distractingUrlPatterns || []).join("\n");
}

function collectSettings() {
  return {
    enabled: els.enabled.checked,
    strictMode: els.strictMode.checked,
    allowNote: els.allowNote.checked,
    targetMode: els.targetAll.checked ? "all_tracked" : "pause_list",
    domains: els.domains.value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
    triggers: {
      firstVisit: els.triggerFirstVisit.checked,
      continuousUsage: els.triggerContinuous.checked,
      rapidSwitch: els.triggerRapid.checked,
      threshold: els.triggerThreshold.checked,
    },
    continuousMinutes: Number(els.continuousMinutes.value) || 5,
    cooldownMinutes: Number(els.cooldownMinutes.value) || 10,
    autoDismissSeconds: Number(els.autoDismiss.value) || 10,
    rapidSwitchThreshold: Number(els.rapidThreshold.value) || 3,
    rapidSwitchWindowSeconds: Number(els.rapidWindow.value) || 60,
    rapidSwitchCooldownMinutes: Number(els.rapidCooldown.value) || 10,
    quietHours: {
      enabled: els.quietEnabled.checked,
      startHour: Number(els.quietStart.value) || 2,
      endHour: Number(els.quietEnd.value) || 7,
    },
    quickChoices: els.quickChoices.value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function collectLoopSettings() {
  return {
    enabled: els.loopEnabled.checked,
    windowMinutes: Number(els.loopWindowMinutes.value) || 4,
    minSwitches: Number(els.loopMinSwitches.value) || 9,
    maxUniqueDomains: Number(els.loopMaxDomains.value) || 3,
    cooldownMinutes: Number(els.loopCooldownMinutes.value) || 15,
  };
}

function collectStudySettings() {
  return {
    distractingDomains: els.studyDistractingDomains.value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
    distractingUrlPatterns: els.studyDistractingPatterns.value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

async function loadSettings() {
  try {
    setStatus("Loading...");
    const [data, loopData, studyData] = await Promise.all([
      sendMessage({ type: "GET_THOUGHT_PAUSE_SETTINGS" }),
      sendMessage({ type: "GET_LOOP_SETTINGS" }),
      sendMessage({ type: "GET_STUDY_SETTINGS" }),
    ]);
    renderSettings(data, loopData, studyData);
    setStatus("Loaded");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveSettings() {
  try {
    setStatus("Saving...");
    const settings = collectSettings();
    const loopSettings = collectLoopSettings();
    const studySettings = collectStudySettings();
    await Promise.all([
      sendMessage({ type: "SAVE_THOUGHT_PAUSE_SETTINGS", settings }),
      sendMessage({ type: "SAVE_LOOP_SETTINGS", settings: loopSettings }),
      sendMessage({ type: "SAVE_STUDY_SETTINGS", settings: studySettings }),
    ]);
    setStatus("Saved");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function resetToDefaults() {
  try {
    if (!window.confirm("Reset Thought Pause settings to defaults?")) {
      return;
    }
    setStatus("Resetting...");
    const [data, loopData, studyData] = await Promise.all([
      sendMessage({ type: "RESET_THOUGHT_PAUSE_SETTINGS" }),
      sendMessage({ type: "RESET_LOOP_SETTINGS" }),
      sendMessage({ type: "RESET_STUDY_SETTINGS" }),
    ]);
    renderSettings(data, loopData, studyData);
    setStatus("Reset to defaults.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

els.save.addEventListener("click", saveSettings);
els.reset.addEventListener("click", resetToDefaults);
document.addEventListener("DOMContentLoaded", loadSettings);
