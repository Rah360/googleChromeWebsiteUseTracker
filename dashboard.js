const periodSelect = document.getElementById("period");
const copyAiExportBtn = document.getElementById("copy-ai-export");
const baselineRemainingEl = document.getElementById("baseline-remaining");
const totalTimeEl = document.getElementById("total-time");
const uniqueSitesEl = document.getElementById("unique-sites");
const maxSiteEl = document.getElementById("max-site");
const topSitesListEl = document.getElementById("top-sites-list");
const insightsListEl = document.getElementById("insights-list");
const healthUptimeEl = document.getElementById("health-uptime");
const healthCrashesEl = document.getElementById("health-crashes");
const healthJitterEl = document.getElementById("health-jitter");
const felineVisualEl = document.getElementById("feline-visual");
const felineTitleEl = document.getElementById("feline-title");
const felineTextEl = document.getElementById("feline-text");
const controlMeterFillEl = document.getElementById("control-meter-fill");
const controlMeterTextEl = document.getElementById("control-meter-text");
const selfControlIndexEl = document.getElementById("self-control-index");
const dishonestBypassCountEl = document.getElementById("dishonest-bypass-count");
const dishonestBypassListEl = document.getElementById("dishonest-bypass-list");
const behavioralMirrorEl = document.getElementById("behavioral-mirror");
const catsAdviceEl = document.getElementById("cats-advice");
const studyStatusCardEl = document.getElementById("study-status-card");
const studyTotalTimeEl = document.getElementById("study-total-time");
const studySessionCountEl = document.getElementById("study-session-count");
const studyDistractingTimeEl = document.getElementById("study-distracting-time");
const studyFocusRatioEl = document.getElementById("study-focus-ratio");
const studySwitchCountEl = document.getElementById("study-switch-count");
const studyDoomscrollTimeEl = document.getElementById("study-doomscroll-time");
const fragmentCountEl = document.getElementById("fragment-count");
const deepDiveCountEl = document.getElementById("deep-dive-count");
const reactiveHourEl = document.getElementById("reactive-hour");
const studyTopSitesEl = document.getElementById("study-top-sites");
const studyDistractionsEl = document.getElementById("study-distractions");
const studyDoomscrollSurfacesEl = document.getElementById("study-doomscroll-surfaces");
const studyRecentSessionsEl = document.getElementById("study-recent-sessions");

const tpTodayEl = document.getElementById("tp-today");
const tpWeekEl = document.getElementById("tp-week");
const tpPeriodTotalEl = document.getElementById("tp-period-total");
const tpTopSitesEl = document.getElementById("tp-top-sites");
const tpChoicesEl = document.getElementById("tp-choices");
const tpCorrelationEl = document.getElementById("tp-correlation");

const bounceThresholdEl = document.getElementById("bounce-threshold");
const analyticsFilterEl = document.getElementById("analytics-filter");
const revisitBarsEl = document.getElementById("revisit-bars");
const bouncePairsEl = document.getElementById("bounce-pairs");
const switchingTimelineEl = document.getElementById("switching-timeline");
const switchingLegendEl = document.getElementById("switching-legend");
const loopMaxEl = document.getElementById("loop-max");
const loopAvgEl = document.getElementById("loop-avg");
const loopCountEl = document.getElementById("loop-count");
const loopHistogramEl = document.getElementById("loop-histogram");
const activityHeatmapEl = document.getElementById("activity-heatmap");
const heatmapLegendEl = document.getElementById("heatmap-legend");
const loopPromptsTodayEl = document.getElementById("loop-prompts-today");
const loopActionEl = document.getElementById("loop-action");
const loopDomainsEl = document.getElementById("loop-domains");
const hourlyReactivityChartEl = document.getElementById("hourly-reactivity-chart");
const improvementSlopeChartEl = document.getElementById("improvement-slope-chart");
const trendMessageEl = document.getElementById("trend-message");

const clearPeriodBtn = document.getElementById("clear-period");
const clearAllBtn = document.getElementById("clear-all");
const statusEl = document.getElementById("status");

const AUTO_REFRESH_MS = 5000;
let autoRefreshTimer = null;
let isStatsLoading = false;
let latestFragmentation = null;
let latestBehavioral = null;
let latestStats = null;
let latestTrendAnalytics = null;
let toastTimer = null;
let copyButtonResetTimer = null;
const PRODUCTIVE_DOMAINS = new Set([
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
]);
const DISTRACTING_DOMAINS = new Set([
  "instagram.com",
  "reddit.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "tiktok.com",
  "youtube.com",
  "hotstar.com",
  "epicsports.me",
  "linkedin.com",
  "news.ycombinator.com",
]);
const SOCIAL_DOMAINS = new Set([
  "instagram.com",
  "reddit.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "tiktok.com",
  "youtube.com",
]);

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#0f766e";
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

async function exportDataForAI() {
  const data = await sendMessage({ type: "GET_AI_EXPORT" });
  const json = JSON.stringify(data, null, 2);
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard API unavailable");
  }
  await navigator.clipboard.writeText(json);
  return data;
}

function showToast(message, isError = false) {
  let toast = document.getElementById("dashboard-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "dashboard-toast";
    toast.className = "dashboard-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `dashboard-toast ${isError ? "toast-error" : "toast-success"} toast-visible`;

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove("toast-visible");
  }, 2400);
}

function setCopyButtonTemporaryState(label, className = "") {
  if (!copyAiExportBtn) {
    return;
  }

  if (!copyAiExportBtn.dataset.originalText) {
    copyAiExportBtn.dataset.originalText = copyAiExportBtn.textContent || "Copy Data for AI Analysis";
  }

  copyAiExportBtn.textContent = label;
  copyAiExportBtn.classList.toggle("copied-state", className === "copied-state");
  copyAiExportBtn.classList.toggle("error-state", className === "error-state");

  if (copyButtonResetTimer) {
    clearTimeout(copyButtonResetTimer);
  }

  copyButtonResetTimer = setTimeout(() => {
    copyAiExportBtn.textContent = copyAiExportBtn.dataset.originalText || "Copy Data for AI Analysis";
    copyAiExportBtn.classList.remove("copied-state", "error-state");
  }, 2000);
}

function renderSimpleList(container, rows, rowText) {
  container.innerHTML = "";
  if (!rows || rows.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No data for this period.";
    container.appendChild(li);
    return;
  }

  for (const row of rows) {
    const li = document.createElement("li");
    li.textContent = rowText(row);
    container.appendChild(li);
  }
}

function renderTopSites(topSites) {
  renderSimpleList(topSitesListEl, topSites, (site) => `${site.domain} - ${site.durationText}`);
}

function formatDuration(ms) {
  const value = Math.max(0, Number(ms) || 0);
  if (value < 1000) {
    return "0s";
  }

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (hours === 0 && seconds > 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

function domainMatches(domain, known) {
  if (!domain) {
    return false;
  }
  for (const item of known) {
    if (domain === item || domain.endsWith(`.${item}`)) {
      return true;
    }
  }
  return false;
}

function isProductiveDomain(domain) {
  return domainMatches(domain, PRODUCTIVE_DOMAINS);
}

function isDistractingDomain(domain) {
  return domainMatches(domain, DISTRACTING_DOMAINS);
}

function isSocialDomain(domain) {
  return domainMatches(domain, SOCIAL_DOMAINS);
}

function getFelineState(jitter, forceJudging = false) {
  if (forceJudging) {
    return {
      title: "System Unstable",
      text: "Focus fragmented. The cat is not impressed.",
      svg: `
        <svg viewBox="0 0 180 120" class="cat-svg" aria-hidden="true">
          <rect x="34" y="78" width="112" height="20" rx="10" fill="#7f1d1d"/>
          <ellipse cx="90" cy="58" rx="30" ry="22" fill="#e5e7eb"/>
          <circle cx="90" cy="34" r="16" fill="#e5e7eb"/>
          <polygon points="78,24 84,10 89,24" fill="#e5e7eb"/>
          <polygon points="92,24 98,10 103,24" fill="#e5e7eb"/>
          <circle cx="84" cy="34" r="2.4" fill="#111827"/>
          <circle cx="96" cy="34" r="2.4" fill="#111827"/>
          <path d="M82 42 q8 -4 16 0" stroke="#111827" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M62 62 q-18 2 -24 16" stroke="#e5e7eb" stroke-width="7" fill="none" stroke-linecap="round"/>
        </svg>`,
    };
  }

  if (jitter < 5) {
    return {
      title: "System Stable",
      text: "Purr-fect focus.",
      svg: `
        <svg viewBox="0 0 180 120" class="cat-svg" aria-hidden="true">
          <rect x="24" y="78" width="132" height="18" rx="9" fill="#14532d"/>
          <ellipse cx="88" cy="68" rx="34" ry="20" fill="#34d399"/>
          <circle cx="122" cy="54" r="15" fill="#34d399"/>
          <polygon points="112,43 118,28 124,42" fill="#34d399"/>
          <polygon points="126,42 133,28 137,44" fill="#34d399"/>
          <path d="M56 69c-10 0-18 8-18 18" stroke="#34d399" stroke-width="8" fill="none" stroke-linecap="round"/>
          <path d="M118 57 q6 6 12 0" stroke="#052e16" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>`,
    };
  }

  if (jitter <= 15) {
    return {
      title: "System Monitoring",
      text: "Focus is wobbling. Stay with the work.",
      svg: `
        <svg viewBox="0 0 180 120" class="cat-svg" aria-hidden="true">
          <rect x="28" y="82" width="124" height="14" rx="7" fill="#166534"/>
          <ellipse cx="90" cy="66" rx="28" ry="24" fill="#facc15"/>
          <circle cx="90" cy="38" r="16" fill="#facc15"/>
          <polygon points="78,28 84,14 89,28" fill="#facc15"/>
          <polygon points="92,28 98,14 103,28" fill="#facc15"/>
          <circle cx="84" cy="36" r="2.5" fill="#111827"/>
          <circle cx="96" cy="36" r="2.5" fill="#111827"/>
          <path d="M88 44 q2 3 4 0" stroke="#111827" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M62 66 q-20 4 -24 20" stroke="#facc15" stroke-width="8" fill="none" stroke-linecap="round"/>
        </svg>`,
    };
  }

  return {
    title: "System Unstable",
    text: "Focus fragmented.",
    svg: `
      <svg viewBox="0 0 180 120" class="cat-svg" aria-hidden="true">
        <rect x="34" y="78" width="112" height="20" rx="10" fill="#7f1d1d"/>
        <rect x="48" y="46" width="84" height="26" rx="12" fill="#1f2937" stroke="#991b1b" stroke-width="3"/>
        <path d="M56 78 q18-16 34 0" stroke="#ef4444" stroke-width="4" fill="none"/>
        <path d="M92 78 q16-14 30 0" stroke="#ef4444" stroke-width="4" fill="none"/>
      </svg>`,
  };
}

function renderSystemHealth(health, fragmentation) {
  const data = health || {};
  const jitter = Number(fragmentation?.focusFragmentIndex) || Number(data.jitter) || 0;
  healthUptimeEl.textContent = data.uptimeText || "0s";
  healthCrashesEl.textContent = String(data.crashes || 0);
  healthJitterEl.textContent = String(jitter);

  const archetype = latestStats && latestBehavioral
    ? getArchetype(latestStats, latestBehavioral, fragmentation || latestStats.fragmentation)
    : "";
  const feline = getFelineState(jitter, archetype.startsWith("Dopamine Seeker"));
  felineVisualEl.innerHTML = feline.svg;
  felineTitleEl.textContent = feline.title;
  felineTextEl.textContent = feline.text;
}

function renderInsights(rows) {
  insightsListEl.innerHTML = "";
  if (!rows || rows.length === 0) {
    const p = document.createElement("p");
    p.textContent = "Not enough data yet to generate insights.";
    insightsListEl.appendChild(p);
    return;
  }

  for (const row of rows) {
    const item = document.createElement("article");
    item.className = `insight-item insight-${row.tone || "neutral"}`;

    const title = document.createElement("h3");
    title.textContent = row.title;

    const detail = document.createElement("p");
    detail.textContent = row.detail;

    item.appendChild(title);
    item.appendChild(detail);
    insightsListEl.appendChild(item);
  }
}

function renderControlMeter(controlMeter) {
  const data = controlMeter || {};
  const bypassesToday = Math.max(0, Number(data.bypassesToday) || 0);
  const progressPct = Math.max(0, Math.min(100, Number(data.progressPct) || 0));
  const isCritical = Boolean(data.isCritical);

  if (controlMeterFillEl) {
    controlMeterFillEl.style.width = `${progressPct}%`;
    controlMeterFillEl.classList.toggle("critical", isCritical);
  }

  if (controlMeterTextEl) {
    controlMeterTextEl.textContent = isCritical
      ? `${bypassesToday} bypasses today. Control meter is in the red.`
      : `${bypassesToday} bypass${bypassesToday === 1 ? "" : "es"} today.`;
  }
}

function renderHonestyWidget(honesty) {
  const data = honesty || {};
  if (selfControlIndexEl) {
    selfControlIndexEl.textContent = String(Math.max(0, Number(data.selfControlIndex) || 0));
  }
  if (dishonestBypassCountEl) {
    dishonestBypassCountEl.textContent = String(Math.max(0, Number(data.dishonestBypassCount) || 0));
  }

  if (!dishonestBypassListEl) {
    return;
  }

  dishonestBypassListEl.innerHTML = "";
  const rows = Array.isArray(data.dishonestBypasses) ? data.dishonestBypasses : [];
  if (rows.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No dishonest bypasses detected in this period.";
    dishonestBypassListEl.appendChild(li);
    return;
  }

  for (const row of rows) {
    const li = document.createElement("li");
    const justification = typeof row.justification === "string" ? row.justification.trim() : "";
    const snippet =
      justification.length > 48 ? `${justification.slice(0, 48).trimEnd()}...` : justification;
    li.textContent = justification
      ? `${row.domain} - "${snippet}", session ${row.sessionDurationText}`
      : `${row.domain} - session ${row.sessionDurationText}`;
    dishonestBypassListEl.appendChild(li);
  }
}

function getTopLoopDomains(behavioral) {
  const counts = new Map();
  const pairs = behavioral?.topBouncePairs || [];

  for (const pair of pairs) {
    const weight = Math.max(1, Number(pair.count) || 0);
    counts.set(pair.from, (counts.get(pair.from) || 0) + weight);
    counts.set(pair.to, (counts.get(pair.to) || 0) + weight);
  }

  return [...counts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function getWindowSwitchRate(timeline, startHour, endHour) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return 0;
  }

  let total = 0;
  for (const row of timeline) {
    const [hourText] = String(row.label || "0:00").split(":");
    const hour = Number(hourText);
    if (Number.isNaN(hour)) {
      continue;
    }
    if (hour >= startHour && hour < endHour) {
      total += Math.max(0, Number(row.count) || 0);
    }
  }

  return total / Math.max(1, endHour - startHour);
}

function classifyBouncePair(pair) {
  const fromProductive = isProductiveDomain(pair?.from);
  const toProductive = isProductiveDomain(pair?.to);
  const fromDistracting = isDistractingDomain(pair?.from);
  const toDistracting = isDistractingDomain(pair?.to);

  if (fromProductive && toProductive) {
    return "Productive Research";
  }
  if ((fromProductive && toDistracting) || (fromDistracting && toProductive)) {
    return "Task Avoidance";
  }
  if (fromDistracting && toDistracting) {
    return "Reactive Escape";
  }
  return "Context Drift";
}

function getDomainMix(topSites) {
  const rows = Array.isArray(topSites) ? topSites : [];
  let productiveMs = 0;
  let socialMs = 0;
  let totalMs = 0;

  for (const site of rows) {
    const durationMs = Math.max(0, Number(site?.durationMs) || 0);
    totalMs += durationMs;
    if (isProductiveDomain(site?.domain)) {
      productiveMs += durationMs;
    }
    if (isSocialDomain(site?.domain)) {
      socialMs += durationMs;
    }
  }

  return {
    productiveMs,
    socialMs,
    totalMs,
    productiveShare: totalMs > 0 ? productiveMs / totalMs : 0,
    socialShare: totalMs > 0 ? socialMs / totalMs : 0,
  };
}

function getSocialVisitCount(stats, behavioral) {
  const studyVisits = (stats?.studyMode?.topStudySites || [])
    .filter((site) => isSocialDomain(site?.domain))
    .reduce((sum, site) => sum + Math.max(0, Number(site?.visits) || 0), 0);

  const bounceVisits = (behavioral?.topBouncePairs || []).reduce((sum, pair) => {
    if (isSocialDomain(pair?.from) || isSocialDomain(pair?.to)) {
      return sum + Math.max(0, Number(pair?.count) || 0);
    }
    return sum;
  }, 0);

  return Math.max(studyVisits, bounceVisits);
}

function getArchetype(stats, behavioral, fragmentation) {
  const topSite = stats?.topSites?.[0]?.domain;
  const loopCount = behavioral?.rapidLoops?.streakCount || 0;
  const jitter = Number(fragmentation?.focusFragmentIndex) || 0;
  const mix = getDomainMix(stats?.topSites || []);
  const topIsSocial = isSocialDomain(topSite);
  const socialTimeMs = mix.socialMs;
  const socialVisitCount = getSocialVisitCount(stats, behavioral);

  if (jitter > 20 && topIsSocial) {
    return "Context-Switched. Your browser kept snapping back to social surfaces instead of holding a working set.";
  }
  if (socialTimeMs > 15 * 60 * 1000 || socialVisitCount > 10) {
    return "Dopamine Seeker. Social tabs dominated enough of the day to override any polite explanation.";
  }
  if (mix.productiveShare >= 0.7 && jitter > 20 && loopCount > 0) {
    return `Scattered Researcher. Most of your time was on productive domains, but you kept breaking your own stack trace around ${topSite || "the work"}.`;
  }
  if ((stats?.studyMode?.deepDiveCount || 0) > 0 || (stats?.studyMode?.totalDoomscrollTimeMs || 0) > 0) {
    return "Deep Diver. Once you slipped into a scroll surface, your session stopped behaving like deliberate work.";
  }
  if ((stats?.studyMode?.focusRatio || 0) >= 75) {
    return "Builder Mode. The work mostly stayed on the rails.";
  }
  return "Context Switcher. The browser looked more like a queue than a workstation.";
}

function generateBehavioralSummary(stats, behavioral, fragmentation) {
  const jitter = Number(fragmentation?.focusFragmentIndex) || 0;
  const summaryItems = [];
  const topLoopDomains = getTopLoopDomains(behavioral);
  const topPair = behavioral?.topBouncePairs?.[0] || null;
  const longestNonProductive = stats?.longestNonProductiveSession || null;
  const topSite = stats?.topSites?.[0] || null;
  const archetype = getArchetype(stats, behavioral, fragmentation);
  const socialTimeMs = getDomainMix(stats?.topSites || []).socialMs;
  const morningRate = getWindowSwitchRate(behavioral?.switchingTimeline, 9, 13);
  const afternoonRate = getWindowSwitchRate(behavioral?.switchingTimeline, 14, 18);
  const reactiveHour = fragmentation?.mostReactiveHourLabel || "not clear yet";
  const deepDiveCount = Number(stats?.studyMode?.deepDiveCount) || Number(fragmentation?.deepDiveCount) || 0;

  summaryItems.push({
    title: "Behavioral Archetype",
    detail: archetype,
  });

  if (jitter > 20 && topLoopDomains.length > 0) {
    summaryItems.push({
      title: "Context Switcher",
      detail: `You are stuck in a loop between ${topLoopDomains.map((item) => item.domain).join(", ")}. That is not multitasking. That is cache thrash.`,
    });
  } else {
    summaryItems.push({
      title: "Context Switcher",
      detail: `Fragmentation index is ${jitter}. Loop pressure is present${topLoopDomains.length ? `, led by ${topLoopDomains.map((item) => item.domain).join(", ")}` : ""}, but it is not in full meltdown territory.`,
    });
  }

  if (longestNonProductive) {
    summaryItems.push({
      title: "Deep Diver",
      detail: `Your longest uninterrupted non-productive session was ${longestNonProductive.durationText} on ${longestNonProductive.domain}. That is where the day stopped being deliberate.`,
    });
  } else if (deepDiveCount > 0) {
    summaryItems.push({
      title: "Deep Diver",
      detail: `You fell into ${deepDiveCount} Deep Dive${deepDiveCount === 1 ? "" : "s"}. The long-scroll surfaces are still winning too many uninterrupted minutes.`,
    });
  } else {
    summaryItems.push({
      title: "Deep Diver",
      detail: "No obvious deep-dive session showed up in the last day. That is one less fire to put out.",
    });
  }

  if (topSite?.domain === "x.com" || topSite?.domain === "twitter.com" || topSite?.domain === "instagram.com") {
    summaryItems.push({
      title: "Status",
      detail: `System Hijacked. You are seeking micro-rewards instead of finishing your sprint. ${formatDuration(socialTimeMs)} of potential Deep Work lost.`,
    });
  } else if (topSite && isSocialDomain(topSite.domain)) {
    summaryItems.push({
      title: "Stack Trace",
      detail: `Social Leakage: ${topSite.domain} led your time distribution at ${topSite.durationText}. That tab was pulling attention out of the rest of the stack.`,
    });
  }

  if (morningRate > 0 || afternoonRate > 0) {
    if (morningRate === 0 && afternoonRate > 0) {
      summaryItems.push({
        title: "Morning vs. Night",
        detail: `Your morning was materially steadier. Afternoon switching averaged ${afternoonRate.toFixed(1)} switches per hour while the morning stayed quiet.`,
      });
    } else if (afternoonRate === 0 && morningRate > 0) {
      summaryItems.push({
        title: "Morning vs. Night",
        detail: `Your afternoon was cleaner than your morning. The noisy part of the day was before lunch.`,
      });
    } else {
      const base = Math.max(0.1, Math.min(morningRate, afternoonRate));
      const deltaPct = Math.round((Math.abs(morningRate - afternoonRate) / base) * 100);
      const betterWindow = morningRate < afternoonRate ? "morning" : "afternoon";
      summaryItems.push({
        title: "Morning vs. Night",
        detail: `Your focus is ${deltaPct}% more stable in the ${betterWindow} than the ${betterWindow === "morning" ? "afternoon" : "morning"}. Morning FI proxy: ${morningRate.toFixed(1)} switches/hour. Afternoon: ${afternoonRate.toFixed(1)}.`,
      });
    }
  }

  if (topPair) {
    summaryItems.push({
      title: "Bounce Pair",
      detail: `${topPair.from} <-> ${topPair.to} is your strongest pair. Classification: ${classifyBouncePair(topPair)}. Average gap: ${topPair.averageGapText}.`,
    });
  }

  let advice = `The cat suggests protecting ${reactiveHour}. That is where your attention starts trading instead of compounding.`;
  if (longestNonProductive?.domain) {
    advice = `The cat suggests closing ${longestNonProductive.domain} before the next focus block. Do not negotiate with the tab that already beat you once.`;
  } else if (topLoopDomains.length > 0) {
    advice = `The cat suggests closing your ${topLoopDomains[0].domain} loop before starting the next sprint. One fewer tempting tab is cheaper than rebuilding focus.`;
  } else if (topPair && classifyBouncePair(topPair) === "Task Avoidance") {
    advice = `The cat suggests separating ${topPair.from} and ${topPair.to}. Keep the work tab; kill the detour tab.`;
  }

  return {
    items: summaryItems,
    advice,
  };
}

function renderBehavioralMirror(summary) {
  behavioralMirrorEl.innerHTML = "";
  catsAdviceEl.textContent = "";

  const items = summary?.items || [];
  if (items.length === 0) {
    behavioralMirrorEl.textContent = "Not enough data yet to generate a behavioral summary.";
    return;
  }

  const list = document.createElement("ul");
  for (const item of items) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = `${item.title}:`;
    li.appendChild(strong);
    li.appendChild(document.createTextNode(` ${item.detail}`));
    list.appendChild(li);
  }
  behavioralMirrorEl.appendChild(list);
  catsAdviceEl.textContent = `Advice: ${summary.advice}`;
}

function refreshBehavioralMirror() {
  if (!latestStats || !latestBehavioral) {
    return;
  }
  renderBehavioralMirror(
    generateBehavioralSummary(latestStats, latestBehavioral, latestFragmentation || latestStats.fragmentation)
  );
}

function renderStudySessionTable(rows) {
  studyRecentSessionsEl.innerHTML = "";
  if (!rows || rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td colspan='4'>No study sessions for this period.</td>";
    studyRecentSessionsEl.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.durationText}</td><td>${row.uniqueSites}</td><td>${row.distractingTimeText}</td><td>${row.doomscrollTimeText}</td>`;
    studyRecentSessionsEl.appendChild(tr);
  }
}

function renderStudyMode(studyMode, studyStatus) {
  const data = studyMode || {};
  studyStatusCardEl.textContent = studyStatus?.active
    ? `On${studyStatus.currentDomain ? ` on ${studyStatus.currentDomain}` : ""}`
    : "Off";
  studyTotalTimeEl.textContent = data.totalStudyTimeText || "0s";
  studySessionCountEl.textContent = String(data.totalSessions || 0);
  studyDistractingTimeEl.textContent = data.totalDistractingTimeText || "0s";
  studyFocusRatioEl.textContent = `${Number(data.focusRatio) || 0}%`;
  studySwitchCountEl.textContent = String(data.totalSwitches || 0);
  studyDoomscrollTimeEl.textContent = data.totalDoomscrollTimeText || "0s";

  renderSimpleList(studyTopSitesEl, data.topStudySites || [], (row) => {
    const visitsText = row.visits === 1 ? "1 visit" : `${row.visits} visits`;
    return `${row.domain} - ${row.durationText} (${visitsText})`;
  });
  renderSimpleList(studyDistractionsEl, data.distractingSites || [], (row) => `${row.domain} - ${row.durationText}`);
  renderSimpleList(studyDoomscrollSurfacesEl, data.doomscrollSurfaces || [], (row) => `${row.label} - ${row.durationText}`);
  renderStudySessionTable(data.recentSessions || []);
}

function renderFragmentation(fragmentation) {
  const data = fragmentation || {};
  fragmentCountEl.textContent = String(data.fragmentCount || 0);
  deepDiveCountEl.textContent = String(data.deepDiveCount || 0);
  reactiveHourEl.textContent = data.mostReactiveHourLabel || "-";
}

function renderCorrelationTable(rows) {
  tpCorrelationEl.innerHTML = "";
  if (!rows || rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "No data for this period.";
    tr.appendChild(td);
    tpCorrelationEl.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.domain}</td><td>${row.durationText}</td><td>${row.pauses}</td>`;
    tpCorrelationEl.appendChild(tr);
  }
}

function renderThoughtPause(thoughtPause) {
  const data = thoughtPause || {};
  tpTodayEl.textContent = String(data.todayCount || 0);
  tpWeekEl.textContent = String(data.weekCount || 0);
  tpPeriodTotalEl.textContent = String(data.totalPauses || 0);
  renderSimpleList(tpTopSitesEl, data.topTriggerSites || [], (row) => `${row.domain} - ${row.count}`);
  renderSimpleList(tpChoicesEl, data.commonChoices || [], (row) => `${row.choice} - ${row.count}`);
  renderCorrelationTable(data.usageVsPauses || []);
}

function renderLoopPromptPanel(loopPrompts) {
  const data = loopPrompts || {};
  loopPromptsTodayEl.textContent = String(data.todayCount || 0);
  loopActionEl.textContent = data.mostSelectedAction
    ? `${data.mostSelectedAction.action} (${data.mostSelectedAction.count})`
    : "-";

  renderSimpleList(loopDomainsEl, data.topDomains || [], (row) => `${row.domain} - ${row.count}`);
}

function renderBaselineStatus(baseline) {
  if (!baselineRemainingEl) {
    return;
  }

  const data = baseline || {};
  const daysRemaining = Math.max(0, Number(data.daysRemaining) || 0);
  const elapsedDays = Math.max(0, Number(data.elapsedDays) || 0);
  baselineRemainingEl.textContent =
    daysRemaining > 0
      ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
      : `Baseline complete (${elapsedDays} day${elapsedDays === 1 ? "" : "s"})`;
}

function renderHourlyReactivityChart(rows = [], reactiveHour = null) {
  hourlyReactivityChartEl.innerHTML = "";
  if (!hourlyReactivityChartEl || !rows.length) {
    return;
  }

  const width = 720;
  const height = 240;
  const padding = { top: 18, right: 16, bottom: 34, left: 28 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxFi = Math.max(5, ...rows.map((row) => Number(row.fi) || 0));
  const barWidth = plotWidth / rows.length;

  const baseline = document.createElementNS("http://www.w3.org/2000/svg", "line");
  baseline.setAttribute("x1", String(padding.left));
  baseline.setAttribute("y1", String(height - padding.bottom));
  baseline.setAttribute("x2", String(width - padding.right));
  baseline.setAttribute("y2", String(height - padding.bottom));
  baseline.setAttribute("stroke", "#4b5563");
  baseline.setAttribute("stroke-width", "1");
  hourlyReactivityChartEl.appendChild(baseline);

  rows.forEach((row, index) => {
    const fi = Math.max(0, Number(row.fi) || 0);
    const barHeight = maxFi > 0 ? (fi / maxFi) * plotHeight : 0;
    const x = padding.left + index * barWidth + 1;
    const y = height - padding.bottom - barHeight;
    const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bar.setAttribute("x", String(x));
    bar.setAttribute("y", String(y));
    bar.setAttribute("width", String(Math.max(4, barWidth - 3)));
    bar.setAttribute("height", String(barHeight));
    bar.setAttribute("rx", "2");
    bar.setAttribute("fill", row.hour === reactiveHour ? "#dc2626" : fi < 5 ? "#16a34a" : "#60a5fa");
    bar.setAttribute("title", `${String(row.hour).padStart(2, "0")}:00 • FI ${fi}`);
    hourlyReactivityChartEl.appendChild(bar);

    if (index % 2 === 0) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", String(x + Math.max(4, barWidth - 3) / 2 - 7));
      label.setAttribute("y", String(height - 10));
      label.setAttribute("font-size", "9");
      label.setAttribute("fill", "#94a3b8");
      label.textContent = String(row.hour).padStart(2, "0");
      hourlyReactivityChartEl.appendChild(label);
    }
  });
}

function renderImprovementSlopeChart(rows = [], trendLine = { values: [] }) {
  improvementSlopeChartEl.innerHTML = "";
  if (!improvementSlopeChartEl || !rows.length) {
    if (trendMessageEl) {
      trendMessageEl.textContent = "Not enough 7-day data yet.";
    }
    return;
  }

  const width = 720;
  const height = 240;
  const padding = { top: 18, right: 16, bottom: 34, left: 28 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxFi = Math.max(5, ...rows.map((row) => Number(row.fi) || 0), ...(trendLine.values || []).map((value) => Number(value) || 0));

  const axis = document.createElementNS("http://www.w3.org/2000/svg", "line");
  axis.setAttribute("x1", String(padding.left));
  axis.setAttribute("y1", String(height - padding.bottom));
  axis.setAttribute("x2", String(width - padding.right));
  axis.setAttribute("y2", String(height - padding.bottom));
  axis.setAttribute("stroke", "#4b5563");
  axis.setAttribute("stroke-width", "1");
  improvementSlopeChartEl.appendChild(axis);

  const toPoint = (value, index, total) => {
    const x = padding.left + (index / Math.max(1, total - 1)) * plotWidth;
    const y = height - padding.bottom - ((Number(value) || 0) / maxFi) * plotHeight;
    return `${x},${y}`;
  };

  const seriesPoints = rows.map((row, index) => toPoint(row.fi, index, rows.length)).join(" ");
  const trendPoints = (trendLine.values || []).map((value, index) => toPoint(value, index, rows.length)).join(" ");

  const series = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  series.setAttribute("points", seriesPoints);
  series.setAttribute("fill", "none");
  series.setAttribute("stroke", "#38bdf8");
  series.setAttribute("stroke-width", "2.5");
  improvementSlopeChartEl.appendChild(series);

  const trend = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  trend.setAttribute("points", trendPoints);
  trend.setAttribute("fill", "none");
  trend.setAttribute("stroke", "#facc15");
  trend.setAttribute("stroke-width", "2");
  trend.setAttribute("stroke-dasharray", "6 5");
  improvementSlopeChartEl.appendChild(trend);

  rows.forEach((row, index) => {
    const [x, y] = toPoint(row.fi, index, rows.length).split(",");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", "#86efac");
    improvementSlopeChartEl.appendChild(dot);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(Number(x) - 16));
    label.setAttribute("y", String(height - 10));
    label.setAttribute("font-size", "9");
    label.setAttribute("fill", "#94a3b8");
    label.textContent = String(row.date || "").slice(5);
    improvementSlopeChartEl.appendChild(label);
  });
}

async function loadTrendAnalytics() {
  try {
    const period = periodSelect.value;
    const filterMode = analyticsFilterEl?.value === "work" ? "work" : "study";
    const data = await sendMessage({
      type: "GET_TREND_ANALYTICS",
      period,
      filterMode,
    });
    latestTrendAnalytics = data;
    renderHourlyReactivityChart(data.hourlyFi || [], data.reactiveHour);
    renderImprovementSlopeChart(data.dailyAverageFi || [], data.trendLine || { values: [] });
    if (trendMessageEl) {
      trendMessageEl.textContent = data.trendMessage || "";
    }
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadStats(options = {}) {
  if (isStatsLoading) {
    return;
  }

  const { silent = false } = options;

  try {
    isStatsLoading = true;
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

    latestStats = data;
    latestFragmentation = data.fragmentation || null;
    renderTopSites(data.topSites);
    renderSystemHealth(data.systemHealth, data.fragmentation);
    renderControlMeter(data.controlMeter);
    renderHonestyWidget(data.honesty);
    renderInsights(data.insights);
    renderStudyMode(data.studyMode, data.studyStatus);
    renderFragmentation(data.fragmentation);
    renderThoughtPause(data.thoughtPause);
    renderLoopPromptPanel(data.loopPrompts);
    renderBaselineStatus(data.baseline);
    refreshBehavioralMirror();

    if (!silent) {
      setStatus("Updated.");
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    isStatsLoading = false;
  }
}

function renderRevisitDistribution(rows) {
  revisitBarsEl.innerHTML = "";
  const colors = {
    "0-30s": "#38bdf8",
    "30-60s": "#60a5fa",
    "1-3m": "#818cf8",
    "3-10m": "#a78bfa",
    "10m+": "#c4b5fd",
  };
  const bucketKeys = ["0-30s", "30-60s", "1-3m", "3-10m", "10m+"];

  if (!rows || rows.length === 0) {
    revisitBarsEl.textContent = "No data for this period.";
    return;
  }

  for (const row of rows) {
    const wrap = document.createElement("div");
    wrap.className = "bar-group";

    const title = document.createElement("h4");
    title.textContent = `${row.domain} (${row.visits} visits)`;

    const bar = document.createElement("div");
    bar.className = "stacked-bar";

    const total = bucketKeys.reduce((sum, key) => sum + (row.buckets[key] || 0), 0) || 1;
    for (const key of bucketKeys) {
      const seg = document.createElement("div");
      seg.className = "stacked-segment";
      seg.style.background = colors[key];
      seg.style.opacity = String(Math.max(0.18, (row.buckets[key] || 0) / total));
      seg.title = `${key}: ${row.buckets[key] || 0}`;
      bar.appendChild(seg);
    }

    wrap.appendChild(title);
    wrap.appendChild(bar);
    revisitBarsEl.appendChild(wrap);
  }

  const legend = document.createElement("div");
  legend.className = "legend";
  for (const key of bucketKeys) {
    const item = document.createElement("div");
    item.className = "legend-item";
    const color = document.createElement("span");
    color.className = "legend-color";
    color.style.background = colors[key];
    const label = document.createElement("span");
    label.textContent = key;
    item.appendChild(color);
    item.appendChild(label);
    legend.appendChild(item);
  }
  revisitBarsEl.appendChild(legend);
}

function renderBouncePairs(rows) {
  bouncePairsEl.innerHTML = "";
  if (!rows || rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td colspan='3'>No transitions for this period.</td>";
    bouncePairsEl.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    if (row.highlight) {
      tr.className = "highlight-row";
    }
    tr.innerHTML = `<td>${row.from} -> ${row.to}</td><td>${row.count}</td><td>${row.averageGapText}</td>`;
    bouncePairsEl.appendChild(tr);
  }
}

function renderSwitchingTimeline(rows) {
  switchingTimelineEl.innerHTML = "";
  switchingLegendEl.innerHTML = "";
  if (!rows || rows.length === 0) {
    switchingLegendEl.textContent = "No switching data for this period.";
    return;
  }

  const width = 600;
  const height = 180;
  const padding = 24;
  const maxCount = Math.max(1, ...rows.map((row) => row.count));

  const points = rows
    .map((row, index) => {
      const x = padding + (index / (rows.length - 1 || 1)) * (width - padding * 2);
      const y = height - padding - (row.count / maxCount) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const axis = document.createElementNS("http://www.w3.org/2000/svg", "line");
  axis.setAttribute("x1", String(padding));
  axis.setAttribute("y1", String(height - padding));
  axis.setAttribute("x2", String(width - padding));
  axis.setAttribute("y2", String(height - padding));
  axis.setAttribute("stroke", "#94a3b8");
  axis.setAttribute("stroke-width", "1");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  path.setAttribute("points", points);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#2563eb");
  path.setAttribute("stroke-width", "2");

  const yTopLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  yTopLabel.setAttribute("x", "2");
  yTopLabel.setAttribute("y", String(padding + 2));
  yTopLabel.setAttribute("font-size", "10");
  yTopLabel.setAttribute("fill", "#64748b");
  yTopLabel.textContent = String(maxCount);

  const yBottomLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  yBottomLabel.setAttribute("x", "2");
  yBottomLabel.setAttribute("y", String(height - padding));
  yBottomLabel.setAttribute("font-size", "10");
  yBottomLabel.setAttribute("fill", "#64748b");
  yBottomLabel.textContent = "0";

  const xLabels = [
    { index: 0, label: "00:00" },
    { index: 36, label: "06:00" },
    { index: 72, label: "12:00" },
    { index: 108, label: "18:00" },
    { index: 143, label: "23:50" },
  ];

  for (const item of xLabels) {
    const x = padding + (item.index / 143) * (width - padding * 2);
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(x - 12));
    label.setAttribute("y", String(height - 4));
    label.setAttribute("font-size", "10");
    label.setAttribute("fill", "#64748b");
    label.textContent = item.label;
    switchingTimelineEl.appendChild(label);
  }

  switchingTimelineEl.appendChild(axis);
  switchingTimelineEl.appendChild(path);
  switchingTimelineEl.appendChild(yTopLabel);
  switchingTimelineEl.appendChild(yBottomLabel);

  const legendItem = document.createElement("div");
  legendItem.className = "legend-item";
  const swatch = document.createElement("span");
  swatch.className = "legend-color";
  swatch.style.background = "#2563eb";
  const text = document.createElement("span");
  text.textContent = "Blue line = tab switches per 10-minute bucket";
  legendItem.appendChild(swatch);
  legendItem.appendChild(text);
  switchingLegendEl.appendChild(legendItem);
}

function renderRapidLoops(data) {
  const loops = data || {};
  loopMaxEl.textContent = String(loops.maxStreakLength || 0);
  loopAvgEl.textContent = String(loops.averageStreakLength || 0);
  loopCountEl.textContent = String(loops.streakCount || 0);

  loopHistogramEl.innerHTML = "";
  const rows = loops.histogram || [];
  const maxCount = Math.max(1, ...rows.map((item) => item.count || 0));

  for (const item of rows) {
    const row = document.createElement("div");
    row.className = "hist-row";

    const label = document.createElement("span");
    label.textContent = item.label;

    const bar = document.createElement("div");
    bar.className = "hist-bar";
    const fill = document.createElement("div");
    fill.className = "hist-fill";
    fill.style.width = `${((item.count || 0) / maxCount) * 100}%`;
    bar.appendChild(fill);

    const count = document.createElement("span");
    count.textContent = String(item.count || 0);

    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(count);
    loopHistogramEl.appendChild(row);
  }
}

function renderHeatmap(rows, loopHours = []) {
  activityHeatmapEl.innerHTML = "";
  heatmapLegendEl.innerHTML = "";
  if (!rows || rows.length === 0) {
    activityHeatmapEl.textContent = "No data for this period.";
    heatmapLegendEl.textContent = "";
    return;
  }

  const grid = document.createElement("div");
  grid.className = "heatmap-grid";
  let maxValue = 0;
  for (const row of rows) {
    for (const count of row.hourlyCounts) {
      maxValue = Math.max(maxValue, count || 0);
    }
  }
  maxValue = Math.max(1, maxValue);

  const headerSpacer = document.createElement("div");
  headerSpacer.className = "heatmap-cell heatmap-label";
  grid.appendChild(headerSpacer);

  for (let h = 0; h < 24; h += 1) {
    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    cell.textContent = String(h);
    grid.appendChild(cell);
  }

  for (const row of rows) {
    const domainLabel = document.createElement("div");
    domainLabel.className = "heatmap-cell heatmap-label";
    domainLabel.textContent = row.domain;
    grid.appendChild(domainLabel);

    for (let h = 0; h < 24; h += 1) {
      const value = row.hourlyCounts[h] || 0;
      const intensity = value / maxValue;
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      const loopIntensity = Math.max(0, loopHours[h] || 0);
      const isReactiveHour = loopIntensity > 0;
      cell.style.background = isReactiveHour
        ? `rgba(220, 38, 38, ${Math.max(0.12, Math.min(1, loopIntensity / Math.max(1, ...loopHours)))})`
        : `rgba(34, 197, 94, ${Math.max(0.08, intensity)})`;
      cell.title = `${row.domain} @ ${h}:00 = ${value}`;
      cell.textContent = value > 0 ? String(value) : "";
      grid.appendChild(cell);
    }
  }

  activityHeatmapEl.appendChild(grid);

  const low = document.createElement("div");
  low.className = "legend-item";
  low.innerHTML = "<span class='legend-color' style='background: rgba(34,197,94,0.22)'></span><span>Deep work / normal activity</span>";

  const high = document.createElement("div");
  high.className = "legend-item";
  high.innerHTML = "<span class='legend-color' style='background: rgba(220,38,38,0.8)'></span><span>Loop-heavy / fragmented hour</span>";

  heatmapLegendEl.appendChild(low);
  heatmapLegendEl.appendChild(high);
}

async function loadBehavioralAnalytics() {
  try {
    const period = periodSelect.value;
    const bounceThreshold = Math.max(1, Number(bounceThresholdEl.value) || 5);

    const data = await sendMessage({
      type: "GET_BEHAVIORAL_ANALYTICS",
      period,
      bounceThreshold,
    });

    latestBehavioral = data;
    renderRevisitDistribution(data.revisitDistributionTop3 || []);
    renderBouncePairs(data.topBouncePairs || []);
    renderSwitchingTimeline(data.switchingTimeline || []);
    renderRapidLoops(data.rapidLoops || {});
    renderHeatmap(data.heatmap || [], data.loopHours || []);
    refreshBehavioralMirror();
  } catch (error) {
    setStatus(error.message, true);
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
    await loadBehavioralAnalytics();
    setStatus("Data cleared.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

periodSelect.addEventListener("change", async () => {
  await loadStats();
  await loadBehavioralAnalytics();
  await loadTrendAnalytics();
});

bounceThresholdEl.addEventListener("change", () => {
  loadBehavioralAnalytics();
});

if (analyticsFilterEl) {
  analyticsFilterEl.addEventListener("change", () => {
    loadTrendAnalytics();
  });
}

clearPeriodBtn.addEventListener("click", () => clearData(periodSelect.value));
clearAllBtn.addEventListener("click", () => clearData("all"));
if (copyAiExportBtn) {
  copyAiExportBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      setStatus("Preparing AI export...");
      await exportDataForAI();
      setStatus("AI export copied.");
      setCopyButtonTemporaryState("✅ Copied!", "copied-state");
      showToast("📁 Baseline Data Copied! Ready for AI Audit.");
    } catch (error) {
      console.error("Copy Data for AI Analysis failed", error);
      setStatus(error.message, true);
      setCopyButtonTemporaryState("❌ Copy Failed", "error-state");
      showToast("❌ Copy Failed. Check DevTools.", true);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadStats();
  await loadBehavioralAnalytics();
  await loadTrendAnalytics();

  autoRefreshTimer = setInterval(() => {
    loadStats({ silent: true });
  }, AUTO_REFRESH_MS);
});

window.addEventListener("beforeunload", () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
});
