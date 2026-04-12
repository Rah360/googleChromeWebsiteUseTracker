(() => {
  if (globalThis.__websiteUseTrackerContentInitialized) {
    return;
  }
  globalThis.__websiteUseTrackerContentInitialized = true;

  let activePrompt = null;
  let activePromptDraft = null;
  let activeLoopPrompt = null;
  let activeStudyAlert = null;
  let activeHardLock = null;
  let youtubeScanTimer = null;
  let lastYoutubeUrl = null;
  let youtubeTitleObserver = null;
  let lastHeartbeatSentAt = 0;
  let extensionContextAlive = true;
  const HEARTBEAT_INTERVAL_MS = 30 * 1000;
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

  function calculateEntropy(str) {
    const len = str.length;
    const freq = {};
    for (let i = 0; i < len; i += 1) {
      freq[str[i]] = (freq[str[i]] || 0) + 1;
    }
    let entropy = 0;
    for (const char in freq) {
      const p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  function isExtensionContextInvalidatedError(error) {
    const message = String(error?.message || error || "");
    return message.includes("Extension context invalidated");
  }

  function markExtensionContextInvalidated() {
    extensionContextAlive = false;
    if (youtubeScanTimer) {
      clearTimeout(youtubeScanTimer);
      youtubeScanTimer = null;
    }
    if (youtubeTitleObserver) {
      youtubeTitleObserver.disconnect();
      youtubeTitleObserver = null;
    }
  }

  function withRuntimeAccess(callback, fallback = null) {
    if (!extensionContextAlive) {
      return fallback;
    }

    try {
      const runtime = chrome.runtime;
      if (!runtime || !runtime.id) {
        return fallback;
      }
      return callback(runtime);
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        markExtensionContextInvalidated();
        return fallback;
      }
      throw error;
    }
  }

  function getContentStylesheetUrl() {
    return withRuntimeAccess((runtime) => runtime.getURL("content.css"), null);
  }

  window.addEventListener(
    "error",
    (event) => {
      if (isExtensionContextInvalidatedError(event?.error || event?.message || "")) {
        markExtensionContextInvalidated();
        event.preventDefault();
      }
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (isExtensionContextInvalidatedError(event?.reason || "")) {
        markExtensionContextInvalidated();
        event.preventDefault();
      }
    },
    true
  );

  function sendBackgroundMessage(message, timeoutMs = 500) {
    return new Promise((resolve, reject) => {
      const runtime = withRuntimeAccess((value) => value, null);
      if (!runtime) {
        reject(new Error("extension-context-unavailable"));
        return;
      }

      let settled = false;
      const timerId = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error("ack-timeout"));
      }, timeoutMs);

      try {
        runtime.sendMessage(message, (response) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timerId);

          try {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
          } catch (error) {
            if (isExtensionContextInvalidatedError(error)) {
              markExtensionContextInvalidated();
              reject(new Error("extension-context-unavailable"));
              return;
            }
            reject(error);
            return;
          }

          if (!response || !response.ok) {
            reject(new Error(response?.error || "Unknown error"));
            return;
          }

          resolve(response.data || null);
        });
      } catch (error) {
        clearTimeout(timerId);
        if (isExtensionContextInvalidatedError(error)) {
          markExtensionContextInvalidated();
          reject(new Error("extension-context-unavailable"));
          return;
        }
        reject(error);
      }
    });
  }

  function sendInteractionHeartbeat() {
    if (!extensionContextAlive) {
      return;
    }

    const now = Date.now();
    if (now - lastHeartbeatSentAt < HEARTBEAT_INTERVAL_MS) {
      return;
    }

    const runtime = withRuntimeAccess((value) => value, null);
    if (!runtime) {
      return;
    }

    try {
      lastHeartbeatSentAt = now;
      runtime.sendMessage(
        {
          type: "USER_HEARTBEAT",
          payload: {
            url: window.location.href,
          },
        },
        () => {
          try {
            if (chrome.runtime.lastError) {
              // Best-effort heartbeat only.
            }
          } catch (error) {
            if (isExtensionContextInvalidatedError(error)) {
              markExtensionContextInvalidated();
              return;
            }
            throw error;
          }
        }
      );
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        markExtensionContextInvalidated();
        return;
      }
      throw error;
    }
  }

  function removePrompt() {
    if (!activePrompt) {
      return;
    }
    if (activePrompt.noteEl) {
      activePromptDraft = {
        signature: activePrompt.signature || null,
        note: activePrompt.noteEl.value || "",
        snoozeSiteToday: Boolean(activePrompt.dontShowCheckbox?.checked),
      };
    }
    if (activePrompt.domObserver) {
      activePrompt.domObserver.disconnect();
    }
    if (activePrompt.cleanupGuards) {
      activePrompt.cleanupGuards();
    }
    if (activePrompt.timerId) {
      clearInterval(activePrompt.timerId);
    }
    if (activePrompt.timeoutId) {
      clearTimeout(activePrompt.timeoutId);
    }
    activePrompt.host.remove();
    activePrompt = null;
  }

  function getThoughtPauseSignature(payload) {
    return [
      payload?.triggerType || "",
      payload?.domain || "",
      payload?.url || "",
      payload?.reasonText || "",
    ].join("::");
  }

  function removeLoopPrompt() {
    if (!activeLoopPrompt) {
      return;
    }
    if (activeLoopPrompt.timerId) {
      clearInterval(activeLoopPrompt.timerId);
    }
    activeLoopPrompt.host.remove();
    activeLoopPrompt = null;
  }

  function removeStudyAlert() {
    if (!activeStudyAlert) {
      return;
    }
    if (activeStudyAlert.timerId) {
      clearTimeout(activeStudyAlert.timerId);
    }
    activeStudyAlert.host.remove();
    activeStudyAlert = null;
  }

  function removeHardLock() {
    if (!activeHardLock) {
      return;
    }
    if (activeHardLock.timerId) {
      clearInterval(activeHardLock.timerId);
    }
    activeHardLock.host.remove();
    activeHardLock = null;
  }

  function hasLowHonestyPattern(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) {
      return false;
    }

    if (/(.)\1{4,}/i.test(text)) {
      return true;
    }

    if (/\b([a-z0-9]{2,})\b(?:\s+\1\b)+/i.test(text)) {
      return true;
    }

    if (/^([a-z]{3,})\1+$/i.test(text.replace(/\s+/g, ""))) {
      return true;
    }

    return false;
  }

  function hasWordRepeatedMoreThanTwice(value) {
    const words = String(value || "")
      .toLowerCase()
      .match(/\b[a-z0-9']+\b/g);
    if (!words || words.length === 0) {
      return false;
    }

    const counts = new Map();
    for (const word of words) {
      const next = (counts.get(word) || 0) + 1;
      counts.set(word, next);
      if (next > 2) {
        return true;
      }
    }
    return false;
  }

  function lacksCognitiveDepth(value) {
    const text = String(value || "").trim();
    if (!text) {
      return false;
    }
    return calculateEntropy(text) < 2.5 || hasWordRepeatedMoreThanTwice(text);
  }

  function looksLikeMash(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) {
      return false;
    }

    if (hasLowHonestyPattern(text)) {
      return true;
    }

    const compact = text.replace(/\s+/g, "");
    if (/^(?:[a-z0-9]{1,3}){3,}$/i.test(compact) && !/[aeiou]/i.test(compact)) {
      return true;
    }
    if (/^([a-z0-9]{1,3})\1{2,}$/i.test(compact)) {
      return true;
    }
    return false;
  }

  function getYoutubeMetadata() {
    const titleEl =
      document.querySelector("h1.ytd-video-primary-info-renderer") ||
      document.querySelector("h1.ytd-watch-metadata") ||
      document.querySelector("yt-formatted-string.style-scope.ytd-watch-metadata");
    const title = (titleEl?.textContent || "").trim();

    const metaKeywords = document
      .querySelector('meta[name="keywords"]')
      ?.getAttribute("content") || "";
    const description =
      document.querySelector('meta[name="description"]')?.getAttribute("content") ||
      document.querySelector("#description-inline-expander")?.textContent ||
      "";

    const haystack = `${title} ${metaKeywords} ${description}`.toLowerCase();
    const matchedKeywords = EDUCATIONAL_KEYWORDS.filter((keyword) => haystack.includes(keyword));
    const titleLower = title.toLowerCase();
    const allowKeywords = TITLE_ALLOW_KEYWORDS.filter((keyword) => titleLower.includes(keyword));
    const blockKeywords = TITLE_BLOCK_KEYWORDS.filter((keyword) => titleLower.includes(keyword));

    return {
      title,
      keywords: metaKeywords
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      description: String(description).trim().slice(0, 500),
      matchedKeywords,
      allowKeywords,
      blockKeywords,
    };
  }

  async function analyzeYoutubePage() {
    const url = window.location.href;
    if (!/https?:\/\/(www\.)?youtube\.com\//i.test(url)) {
      return;
    }

    if (!url.includes("/watch") && !url.includes("/shorts/")) {
      return;
    }

    const metadata = getYoutubeMetadata();
    if (!metadata.title && !url.includes("/shorts/")) {
      return;
    }

    try {
      await sendBackgroundMessage(
        {
          type: "PROCESS_YOUTUBE_METADATA",
          payload: {
            url,
            title: metadata.title,
            keywords: metadata.keywords,
            description: metadata.description,
            matchedKeywords: metadata.matchedKeywords,
            allowKeywords: metadata.allowKeywords,
            blockKeywords: metadata.blockKeywords,
          },
        },
        1500
      );
    } catch {
      // Best-effort classification only.
    }
  }

  function scheduleYoutubeScan(force = false) {
    const currentUrl = window.location.href;
    if (!force && currentUrl === lastYoutubeUrl) {
      return;
    }

    lastYoutubeUrl = currentUrl;
    if (youtubeScanTimer) {
      clearTimeout(youtubeScanTimer);
    }
    youtubeScanTimer = setTimeout(() => {
      analyzeYoutubePage();
    }, 600);
  }

  function attachYoutubeTitleObserver() {
    if (youtubeTitleObserver) {
      youtubeTitleObserver.disconnect();
      youtubeTitleObserver = null;
    }

    const titleNode =
      document.querySelector("h1.ytd-video-primary-info-renderer") ||
      document.querySelector("h1.ytd-watch-metadata");
    if (!titleNode) {
      return;
    }

    youtubeTitleObserver = new MutationObserver(() => {
      scheduleYoutubeScan(true);
    });
    youtubeTitleObserver.observe(titleNode, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function renderPrompt(payload, resolveResponse) {
    const signature = getThoughtPauseSignature(payload);
    if (activePrompt) {
      if (activePrompt.signature === signature) {
        activePrompt.noteEl?.focus();
        return;
      }
      removePrompt();
    }

    const host = document.createElement("div");
    host.id = "thought-pause-host";
    const shadow = host.attachShadow({ mode: "open" });

    const stylesheetUrl = getContentStylesheetUrl();
    if (!stylesheetUrl) {
      return;
    }
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = stylesheetUrl;

    const overlay = document.createElement("div");
    overlay.className = "tp-overlay";

    const modal = document.createElement("section");
    modal.className = "tp-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const title = document.createElement("h2");
    title.className = "tp-title";
    title.textContent = payload.promptText || "Pause — What are you thinking right now?";

    const subtitle = document.createElement("p");
    subtitle.className = "tp-subtitle";
    subtitle.textContent = `Site: ${payload.domain || "current tab"}`;

    const reason = document.createElement("p");
    reason.className = "tp-reason";
    reason.textContent = `Why now: ${payload.reasonText || "Short awareness check-in."}`;

    const noteLabel = document.createElement("label");
    noteLabel.className = "tp-note-label";
    noteLabel.htmlFor = "pauseReason";
    noteLabel.textContent = "Why is this visit intentional?";

    const note = document.createElement("textarea");
    note.id = "pauseReason";
    note.className = "tp-note";
    note.placeholder = "Type at least 15 characters before continuing.";
    note.maxLength = 280;

    const noteError = document.createElement("p");
    noteError.className = "tp-error";
    noteError.hidden = true;
    noteError.textContent = "Justification lacks cognitive depth. Try being honest.";
    const slowModeSeconds = Math.max(0, Number(payload.slowModeSeconds) || 0);
    let slowModeDone = slowModeSeconds <= 0;

    const suppressModalTextareaShortcuts = (event) => {
      event.stopPropagation();
      event.stopImmediatePropagation();

      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "s";
      if (isSaveShortcut) {
        event.preventDefault();
      }
    };

    const dontShowWrap = document.createElement("label");
    dontShowWrap.className = "tp-dont-show";
    const dontShowCheckbox = document.createElement("input");
    dontShowCheckbox.type = "checkbox";
    const dontShowText = document.createElement("span");
    dontShowText.textContent = "Don't show again for this site today";
    dontShowWrap.appendChild(dontShowCheckbox);
    dontShowWrap.appendChild(dontShowText);

    if (activePromptDraft?.signature === signature) {
      note.value = activePromptDraft.note || "";
      dontShowCheckbox.checked = Boolean(activePromptDraft.snoozeSiteToday);
    }

    const actions = document.createElement("div");
    actions.className = "tp-actions";

    const continueBtn = document.createElement("button");
    continueBtn.id = "continueButton";
    continueBtn.className = "tp-btn";
    continueBtn.textContent = "Continue";
    continueBtn.disabled = true;

    const shouldShowCloseTab = Boolean(payload.showCloseTab);
    let closeTabBtn = null;
    if (shouldShowCloseTab) {
      closeTabBtn = document.createElement("button");
      closeTabBtn.className = "tp-btn tp-btn-danger tp-btn-danger-large";
      closeTabBtn.textContent = "Close Tab";
    }

    function syncContinueState() {
      const value = note.value.trim();
      const canContinue =
        slowModeDone && value.length >= 15 && !hasLowHonestyPattern(value) && !lacksCognitiveDepth(value);
      continueBtn.disabled = !canContinue;
      continueBtn.classList.toggle("tp-btn-ready", canContinue);
      if (noteError.hidden === false && !hasLowHonestyPattern(value) && !lacksCognitiveDepth(value)) {
        noteError.hidden = true;
      }
    }

    function finish(result) {
      if (activePrompt) {
        activePrompt.completed = true;
      }
      const response = {
        ...result,
        snoozeSiteToday: dontShowCheckbox.checked,
      };
      removePrompt();
      resolveResponse(response);
    }

    continueBtn.addEventListener("click", async () => {
      const value = note.value.trim();
      if (value.length < 15) {
        return;
      }

      if (hasLowHonestyPattern(value) || lacksCognitiveDepth(value)) {
        noteError.hidden = false;
        if (looksLikeMash(value)) {
          sendBackgroundMessage({ type: "SHOW_HONESTY_ALERT" }, 800).catch(() => {});
        }
        window.alert("Justification lacks cognitive depth. Try being honest.");
        syncContinueState();
        return;
      }

      continueBtn.disabled = true;
      continueBtn.classList.remove("tp-btn-ready");

      let storedByContent = false;
      try {
        await sendBackgroundMessage({
          type: "STORE_THOUGHT_PAUSE_RESPONSE",
          payload: {
            domain: payload.domain || null,
            url: payload.url || null,
            triggerType: payload.triggerType || null,
            choice: "Intentional visit",
            note: value,
            action: "continue",
          },
        });
        storedByContent = true;
      } catch {
        syncContinueState();
      }

      finish({
        action: "continue",
        choice: "Intentional visit",
        note: value,
        storedByContent,
      });
    });

    if (closeTabBtn) {
      closeTabBtn.addEventListener("click", () => {
        finish({
          action: "close_tab",
          choice: "Close tab",
          note: note.value.trim(),
          storedByContent: false,
        });
      });
    }

    note.addEventListener("input", syncContinueState);
    note.addEventListener("keydown", suppressModalTextareaShortcuts, true);
    note.addEventListener("keypress", suppressModalTextareaShortcuts, true);
    setTimeout(syncContinueState, 500);

    if (closeTabBtn) {
      actions.appendChild(closeTabBtn);
    }
    actions.appendChild(continueBtn);

    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(reason);
    if (slowModeSeconds > 0) {
      const slowModeWrap = document.createElement("div");
      slowModeWrap.className = "tp-slow-mode";
      const slowModeText = document.createElement("p");
      slowModeText.className = "tp-slow-mode-text";
      const slowModeBar = document.createElement("div");
      slowModeBar.className = "tp-slow-mode-bar";
      const slowModeBarFill = document.createElement("div");
      slowModeBarFill.className = "tp-slow-mode-bar-fill";
      slowModeBar.appendChild(slowModeBarFill);
      let remaining = slowModeSeconds;
      slowModeText.textContent =
        "Rahul, your Brain CPU is overheating from context switches. Wait 10 seconds to stabilize focus.";
      slowModeWrap.appendChild(slowModeText);
      slowModeWrap.appendChild(slowModeBar);
      modal.appendChild(slowModeWrap);

      noteLabel.hidden = true;
      note.hidden = true;
      noteError.hidden = true;
      actions.hidden = true;

      const slowTimer = setInterval(() => {
        remaining -= 1;
        const progress = ((slowModeSeconds - remaining) / slowModeSeconds) * 100;
        slowModeBarFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
        if (remaining <= 0) {
          clearInterval(slowTimer);
          slowModeDone = true;
          slowModeWrap.remove();
          noteLabel.hidden = false;
          note.hidden = false;
          actions.hidden = false;
          note.focus();
          syncContinueState();
          return;
        }
      }, 1000);
    }

    modal.appendChild(noteLabel);
    modal.appendChild(note);
    modal.appendChild(noteError);
    modal.appendChild(actions);

    modal.appendChild(dontShowWrap);
    const guardContextMenu = (event) => {
      if (activePrompt) {
        event.preventDefault();
      }
    };
    const guardKeys = (event) => {
      if (!activePrompt) {
        return;
      }
      const blocked =
        event.key === "F12" ||
        (event.ctrlKey && event.shiftKey && ["I", "J", "C"].includes(event.key.toUpperCase())) ||
        (event.metaKey && event.altKey && ["I", "J", "C"].includes(event.key.toUpperCase()));
      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("contextmenu", guardContextMenu, true);
    window.addEventListener("keydown", guardKeys, true);

    const domObserver = new MutationObserver(() => {
      if (!activePrompt || activePrompt.host !== host || activePrompt.completed) {
        return;
      }
      if (host.isConnected) {
        return;
      }

      domObserver.disconnect();
      sendBackgroundMessage({ type: "LOG_BYPASS_ATTEMPT" }, 500).catch(() => {});
      window.removeEventListener("contextmenu", guardContextMenu, true);
      window.removeEventListener("keydown", guardKeys, true);
      activePrompt = null;
      setTimeout(() => {
        renderPrompt(payload, resolveResponse);
      }, 0);
    });
    domObserver.observe(document.documentElement, { childList: true, subtree: true });

    activePrompt = {
      signature,
      host,
      timerId: null,
      timeoutId: null,
      completed: false,
      domObserver,
      noteEl: note,
      dontShowCheckbox,
      cleanupGuards: () => {
        window.removeEventListener("contextmenu", guardContextMenu, true);
        window.removeEventListener("keydown", guardKeys, true);
      },
    };

    overlay.appendChild(modal);
    shadow.appendChild(style);
    shadow.appendChild(overlay);

    document.documentElement.appendChild(host);
    syncContinueState();
    if (slowModeDone) {
      note.focus();
    }
  }

  function renderLoopPrompt(payload, resolveResponse) {
    if (activeLoopPrompt) {
      removeLoopPrompt();
    }

    const host = document.createElement("div");
    host.id = "loop-prompt-host";
    const shadow = host.attachShadow({ mode: "open" });

    const stylesheetUrl = getContentStylesheetUrl();
    if (!stylesheetUrl) {
      return;
    }
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = stylesheetUrl;

    const box = document.createElement("section");
    box.className = "lp-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-live", "polite");

    const closeBtn = document.createElement("button");
    closeBtn.className = "lp-close";
    closeBtn.textContent = "×";
    closeBtn.title = "Close";

    const title = document.createElement("h3");
    title.className = "lp-title";
    title.textContent = "Pause.";

    const switchCount = Number(payload.switchCount) || 0;
    const windowMinutes = Number(payload.windowMinutes) || 4;
    const domains = Array.isArray(payload.domains) ? payload.domains : [];
    const domainsText = domains.length > 0 ? ` between ${domains.join(", ")}` : "";

    const body = document.createElement("p");
    body.className = "lp-body";
    body.textContent = `You've switched ${switchCount} times in ${windowMinutes} minutes${domainsText}. Still intentional?`;

    const timer = document.createElement("p");
    timer.className = "lp-timer";
    let remaining = 10;
    timer.textContent = `Auto dismiss in ${remaining}s`;

    const actions = document.createElement("div");
    actions.className = "lp-actions";

    const continueBtn = document.createElement("button");
    continueBtn.className = "lp-btn";
    continueBtn.textContent = "Yes, continue";

    const breakBtn = document.createElement("button");
    breakBtn.className = "lp-btn";
    breakBtn.textContent = "Take a break";

    const snoozeBtn = document.createElement("button");
    snoozeBtn.className = "lp-btn";
    snoozeBtn.textContent = "Snooze for today";

    function finish(action) {
      removeLoopPrompt();
      resolveResponse({ action });
    }

    continueBtn.addEventListener("click", () => finish("continue"));
    breakBtn.addEventListener("click", () => finish("break"));
    snoozeBtn.addEventListener("click", () => finish("snooze_today"));
    closeBtn.addEventListener("click", () => finish("dismiss"));

    actions.appendChild(continueBtn);
    actions.appendChild(breakBtn);
    actions.appendChild(snoozeBtn);

    box.appendChild(closeBtn);
    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(actions);
    box.appendChild(timer);

    shadow.appendChild(style);
    shadow.appendChild(box);
    document.documentElement.appendChild(host);

    const timerId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timerId);
        finish("dismiss");
        return;
      }
      timer.textContent = `Auto dismiss in ${remaining}s`;
    }, 1000);

    activeLoopPrompt = {
      host,
      timerId,
    };
  }

  function showStudyAlert(payload, resolveResponse) {
    removeStudyAlert();

    const host = document.createElement("div");
    host.id = "study-alert-host";
    const shadow = host.attachShadow({ mode: "open" });

    const stylesheetUrl = getContentStylesheetUrl();
    if (!stylesheetUrl) {
      return;
    }
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = stylesheetUrl;

    const box = document.createElement("section");
    box.className = "sa-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-live", "assertive");

    const closeBtn = document.createElement("button");
    closeBtn.className = "sa-close";
    closeBtn.textContent = "×";
    closeBtn.title = "Dismiss";

    const title = document.createElement("h3");
    title.className = "sa-title";
    title.textContent = "Study Mode";

    const body = document.createElement("p");
    body.className = "sa-body";
    body.textContent = `You are currently in Study Mode. Is ${payload.siteName || payload.domain || "this site"} helping you right now?`;

    const dismissBtn = document.createElement("button");
    dismissBtn.className = "sa-btn";
    dismissBtn.textContent = "Dismiss";

    function finish(result = { shown: true, dismissed: true }) {
      removeStudyAlert();
      resolveResponse(result);
    }

    closeBtn.addEventListener("click", () => finish());
    dismissBtn.addEventListener("click", () => finish());

    box.appendChild(closeBtn);
    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(dismissBtn);

    shadow.appendChild(style);
    shadow.appendChild(box);
    document.documentElement.appendChild(host);

    const timerId = setTimeout(() => finish(), 10000);
    activeStudyAlert = { host, timerId };
  }

  function showHardLock(payload, resolveResponse) {
    removeHardLock();

    const host = document.createElement("div");
    host.id = "hard-lock-host";
    const shadow = host.attachShadow({ mode: "open" });

    const stylesheetUrl = getContentStylesheetUrl();
    if (!stylesheetUrl) {
      return;
    }
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = stylesheetUrl;

    const overlay = document.createElement("section");
    overlay.className = "hl-overlay";
    overlay.setAttribute("role", "alertdialog");
    overlay.setAttribute("aria-live", "assertive");

    const title = document.createElement("h2");
    title.className = "hl-title";
    title.textContent = payload.title || "Hard Lock";

    const body = document.createElement("p");
    body.className = "hl-body";
    body.textContent =
      payload.body ||
      `${payload.domain || "This site"} crossed the visit threshold. Cooling down before the next impulse click.`;

    const countdown = document.createElement("div");
    countdown.className = "hl-countdown";

    let remaining = Math.max(1, Number(payload.seconds) || 60);
    countdown.textContent = `${remaining}s`;

    overlay.appendChild(title);
    overlay.appendChild(body);
    overlay.appendChild(countdown);
    shadow.appendChild(style);
    shadow.appendChild(overlay);
    document.documentElement.appendChild(host);

    const timerId = setInterval(() => {
      remaining -= 1;
      countdown.textContent = `${remaining}s`;
      if (remaining <= 0) {
        clearInterval(timerId);
        removeHardLock();
        resolveResponse({ completed: true });
      }
    }, 1000);

    activeHardLock = { host, timerId };
  }

  withRuntimeAccess((runtime) => {
    runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || !extensionContextAlive) {
        return;
      }

      if (message.type === "SHOW_REVISIT_LOOP") {
        renderLoopPrompt(message.payload || {}, (result) => {
          sendResponse(result);
        });
        return true;
      }

      if (message.type === "SHOW_STUDY_ALERT") {
        showStudyAlert(message.payload || {}, (result) => {
          sendResponse(result);
        });
        return true;
      }

      if (message.type === "SHOW_HARD_LOCK") {
        showHardLock(message.payload || {}, (result) => {
          sendResponse(result);
        });
        return true;
      }

      if (message.type !== "SHOW_THOUGHT_PAUSE") {
        return;
      }

      renderPrompt(message.payload || {}, (result) => {
        sendResponse(result);
      });

      return true;
    });
    return true;
  });

  document.addEventListener("DOMContentLoaded", () => {
    scheduleYoutubeScan(true);
    attachYoutubeTitleObserver();
  });

  window.addEventListener("yt-navigate-finish", () => {
    scheduleYoutubeScan(true);
    attachYoutubeTitleObserver();
  });

  window.addEventListener("mousemove", sendInteractionHeartbeat, { passive: true });
  window.addEventListener("keydown", sendInteractionHeartbeat, { passive: true });
  window.addEventListener("scroll", sendInteractionHeartbeat, { passive: true });
})();
