const periodSelect = document.getElementById("period");
const totalTimeEl = document.getElementById("total-time");
const uniqueSitesEl = document.getElementById("unique-sites");
const maxSiteEl = document.getElementById("max-site");
const topSitesListEl = document.getElementById("top-sites-list");
const studyStatusCardEl = document.getElementById("study-status-card");
const studyTotalTimeEl = document.getElementById("study-total-time");
const studySessionCountEl = document.getElementById("study-session-count");
const studyDistractingTimeEl = document.getElementById("study-distracting-time");
const studyFocusRatioEl = document.getElementById("study-focus-ratio");
const studySwitchCountEl = document.getElementById("study-switch-count");
const studyDoomscrollTimeEl = document.getElementById("study-doomscroll-time");
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

const clearPeriodBtn = document.getElementById("clear-period");
const clearAllBtn = document.getElementById("clear-all");
const statusEl = document.getElementById("status");

const AUTO_REFRESH_MS = 5000;
let autoRefreshTimer = null;
let isStatsLoading = false;

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

    renderTopSites(data.topSites);
    renderStudyMode(data.studyMode, data.studyStatus);
    renderThoughtPause(data.thoughtPause);
    renderLoopPromptPanel(data.loopPrompts);

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

function renderHeatmap(rows) {
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
      cell.style.background = `rgba(37, 99, 235, ${Math.max(0.08, intensity)})`;
      cell.title = `${row.domain} @ ${h}:00 = ${value}`;
      cell.textContent = value > 0 ? String(value) : "";
      grid.appendChild(cell);
    }
  }

  activityHeatmapEl.appendChild(grid);

  const low = document.createElement("div");
  low.className = "legend-item";
  low.innerHTML = "<span class='legend-color' style='background: rgba(37,99,235,0.12)'></span><span>Low activity</span>";

  const high = document.createElement("div");
  high.className = "legend-item";
  high.innerHTML = "<span class='legend-color' style='background: rgba(37,99,235,1)'></span><span>High activity</span>";

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

    renderRevisitDistribution(data.revisitDistributionTop3 || []);
    renderBouncePairs(data.topBouncePairs || []);
    renderSwitchingTimeline(data.switchingTimeline || []);
    renderRapidLoops(data.rapidLoops || {});
    renderHeatmap(data.heatmap || []);
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
});

bounceThresholdEl.addEventListener("change", () => {
  loadBehavioralAnalytics();
});

clearPeriodBtn.addEventListener("click", () => clearData(periodSelect.value));
clearAllBtn.addEventListener("click", () => clearData("all"));

document.addEventListener("DOMContentLoaded", async () => {
  await loadStats();
  await loadBehavioralAnalytics();

  autoRefreshTimer = setInterval(() => {
    loadStats({ silent: true });
  }, AUTO_REFRESH_MS);
});

window.addEventListener("beforeunload", () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
});
