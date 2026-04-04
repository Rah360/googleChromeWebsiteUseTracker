(() => {
  let activePrompt = null;
  let activeLoopPrompt = null;

  function removePrompt() {
    if (!activePrompt) {
      return;
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

  function renderPrompt(payload, resolveResponse) {
    if (activePrompt) {
      removePrompt();
    }

    const host = document.createElement("div");
    host.id = "thought-pause-host";
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = chrome.runtime.getURL("content.css");

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

    const grid = document.createElement("div");
    grid.className = "tp-grid";

    const note = document.createElement("textarea");
    note.className = "tp-note";
    note.placeholder = "Optional: one line note";
    note.maxLength = 280;

    const dontShowWrap = document.createElement("label");
    dontShowWrap.className = "tp-dont-show";
    const dontShowCheckbox = document.createElement("input");
    dontShowCheckbox.type = "checkbox";
    const dontShowText = document.createElement("span");
    dontShowText.textContent = "Don't show again for this site today";
    dontShowWrap.appendChild(dontShowCheckbox);
    dontShowWrap.appendChild(dontShowText);

    const actions = document.createElement("div");
    actions.className = "tp-actions";

    const continueBtn = document.createElement("button");
    continueBtn.className = "tp-btn";
    continueBtn.textContent = "Continue";

    const noteGroup = document.createElement("div");
    noteGroup.className = "tp-note-group";

    const saveBtn = document.createElement("button");
    saveBtn.className = "tp-note-btn";
    saveBtn.textContent = "Save";

    const timerEl = document.createElement("div");
    timerEl.className = "tp-timer";

    function finish(result) {
      const response = {
        ...result,
        snoozeSiteToday: dontShowCheckbox.checked,
      };
      removePrompt();
      resolveResponse(response);
    }

    const quickChoices = Array.isArray(payload.quickChoices) ? payload.quickChoices : [];
    quickChoices.forEach((choiceLabel) => {
      const btn = document.createElement("button");
      btn.className = "tp-choice";
      btn.textContent = choiceLabel;
      btn.addEventListener("click", () => {
        finish({ action: "choice", choice: choiceLabel, note: note.value.trim() });
      });
      grid.appendChild(btn);
    });

    continueBtn.addEventListener("click", () => {
      finish({ action: "continue", choice: "Continue", note: note.value.trim() });
    });

    saveBtn.addEventListener("click", () => {
      finish({ action: "save", choice: null, note: note.value.trim() });
    });

    noteGroup.appendChild(saveBtn);
    actions.appendChild(continueBtn);
    actions.appendChild(noteGroup);

    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(reason);
    modal.appendChild(grid);

    if (payload.allowNote) {
      modal.appendChild(note);
      modal.appendChild(actions);
    } else {
      modal.appendChild(actions);
    }

    modal.appendChild(dontShowWrap);

    const strictMode = Boolean(payload.strictMode);
    if (!strictMode) {
      const dismissSeconds = Math.max(3, Number(payload.autoDismissSeconds) || 10);
      let remaining = dismissSeconds;
      timerEl.textContent = `Auto-dismiss in ${remaining}s`;
      modal.appendChild(timerEl);

      const timerId = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(timerId);
          finish({ action: "dismiss", choice: null, note: note.value.trim() });
          return;
        }
        timerEl.textContent = `Auto-dismiss in ${remaining}s`;
      }, 1000);

      activePrompt = {
        host,
        timerId,
        timeoutId: null,
      };
    } else {
      activePrompt = {
        host,
        timerId: null,
        timeoutId: null,
      };
    }

    overlay.appendChild(modal);
    shadow.appendChild(style);
    shadow.appendChild(overlay);

    document.documentElement.appendChild(host);
  }

  function renderLoopPrompt(payload, resolveResponse) {
    if (activeLoopPrompt) {
      removeLoopPrompt();
    }

    const host = document.createElement("div");
    host.id = "loop-prompt-host";
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = chrome.runtime.getURL("content.css");

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

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "SHOW_THOUGHT_PAUSE") {
      if (!message || message.type !== "SHOW_REVISIT_LOOP") {
        return;
      }

      renderLoopPrompt(message.payload || {}, (result) => {
        sendResponse(result);
      });
      return true;
    }

    renderPrompt(message.payload || {}, (result) => {
      sendResponse(result);
    });

    return true;
  });
})();
