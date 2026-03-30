import { loadAllDatasets } from "./dataLoader.js";
import { buildKpiDataset, getBottomPerformers, getTopPerformers } from "./kpiCalculator.js";
import { getAvailableAgents, getAvailableWeeks, getFilteredRecords, populateSelect } from "./filters.js";
import {
  renderBarChart,
  renderComparisonChart,
  renderContributionChart,
  renderDistributionChart,
  renderImprovementChart,
  renderLineChart,
  renderRankingChart,
  renderStackedBarChart,
  renderTopBottomChart,
  renderVarianceChart,
} from "./charts.js";
import { exportRowsToCsv, initializeTable, renderTable, sortRecords } from "./table.js";

const state = {
  dataset: null,
  filters: { month: "all", week: "all", agent: "all", search: "" },
  sort: { key: "overallScore", direction: "desc" },
  charts: {},
};

const elements = {
  monthFilter: document.querySelector("#monthFilter"),
  weekFilter: document.querySelector("#weekFilter"),
  agentFilter: document.querySelector("#agentFilter"),
  tableSearch: document.querySelector("#tableSearch"),
  resetFilters: document.querySelector("#resetFilters"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  tableHeadRow: document.querySelector("#tableHeadRow"),
  tableBody: document.querySelector("#tableBody"),
  dataStatusText: document.querySelector("#dataStatusText"),
  trendChart: document.querySelector("#trendChart"),
  weekScoreChart: document.querySelector("#weekScoreChart"),
  contributionChart: document.querySelector("#contributionChart"),
  varianceChart: document.querySelector("#varianceChart"),
  transferDistributionChart: document.querySelector("#transferDistributionChart"),
  admitsDistributionChart: document.querySelector("#admitsDistributionChart"),
  ahtDistributionChart: document.querySelector("#ahtDistributionChart"),
  attendanceDistributionChart: document.querySelector("#attendanceDistributionChart"),
  qaDistributionChart: document.querySelector("#qaDistributionChart"),
  rankingChart: document.querySelector("#rankingChart"),
  stackedChart: document.querySelector("#stackedChart"),
  comparisonChart: document.querySelector("#comparisonChart"),
  comparisonTitle: document.querySelector("#comparisonTitle"),
  comparisonSubnote: document.querySelector("#comparisonSubnote"),
  topAgentsChart: document.querySelector("#topAgentsChart"),
  bottomAgentsChart: document.querySelector("#bottomAgentsChart"),
  mostImprovedChart: document.querySelector("#mostImprovedChart"),
  navButtons: [...document.querySelectorAll(".nav-item[data-target]")],
  teamOnlySections: [...document.querySelectorAll("[data-scope='team-only']")],
};

const cardMap = {
  overall: {
    value: document.querySelector("#overallScoreValue"),
    badge: document.querySelector("#overallCardBadge"),
    raw: document.querySelector("#overallScoreRaw"),
    delta: document.querySelector("#overallScoreDelta"),
  },
  transfer: {
    value: document.querySelector("#transferScoreValue"),
    badge: document.querySelector("#transferCardBadge"),
    raw: document.querySelector("#transferScoreRaw"),
    delta: document.querySelector("#transferScoreDelta"),
  },
  admits: {
    value: document.querySelector("#admitsScoreValue"),
    badge: document.querySelector("#admitsCardBadge"),
    raw: document.querySelector("#admitsScoreRaw"),
    delta: document.querySelector("#admitsScoreDelta"),
  },
  aht: {
    value: document.querySelector("#ahtScoreValue"),
    badge: document.querySelector("#ahtCardBadge"),
    raw: document.querySelector("#ahtScoreRaw"),
    delta: document.querySelector("#ahtScoreDelta"),
  },
  attendance: {
    value: document.querySelector("#attendanceScoreValue"),
    badge: document.querySelector("#attendanceCardBadge"),
    raw: document.querySelector("#attendanceScoreRaw"),
    delta: document.querySelector("#attendanceScoreDelta"),
  },
  qa: {
    value: document.querySelector("#qaScoreValue"),
    badge: document.querySelector("#qaCardBadge"),
    raw: document.querySelector("#qaScoreRaw"),
    delta: document.querySelector("#qaScoreDelta"),
  },
};

const rawMetricMap = {
  transferRate: document.querySelector("#avgTransferRateValue"),
  admitsCount: document.querySelector("#avgAdmitsCountValue"),
  aht: document.querySelector("#avgAhtValue"),
  attendance: document.querySelector("#avgAttendanceValue"),
  qa: document.querySelector("#avgQaValue"),
  agents: document.querySelector("#avgAgentsValue"),
  transferRateDelta: document.querySelector("#avgTransferRateDelta"),
  admitsCountDelta: document.querySelector("#avgAdmitsCountDelta"),
  ahtDelta: document.querySelector("#avgAhtDelta"),
  attendanceDelta: document.querySelector("#avgAttendanceDelta"),
  qaDelta: document.querySelector("#avgQaDelta"),
  agentsDelta: document.querySelector("#avgAgentsDelta"),
};

function scoreClassName(score) {
  if (score === null || score === undefined || Number.isNaN(score)) return "score-na";
  return `score-${Math.max(1, Math.min(5, Math.round(score)))}`;
}

function formatScore(score) {
  if (score === null || score === undefined || Number.isNaN(score)) return "N/A";
  return Number(score).toFixed(2);
}

function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${Number(value).toFixed(digits)}%`;
}

function formatTimeFromSeconds(seconds) {
  if (!seconds) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function averageField(records, field) {
  const valid = records
    .map((record) => record[field])
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function getSummaryMetrics(records) {
  if (!records.length) return null;
  return {
    transferScore: averageField(records, "transferScore"),
    admitsScore: averageField(records, "admitsScore"),
    ahtScore: averageField(records, "ahtScore"),
    attendanceScore: averageField(records, "attendanceScore"),
    qaScore: averageField(records, "qaScore"),
    performanceScore: averageField(records, "performanceScore"),
    overallScore: averageField(records, "overallScore"),
    transferRatePercent: averageField(records, "transferRatePercent"),
    admitsCount: averageField(records, "admitsCount"),
    ahtSeconds: averageField(records, "ahtSeconds"),
    attendancePercentValue: averageField(records, "attendancePercentValue"),
    qaPercentValue: averageField(records, "qaPercentValue"),
    agentCount: new Set(records.map((record) => record.agentName)).size,
  };
}

function getScopedWeeklyAverages(records) {
  const weekMap = new Map();
  records.forEach((record) => {
    const bucket = weekMap.get(record.weekEnding) || [];
    bucket.push(record);
    weekMap.set(record.weekEnding, bucket);
  });

  return [...weekMap.entries()]
    .map(([weekEnding, items]) => ({
      weekEnding,
      weekDate: items[0]?.weekDate,
      transferScore: averageField(items, "transferScore"),
      admitsScore: averageField(items, "admitsScore"),
      ahtScore: averageField(items, "ahtScore"),
      attendanceScore: averageField(items, "attendanceScore"),
      qaScore: averageField(items, "qaScore"),
      performanceScore: averageField(items, "performanceScore"),
      overallScore: averageField(items, "overallScore"),
      transferRatePercent: averageField(items, "transferRatePercent"),
      admitsCount: averageField(items, "admitsCount"),
      ahtSeconds: averageField(items, "ahtSeconds"),
      attendancePercentValue: averageField(items, "attendancePercentValue"),
      qaPercentValue: averageField(items, "qaPercentValue"),
    }))
    .sort((left, right) => (left.weekDate?.getTime() ?? 0) - (right.weekDate?.getTime() ?? 0));
}

function pickWeekSummary(filteredRecords, weeklyAverages) {
  if (!weeklyAverages.length) {
    return {
      transferScore: 0,
      admitsScore: 0,
      ahtScore: 0,
      attendanceScore: 0,
      qaScore: 0,
      performanceScore: 0,
      overallScore: 0,
      transferRatePercent: null,
      admitsCount: null,
      ahtSeconds: null,
      attendancePercentValue: null,
      qaPercentValue: null,
      weekEnding: "No Data",
    };
  }

  if (state.filters.week !== "all") {
    return weeklyAverages.find((item) => item.weekEnding === state.filters.week) || weeklyAverages.at(-1);
  }

  if (filteredRecords.length) {
    const latestWeek = [...filteredRecords]
      .sort((left, right) => (left.weekDate?.getTime() ?? 0) - (right.weekDate?.getTime() ?? 0))
      .at(-1)?.weekEnding;
    return weeklyAverages.find((item) => item.weekEnding === latestWeek) || weeklyAverages.at(-1);
  }

  return weeklyAverages.at(-1);
}

function getComparisonWeeklyAverages(weeklyAverages) {
  if (!weeklyAverages.length) return [];
  if (weeklyAverages.length === 1) return weeklyAverages;

  if (state.filters.week !== "all") {
    const selectedIndex = weeklyAverages.findIndex((item) => item.weekEnding === state.filters.week);
    if (selectedIndex === -1) return weeklyAverages.slice(-2);
    if (selectedIndex === 0) return [weeklyAverages[0]];
    return [weeklyAverages[selectedIndex - 1], weeklyAverages[selectedIndex]];
  }

  return weeklyAverages.slice(-2);
}

function getMostImprovedAgents(records, comparisonWeeklyAverages, limit = 5) {
  if (comparisonWeeklyAverages.length < 2) return [];

  const previousWeek = comparisonWeeklyAverages[0]?.weekEnding;
  const currentWeek = comparisonWeeklyAverages.at(-1)?.weekEnding;
  if (!previousWeek || !currentWeek) return [];

  const previousByAgent = new Map();
  const currentByAgent = new Map();

  records.forEach((record) => {
    if (record.weekEnding === previousWeek) previousByAgent.set(record.agentName, record);
    if (record.weekEnding === currentWeek) currentByAgent.set(record.agentName, record);
  });

  return [...currentByAgent.entries()]
    .map(([agentName, currentRecord]) => {
      const previousRecord = previousByAgent.get(agentName);
      if (!previousRecord) return null;
      if (
        typeof currentRecord.overallScore !== "number" ||
        Number.isNaN(currentRecord.overallScore) ||
        typeof previousRecord.overallScore !== "number" ||
        Number.isNaN(previousRecord.overallScore)
      ) {
        return null;
      }

      return {
        agentName,
        delta: currentRecord.overallScore - previousRecord.overallScore,
        currentOverallScore: currentRecord.overallScore,
        previousOverallScore: previousRecord.overallScore,
      };
    })
    .filter((record) => record && record.delta > 0)
    .sort((left, right) => right.delta - left.delta)
    .slice(0, limit);
}

function buildDeltaMarkup(current, previous) {
  if (previous === null || previous === undefined) {
    return '<span class="delta-flat">Flat</span> No previous week available';
  }
  const delta = current - previous;
  if (delta > 0) return `<span class="delta-up">Up</span> ${Math.abs(delta).toFixed(2)} vs previous week`;
  if (delta < 0) return `<span class="delta-down">Down</span> ${Math.abs(delta).toFixed(2)} vs previous week`;
  return '<span class="delta-flat">Flat</span> 0.00 vs previous week';
}

function buildTextDelta(current, previous, formatter) {
  if (current === null || current === undefined) return "Vs previous week unavailable";
  if (previous === null || previous === undefined) return "Vs previous week unavailable";
  return `${formatter(current)} vs ${formatter(previous)} previous week`;
}

function updateRawCards(metrics) {
  if (!metrics) {
    Object.values(rawMetricMap).forEach((element) => {
      element.textContent = "--";
    });
    return;
  }

  rawMetricMap.transferRate.textContent = formatPercent(metrics.transferRatePercent);
  rawMetricMap.admitsCount.textContent =
    metrics.admitsCount === null || metrics.admitsCount === undefined ? "N/A" : metrics.admitsCount.toFixed(2);
  rawMetricMap.aht.textContent = formatTimeFromSeconds(metrics.ahtSeconds);
  rawMetricMap.attendance.textContent = formatPercent(metrics.attendancePercentValue);
  rawMetricMap.qa.textContent = formatPercent(metrics.qaPercentValue);
  rawMetricMap.agents.textContent = String(metrics.agentCount);
}

function updateRawDeltas(currentSummary, previousSummary) {
  rawMetricMap.transferRateDelta.textContent = buildTextDelta(
    currentSummary?.transferRatePercent,
    previousSummary?.transferRatePercent,
    (value) => formatPercent(value)
  );
  rawMetricMap.admitsCountDelta.textContent = buildTextDelta(
    currentSummary?.admitsCount,
    previousSummary?.admitsCount,
    (value) => Number(value).toFixed(2)
  );
  rawMetricMap.ahtDelta.textContent = buildTextDelta(
    currentSummary?.ahtSeconds,
    previousSummary?.ahtSeconds,
    (value) => formatTimeFromSeconds(value)
  );
  rawMetricMap.attendanceDelta.textContent = buildTextDelta(
    currentSummary?.attendancePercentValue,
    previousSummary?.attendancePercentValue,
    (value) => formatPercent(value)
  );
  rawMetricMap.qaDelta.textContent = buildTextDelta(
    currentSummary?.qaPercentValue,
    previousSummary?.qaPercentValue,
    (value) => formatPercent(value)
  );
  rawMetricMap.agentsDelta.textContent = buildTextDelta(
    currentSummary?.agentCount,
    previousSummary?.agentCount,
    (value) => `${Math.round(value)} agents`
  );
}

function updateSummaryCards(filteredRecords, weeklyAverages) {
  const metrics = getSummaryMetrics(filteredRecords);
  updateRawCards(metrics);

  if (!metrics) {
    Object.values(cardMap).forEach((card) => {
      card.value.textContent = "--";
      card.badge.textContent = "-";
      card.badge.className = "score-chip";
      card.raw.textContent = "No data for the selected filters";
      card.delta.innerHTML = "No data for the selected filters";
    });
    return;
  }

  const currentWeekSummary = pickWeekSummary(filteredRecords, weeklyAverages);
  const currentIndex = weeklyAverages.findIndex((item) => item.weekEnding === currentWeekSummary.weekEnding);
  const previousWeekSummary = currentIndex > 0 ? weeklyAverages[currentIndex - 1] : null;
  updateRawDeltas(currentWeekSummary, previousWeekSummary);

  const rawText = {
    overall: `Performance ${formatScore(metrics.performanceScore)} x 50% | Attendance ${formatScore(metrics.attendanceScore)} x 25% | QA ${formatScore(metrics.qaScore)} x 25%`,
    transfer: `Avg transfer rate: ${formatPercent(metrics.transferRatePercent)}`,
    admits: `Avg admits count: ${metrics.admitsCount === null || metrics.admitsCount === undefined ? "N/A" : metrics.admitsCount.toFixed(2)}`,
    aht: `Avg handle time: ${formatTimeFromSeconds(metrics.ahtSeconds)}`,
    attendance: `Avg attendance: ${formatPercent(metrics.attendancePercentValue)}`,
    qa: `Avg QA: ${formatPercent(metrics.qaPercentValue)}`,
  };

  [
    ["overall", "overallScore"],
    ["transfer", "transferScore"],
    ["admits", "admitsScore"],
    ["aht", "ahtScore"],
    ["attendance", "attendanceScore"],
    ["qa", "qaScore"],
  ].forEach(([cardKey, metricKey]) => {
    const score = metrics[metricKey];
    const card = cardMap[cardKey];
    card.value.textContent = formatScore(score);
    card.badge.textContent =
      score === null || score === undefined || Number.isNaN(score) ? "N/A" : Math.round(score);
    card.badge.className = `score-chip ${scoreClassName(score)}`;
    card.value.closest(".summary-card")?.setAttribute("data-kpi", cardKey);
    card.raw.textContent = rawText[cardKey];
    card.delta.innerHTML = buildDeltaMarkup(currentWeekSummary[metricKey], previousWeekSummary?.[metricKey]);
  });
}

function syncFilterOptions() {
  populateSelect(elements.monthFilter, state.dataset.monthOptions, "All Months");

  const weekOptions = getAvailableWeeks(state.dataset.records, state.filters.month);
  populateSelect(elements.weekFilter, weekOptions, "All Weeks");
  if (!weekOptions.includes(state.filters.week)) state.filters.week = "all";

  const agentOptions = getAvailableAgents(state.dataset.records, state.filters.month, state.filters.week);
  populateSelect(elements.agentFilter, agentOptions, "All Agents");
  if (!agentOptions.includes(state.filters.agent)) state.filters.agent = "all";

  elements.monthFilter.value = state.filters.month;
  elements.weekFilter.value = state.filters.week;
  elements.agentFilter.value = state.filters.agent;
}

function updateCharts(filteredRecords, weeklyAverages, scopedRecords) {
  const weekSummary = pickWeekSummary(filteredRecords, weeklyAverages);
  const chartRecords =
    state.filters.week === "all"
      ? filteredRecords.filter((record) => record.weekEnding === weekSummary.weekEnding)
      : filteredRecords;

  const comparisonWeeklyAverages = getComparisonWeeklyAverages(weeklyAverages);

  if (elements.comparisonTitle && elements.comparisonSubnote) {
    const selectedWeek = comparisonWeeklyAverages.at(-1)?.weekEnding || "Selected Week";
    const previousWeek = comparisonWeeklyAverages.length > 1 ? comparisonWeeklyAverages[0]?.weekEnding : "No previous week";
    elements.comparisonTitle.textContent = "Selected week vs previous week";
    elements.comparisonSubnote.textContent =
      comparisonWeeklyAverages.length > 1
        ? `${selectedWeek} compared against ${previousWeek}.`
        : `${selectedWeek} has no previous week available for comparison.`;
  }

  state.charts.trend = renderLineChart(elements.trendChart, state.charts.trend, weeklyAverages);
  state.charts.weekScore = renderBarChart(elements.weekScoreChart, state.charts.weekScore, weekSummary);
  state.charts.contribution = renderContributionChart(elements.contributionChart, state.charts.contribution, weekSummary);
  state.charts.variance = renderVarianceChart(elements.varianceChart, state.charts.variance, comparisonWeeklyAverages);
  state.charts.transferDistribution = renderDistributionChart(
    elements.transferDistributionChart,
    state.charts.transferDistribution,
    chartRecords,
    "transferScore",
    "Transfer Distribution",
    "#3B82F6"
  );
  state.charts.admitsDistribution = renderDistributionChart(
    elements.admitsDistributionChart,
    state.charts.admitsDistribution,
    chartRecords,
    "admitsScore",
    "Admits Distribution",
    "#10B981"
  );
  state.charts.ahtDistribution = renderDistributionChart(
    elements.ahtDistributionChart,
    state.charts.ahtDistribution,
    chartRecords,
    "ahtScore",
    "AHT Distribution",
    "#F59E0B"
  );
  state.charts.attendanceDistribution = renderDistributionChart(
    elements.attendanceDistributionChart,
    state.charts.attendanceDistribution,
    chartRecords,
    "attendanceScore",
    "Attendance Distribution",
    "#8B5CF6"
  );
  state.charts.qaDistribution = renderDistributionChart(
    elements.qaDistributionChart,
    state.charts.qaDistribution,
    chartRecords,
    "qaScore",
    "QA Distribution",
    "#EC4899"
  );
  state.charts.ranking = renderRankingChart(elements.rankingChart, state.charts.ranking, chartRecords);
  state.charts.stacked = renderStackedBarChart(elements.stackedChart, state.charts.stacked, chartRecords);
  state.charts.comparison = renderComparisonChart(
    elements.comparisonChart,
    state.charts.comparison,
    comparisonWeeklyAverages
  );
  state.charts.top = renderTopBottomChart(elements.topAgentsChart, state.charts.top, getTopPerformers(chartRecords), "Top 5 Overall Score");
  state.charts.bottom = renderTopBottomChart(elements.bottomAgentsChart, state.charts.bottom, getBottomPerformers(chartRecords), "Bottom 5 Overall Score");
  state.charts.improved = renderImprovementChart(
    elements.mostImprovedChart,
    state.charts.improved,
    getMostImprovedAgents(scopedRecords, comparisonWeeklyAverages)
  );
}

function updateTable(filteredRecords) {
  initializeTable(elements.tableHeadRow, handleSortChange, state.sort);
  renderTable(elements.tableBody, sortRecords(filteredRecords, state.sort));
}

function updateStatus(filteredRecords) {
  const totalAgents = new Set(filteredRecords.map((record) => record.agentName)).size;
  const totalWeeks = new Set(filteredRecords.map((record) => record.weekEnding)).size;
  elements.dataStatusText.textContent = `${filteredRecords.length} score rows across ${totalAgents} agents and ${totalWeeks} weeks.`;
}

function updateLayoutVisibility() {
  const isAgentView = state.filters.agent !== "all";
  elements.teamOnlySections.forEach((section) => {
    section.classList.toggle("is-hidden", isAgentView);
  });
}

function updateDashboard() {
  const dashboardRecords = getFilteredRecords(state.dataset.records, { ...state.filters, search: "" });
  const tableRecords = getFilteredRecords(state.dataset.records, state.filters);
  const trendRecords = getFilteredRecords(state.dataset.records, {
    ...state.filters,
    week: "all",
    search: "",
  });
  const weeklyAverages = getScopedWeeklyAverages(trendRecords);

  updateSummaryCards(dashboardRecords, weeklyAverages);
  updateCharts(dashboardRecords, weeklyAverages, trendRecords);
  updateTable(tableRecords);
  updateStatus(dashboardRecords);
  updateLayoutVisibility();
}

function handleSortChange(key) {
  if (state.sort.key === key) {
    state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
  } else {
    state.sort.key = key;
    state.sort.direction = key === "agentName" || key === "weekEnding" ? "asc" : "desc";
  }
  updateTable(getFilteredRecords(state.dataset.records, state.filters));
}

function bindNavigation() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      elements.navButtons.forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      document.getElementById(button.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindEvents() {
  elements.monthFilter.addEventListener("change", (event) => {
    state.filters.month = event.target.value;
    syncFilterOptions();
    updateDashboard();
  });

  elements.weekFilter.addEventListener("change", (event) => {
    state.filters.week = event.target.value;
    syncFilterOptions();
    updateDashboard();
  });

  elements.agentFilter.addEventListener("change", (event) => {
    state.filters.agent = event.target.value;
    updateDashboard();
  });

  elements.tableSearch.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    updateDashboard();
  });

  elements.resetFilters.addEventListener("click", () => {
    state.filters = {
      month: state.dataset.monthOptions.at(-1) || "all",
      week: state.dataset.weekOptions.at(-1) || "all",
      agent: "all",
      search: "",
    };
    elements.tableSearch.value = "";
    syncFilterOptions();
    updateDashboard();
  });

  elements.exportCsvButton.addEventListener("click", () => {
    const filteredRecords = sortRecords(getFilteredRecords(state.dataset.records, state.filters), state.sort);
    exportRowsToCsv(filteredRecords);
  });
}

async function init() {
  try {
    elements.dataStatusText.textContent = "Loading Google Sheets data and calculating KPI scores.";
    const rawDatasets = await loadAllDatasets();
    state.dataset = buildKpiDataset(rawDatasets);
    state.filters.month = state.dataset.monthOptions.at(-1) || "all";
    state.filters.week = state.dataset.weekOptions.at(-1) || "all";

    syncFilterOptions();
    bindNavigation();
    bindEvents();
    updateDashboard();
  } catch (error) {
    console.error(error);
    elements.dataStatusText.textContent = "The dashboard could not load the CSV sources. Check the published sheet permissions and try again.";
    elements.tableBody.innerHTML = '<tr><td colspan="14"><div class="status-message">Unable to load dashboard data.</div></td></tr>';
  }
}

init();
