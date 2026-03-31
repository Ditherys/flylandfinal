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
import { exportRowsToCsv, initializeTable, renderTable, renderTableSummary, sortRecords } from "./table.js";

const state = {
  dataset: null,
  filters: { month: "all", week: "all", agent: "all", search: "" },
  sort: { key: "overallScore", direction: "desc" },
  selectedRowKey: null,
  mobileSidebarOpen: false,
  mobileTableExpanded: true,
  mobileFiltersExpanded: false,
  floatingLegendOpen: false,
  distributionDrilldownOpen: false,
  distributionDrilldownExpanded: false,
  distributionDrilldownDetail: null,
  resizeRaf: null,
  charts: {},
};

const KPI_DEFINITIONS = [
  {
    key: "transferScore",
    label: "Transfer",
    raw: (summary) => `Transfer rate ${formatPercent(summary.transferRatePercent)}`,
  },
  {
    key: "admitsScore",
    label: "Admits",
    raw: (summary) =>
      `Admits count ${
        summary.admitsCount === null || summary.admitsCount === undefined ? "N/A" : Number(summary.admitsCount).toFixed(2)
      }`,
  },
  {
    key: "ahtScore",
    label: "AHT",
    raw: (summary) => `Average handle time ${formatTimeFromSeconds(summary.ahtSeconds)}`,
  },
  {
    key: "attendanceScore",
    label: "Attendance",
    raw: (summary) => `Attendance ${formatPercent(summary.attendancePercentValue)}`,
  },
  {
    key: "qaScore",
    label: "QA",
    raw: (summary) => `QA ${formatPercent(summary.qaPercentValue)}`,
  },
];

const elements = {
  mobileSidebar: document.querySelector("#mobileSidebarPanel"),
  mobileMenuToggle: document.querySelector("#mobileMenuToggle"),
  mobileTableToggle: document.querySelector("#mobileTableToggle"),
  mobileLegendLauncher: document.querySelector("#mobileLegendLauncher"),
  mobileFiltersLauncher: document.querySelector("#mobileFiltersLauncher"),
  mobileStatusMonth: document.querySelector("#mobileStatusMonth"),
  mobileStatusWeek: document.querySelector("#mobileStatusWeek"),
  mobileStatusScope: document.querySelector("#mobileStatusScope"),
  mobileHomeButtons: [...document.querySelectorAll("[data-mobile-target]")],
  mobileBottomNavButtons: [...document.querySelectorAll(".mobile-bottom-nav-button[data-mobile-action]")],
  summaryCardsList: [...document.querySelectorAll(".summary-card")],
  mobileDistributionButtons: [...document.querySelectorAll(".distribution-mobile-chip[data-distribution-panel]")],
  mobileDistributionItems: [...document.querySelectorAll("[data-distribution-item]")],
  mobileMorePanel: document.querySelector("#mobileMorePanel"),
  mobileMoreClose: document.querySelector("#mobileMoreClose"),
  mobileMoreLegend: document.querySelector("#mobileMoreLegend"),
  mobileMoreFilters: document.querySelector("#mobileMoreFilters"),
  mobileMoreExport: document.querySelector("#mobileMoreExport"),
  mobileMoreReset: document.querySelector("#mobileMoreReset"),
  floatingLegendToggle: document.querySelector("#floatingLegendToggle"),
  floatingLegendPanel: document.querySelector("#floatingLegendPanel"),
  floatingLegendClose: document.querySelector("#floatingLegendClose"),
  floatingLegendContent: document.querySelector("#floatingLegendContent"),
  distributionDrilldownPanel: document.querySelector("#distributionDrilldownPanel"),
  distributionDrilldownClose: document.querySelector("#distributionDrilldownClose"),
  distributionDrilldownTitle: document.querySelector("#distributionDrilldownTitle"),
  distributionDrilldownSubnote: document.querySelector("#distributionDrilldownSubnote"),
  distributionDrilldownList: document.querySelector("#distributionDrilldownList"),
  legendPanel: document.querySelector(".legend-panel"),
  monthFilter: document.querySelector("#monthFilter"),
  weekFilter: document.querySelector("#weekFilter"),
  agentFilter: document.querySelector("#agentFilter"),
  tableSearch: document.querySelector("#tableSearch"),
  resetFilters: document.querySelector("#resetFilters"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  filtersCollapseToggle: document.querySelector("#filtersCollapseToggle"),
  filtersContentArea: document.querySelector("#filtersContentArea"),
  tableCollapseToggle: document.querySelector("#tableCollapseToggle"),
  tableContentArea: document.querySelector("#tableContentArea"),
  tableSummaryStrip: document.querySelector("#tableSummaryStrip"),
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
  rankingSubnote: document.querySelector("#rankingSubnote"),
  topAgentsChart: document.querySelector("#topAgentsChart"),
  bottomAgentsChart: document.querySelector("#bottomAgentsChart"),
  mostImprovedChart: document.querySelector("#mostImprovedChart"),
  viewInsightTitle: document.querySelector("#viewInsightTitle"),
  viewInsightBody: document.querySelector("#viewInsightBody"),
  bestInsightTitle: document.querySelector("#bestInsightTitle"),
  bestInsightBody: document.querySelector("#bestInsightBody"),
  watchInsightTitle: document.querySelector("#watchInsightTitle"),
  watchInsightBody: document.querySelector("#watchInsightBody"),
  momentumInsightTitle: document.querySelector("#momentumInsightTitle"),
  momentumInsightBody: document.querySelector("#momentumInsightBody"),
  agentFocusName: document.querySelector("#agentFocusName"),
  agentFocusNarrative: document.querySelector("#agentFocusNarrative"),
  agentOverallValue: document.querySelector("#agentOverallValue"),
  agentOverallNarrative: document.querySelector("#agentOverallNarrative"),
  agentStrongestValue: document.querySelector("#agentStrongestValue"),
  agentStrongestNarrative: document.querySelector("#agentStrongestNarrative"),
  agentWeakestValue: document.querySelector("#agentWeakestValue"),
  agentWeakestNarrative: document.querySelector("#agentWeakestNarrative"),
  navButtons: [...document.querySelectorAll(".nav-item[data-target]")],
  teamOnlySections: [...document.querySelectorAll("[data-scope='team-only']")],
  agentOnlySections: [...document.querySelectorAll("[data-scope='agent-only']")],
};

state.mobileMoreOpen = false;
state.mobileDistributionPanel = "transfer";

function setMobileDockActive(action) {
  elements.mobileBottomNavButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mobileAction === action);
  });
}

function triggerMobileAction(action) {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 720;
  if (!isMobile) return;

  if (action === "more") {
    state.mobileMoreOpen = !state.mobileMoreOpen;
    applyMobileMoreState();
    setMobileDockActive(action);
    return;
  }

  state.mobileMoreOpen = false;
  applyMobileMoreState();

  state.floatingLegendOpen = false;
  applyFloatingLegendState();

  if (action === "table") {
    state.mobileTableExpanded = true;
    applyMobileUiState();
    document.getElementById("tableSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileDockActive(action);
    return;
  }

  if (action === "filters") {
    state.mobileFiltersExpanded = true;
    applyMobileUiState();
    document.getElementById("filtersSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileDockActive(action);
    return;
  }

  if (action === "summary") {
    const summaryTarget = state.filters.agent === "all" ? "summaryCards" : "agentFocusSection";
    document.getElementById(summaryTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileDockActive(action);
    return;
  }

  if (action === "agents") {
    const agentsTarget = state.filters.agent === "all" ? "agentsSection" : "agentFocusSection";
    document.getElementById(agentsTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileDockActive(action);
    return;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("dashboardTop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setMobileDockActive("home");
}

function applyMobileUiState() {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 720;

  elements.mobileSidebar?.classList.toggle("is-mobile-open", isMobile && state.mobileSidebarOpen);
  elements.mobileMenuToggle?.setAttribute("aria-expanded", String(isMobile && state.mobileSidebarOpen));
  if (elements.mobileMenuToggle) {
    elements.mobileMenuToggle.textContent = isMobile && state.mobileSidebarOpen ? "Close" : "Menu";
  }

  elements.tableContentArea?.classList.toggle("is-collapsed-mobile", isMobile && !state.mobileTableExpanded);
  elements.tableCollapseToggle?.setAttribute("aria-expanded", String(!isMobile || state.mobileTableExpanded));
  elements.mobileTableToggle?.setAttribute("aria-expanded", String(!isMobile || state.mobileTableExpanded));
  if (elements.tableCollapseToggle) {
    elements.tableCollapseToggle.textContent = !isMobile || state.mobileTableExpanded ? "Collapse Table" : "Expand Table";
  }
  if (elements.mobileTableToggle) {
    elements.mobileTableToggle.textContent = !isMobile || state.mobileTableExpanded ? "Hide Table" : "Show Table";
  }

  elements.filtersContentArea?.classList.toggle("is-collapsed-mobile", isMobile && !state.mobileFiltersExpanded);
  elements.filtersCollapseToggle?.setAttribute("aria-expanded", String(!isMobile || state.mobileFiltersExpanded));
  if (elements.filtersCollapseToggle) {
    elements.filtersCollapseToggle.textContent = !isMobile || state.mobileFiltersExpanded ? "Hide Filters" : "Show Filters";
  }

  if (!isMobile) {
    state.mobileMoreOpen = false;
    elements.summaryCardsList.forEach((card) => {
      card.classList.remove("is-mobile-expanded");
      card.setAttribute("aria-expanded", "false");
    });
    setMobileDockActive("home");
  }
}

function applyMobileMoreState() {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 720;
  elements.mobileMorePanel?.classList.toggle("is-open", isMobile && state.mobileMoreOpen);
  elements.mobileMorePanel?.setAttribute("aria-hidden", String(!(isMobile && state.mobileMoreOpen)));
}

function applyMobileDistributionState() {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 720;
  elements.mobileDistributionButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.distributionPanel === state.mobileDistributionPanel);
  });
  elements.mobileDistributionItems.forEach((item) => {
    item.classList.toggle(
      "is-mobile-active",
      !isMobile || item.dataset.distributionItem === state.mobileDistributionPanel
    );
  });
}

function bindSummaryCardInteractions() {
  elements.summaryCardsList.forEach((card) => {
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-expanded", "false");

    const toggleCard = () => {
      const isMobile = typeof window !== "undefined" && window.innerWidth <= 720;
      if (!isMobile) return;

      const willExpand = !card.classList.contains("is-mobile-expanded");
      elements.summaryCardsList.forEach((item) => {
        item.classList.remove("is-mobile-expanded");
        item.setAttribute("aria-expanded", "false");
      });

      if (willExpand) {
        card.classList.add("is-mobile-expanded");
        card.setAttribute("aria-expanded", "true");
      }
    };

    card.addEventListener("click", toggleCard);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCard();
      }
    });
  });
}

function resetDashboardFilters() {
  state.filters = {
    month: state.dataset.monthOptions.at(-1) || "all",
    week: state.dataset.weekOptions.at(-1) || "all",
    agent: "all",
    search: "",
  };
  state.selectedRowKey = null;
  elements.tableSearch.value = "";
  syncFilterOptions();
  updateDashboard();
}

function bindMobileScrollSpy() {
  const sectionMap = [
    { action: "home", title: "Dashboard Home", getElement: () => document.getElementById("dashboardTop") },
    { action: "summary", title: state.filters.agent === "all" ? "KPI Scorecards" : "Agent Focus", getElement: () => document.getElementById(state.filters.agent === "all" ? "summaryCards" : "agentFocusSection") },
    { action: "agents", title: state.filters.agent === "all" ? "Agent Insights" : "Agent Focus", getElement: () => document.getElementById(state.filters.agent === "all" ? "agentsSection" : "agentFocusSection") },
    { action: "table", title: "Team Table", getElement: () => document.getElementById("tableSection") },
  ];

  const updateActiveByScroll = () => {
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 720;
    if (!isMobile || state.mobileMoreOpen) return;

    const threshold = window.innerHeight * 0.28;
    let activeAction = "home";
    let activeTitle = "Dashboard Home";

    sectionMap.forEach(({ action, title, getElement }) => {
      const element = getElement();
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.top <= threshold) {
        activeAction = action;
        activeTitle = title;
      }
    });

    setMobileDockActive(activeAction);
  };

  window.addEventListener("scroll", updateActiveByScroll, { passive: true });
  updateActiveByScroll();
}

function applyFloatingLegendState() {
  elements.floatingLegendPanel?.classList.toggle("is-open", state.floatingLegendOpen);
  elements.floatingLegendPanel?.setAttribute("aria-hidden", String(!state.floatingLegendOpen));
  elements.floatingLegendToggle?.setAttribute("aria-expanded", String(state.floatingLegendOpen));
}

function applyDistributionDrilldownState() {
  elements.distributionDrilldownPanel?.classList.toggle("is-open", state.distributionDrilldownOpen);
  elements.distributionDrilldownPanel?.setAttribute("aria-hidden", String(!state.distributionDrilldownOpen));
}

function renderDistributionDrilldownContent() {
  if (!elements.distributionDrilldownList || !elements.distributionDrilldownTitle || !elements.distributionDrilldownSubnote) {
    return;
  }

  const detail = state.distributionDrilldownDetail;
  if (!detail) return;

  elements.distributionDrilldownTitle.textContent = `${detail.label} | Score ${detail.score}`;
  elements.distributionDrilldownSubnote.textContent = `${detail.count} agent(s) in this bucket out of ${detail.total} scored agents.`;
  if (!detail.agents.length) {
    elements.distributionDrilldownList.innerHTML =
      '<div class="distribution-drilldown-empty">No agents found in this score bucket.</div>';
    return;
  }

  const previewLimit = 4;
  const visibleAgents = state.distributionDrilldownExpanded ? detail.agents : detail.agents.slice(0, previewLimit);
  const remainingCount = Math.max(detail.agents.length - visibleAgents.length, 0);

  elements.distributionDrilldownList.innerHTML = [
    ...visibleAgents.map((agent) => `<div class="distribution-drilldown-item">${agent}</div>`),
    !state.distributionDrilldownExpanded && remainingCount > 0
      ? `<button class="distribution-drilldown-more" type="button">Show ${remainingCount} more agent(s)</button>`
      : "",
  ].join("");
}

function openDistributionDrilldown(detail) {
  state.distributionDrilldownOpen = true;
  state.distributionDrilldownExpanded = false;
  state.distributionDrilldownDetail = detail;
  renderDistributionDrilldownContent();
  applyDistributionDrilldownState();
}

function initializeFloatingLegend() {
  if (!elements.legendPanel || !elements.floatingLegendContent) return;
  elements.floatingLegendContent.innerHTML = elements.legendPanel.innerHTML;
}

function initializeMobileDefaults() {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 720;
  state.mobileTableExpanded = !isMobile;
  state.mobileFiltersExpanded = !isMobile;
  state.mobileSidebarOpen = false;
}

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
  const selector = typeof field === "function"
    ? field
    : (record) => String(field)
      .split(".")
      .reduce((value, key) => value?.[key], record);
  const valid = records
    .map((record) => selector(record))
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function formatSignedDelta(delta) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return "N/A";
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${Number(delta).toFixed(2)}`;
}

function getRankedKpis(summary) {
  if (!summary) return [];
  return KPI_DEFINITIONS
    .map((kpi) => ({
      ...kpi,
      score: summary[kpi.key],
      rawText: kpi.raw(summary),
    }))
    .filter((item) => typeof item.score === "number" && !Number.isNaN(item.score))
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));
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
    overallIncludesQa: records.some((record) => hasValidNumber(record.qaScore)),
    overallWeights: {
      performance: averageField(records, "overallWeights.performance"),
      attendance: averageField(records, "overallWeights.attendance"),
      qa: averageField(records, "overallWeights.qa"),
    },
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
      overallIncludesQa: items.some((item) => hasValidNumber(item.qaScore)),
      overallWeights: {
        performance: averageField(items, "overallWeights.performance"),
        attendance: averageField(items, "overallWeights.attendance"),
        qa: averageField(items, "overallWeights.qa"),
      },
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
      overallIncludesQa: false,
      overallWeights: {
        performance: 0,
        attendance: 0,
        qa: 0,
      },
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

function updateInsights(filteredRecords, weeklyAverages) {
  const selectedSummary = pickWeekSummary(filteredRecords, weeklyAverages);
  const comparisonWeeklyAverages = getComparisonWeeklyAverages(weeklyAverages);
  const rankedKpis = getRankedKpis(selectedSummary);
  const bestKpi = rankedKpis[0] || null;
  const weakestKpi = rankedKpis.at(-1) || null;
  const totalAgents = new Set(filteredRecords.map((record) => record.agentName)).size;
  const totalWeeks = new Set(filteredRecords.map((record) => record.weekEnding)).size;
  const isAgentView = state.filters.agent !== "all";

  elements.viewInsightTitle.textContent = isAgentView
    ? `${state.filters.agent} in focus`
    : `${totalAgents || 0} agents in current scope`;
  elements.viewInsightBody.textContent = isAgentView
    ? `${selectedSummary.weekEnding || "Latest week"} is selected across ${totalWeeks || 0} available week(s) for this agent.`
    : `${state.filters.month === "all" ? "All months" : state.filters.month} with ${state.filters.week === "all" ? "all available weeks" : state.filters.week} is showing ${filteredRecords.length} score row(s).`;

  elements.bestInsightTitle.textContent = bestKpi
    ? `${bestKpi.label} is leading at ${formatScore(bestKpi.score)}`
    : "No KPI lead available";
  elements.bestInsightBody.textContent = bestKpi
    ? `${bestKpi.rawText}. This is the strongest signal in the currently selected view.`
    : "Select a scope with KPI data to surface the current strength.";

  elements.watchInsightTitle.textContent = weakestKpi
    ? `${weakestKpi.label} needs the most attention`
    : "No watch item available";
  elements.watchInsightBody.textContent = weakestKpi
    ? `${weakestKpi.rawText}. This is the lowest-scoring KPI in the current selection.`
    : "The watchlist will appear once KPI scores are available.";

  const currentWeek = comparisonWeeklyAverages.at(-1) || null;
  const previousWeek = comparisonWeeklyAverages.length > 1 ? comparisonWeeklyAverages[0] : null;
  const overallDelta =
    currentWeek && previousWeek ? Number(currentWeek.overallScore) - Number(previousWeek.overallScore) : null;

  elements.momentumInsightTitle.textContent =
    overallDelta === null || Number.isNaN(overallDelta)
      ? "No previous week for momentum"
      : `Overall ${overallDelta >= 0 ? "up" : "down"} ${formatSignedDelta(overallDelta)}`;
  elements.momentumInsightBody.textContent =
    overallDelta === null || Number.isNaN(overallDelta)
      ? `${selectedSummary.weekEnding || "Selected week"} has no earlier week available for comparison.`
      : `${currentWeek.weekEnding} versus ${previousWeek.weekEnding} on weighted overall score.`;

  if (elements.mobileStatusMonth && elements.mobileStatusWeek && elements.mobileStatusScope) {
    elements.mobileStatusMonth.textContent = state.filters.month === "all" ? "All Months" : state.filters.month;
    elements.mobileStatusWeek.textContent = state.filters.week === "all" ? selectedSummary.weekEnding || "Latest" : state.filters.week;
    elements.mobileStatusScope.textContent = state.filters.agent === "all" ? `${totalAgents || 0} Agents` : state.filters.agent;
  }

  if (elements.mobileLegendLauncher) {
    const legendTitle = elements.mobileLegendLauncher.querySelector("strong");
    const legendCopy = elements.mobileLegendLauncher.querySelector("p");
    if (legendTitle && legendCopy) {
      legendTitle.textContent = "KPI Legend";
      legendCopy.textContent = "Keep score definitions one tap away.";
    }
  }

  if (elements.mobileFiltersLauncher) {
    const filtersTitle = elements.mobileFiltersLauncher.querySelector("strong");
    const filtersCopy = elements.mobileFiltersLauncher.querySelector("p");
    if (filtersTitle && filtersCopy) {
      if (state.filters.agent === "all") {
        filtersTitle.textContent = "Filters";
        filtersCopy.textContent = "Open month, week, and agent filters.";
      } else {
        filtersTitle.textContent = "Agent Scope";
        filtersCopy.textContent = "Change the selected agent or week focus.";
      }
    }
  }
}

function updateAgentFocus(filteredRecords, weeklyAverages) {
  if (state.filters.agent === "all") {
    elements.agentFocusName.textContent = "Selected agent";
    elements.agentFocusNarrative.textContent = "Pick one agent to show an individualized coaching snapshot.";
    elements.agentOverallValue.textContent = "--";
    elements.agentOverallNarrative.textContent = "Latest weighted score summary.";
    elements.agentStrongestValue.textContent = "--";
    elements.agentStrongestNarrative.textContent = "Best-performing KPI this week.";
    elements.agentWeakestValue.textContent = "--";
    elements.agentWeakestNarrative.textContent = "Most urgent KPI to coach this week.";
    return;
  }

  const selectedSummary = pickWeekSummary(filteredRecords, weeklyAverages);
  const rankedKpis = getRankedKpis(selectedSummary);
  const bestKpi = rankedKpis[0] || null;
  const weakestKpi = rankedKpis.at(-1) || null;
  const comparisonWeeklyAverages = getComparisonWeeklyAverages(weeklyAverages);
  const previousWeek = comparisonWeeklyAverages.length > 1 ? comparisonWeeklyAverages[0] : null;
  const currentWeek = comparisonWeeklyAverages.at(-1) || null;
  const overallDelta =
    currentWeek && previousWeek ? Number(currentWeek.overallScore) - Number(previousWeek.overallScore) : null;

  elements.agentFocusName.textContent = state.filters.agent;
  elements.agentFocusNarrative.textContent = `${weeklyAverages.length} tracked week(s) in the current month filter. Use this as a quick coaching snapshot before reviewing the charts below.`;
  elements.agentOverallValue.textContent = formatScore(selectedSummary.overallScore);
  elements.agentOverallNarrative.textContent =
    overallDelta === null || Number.isNaN(overallDelta)
      ? `Latest available week: ${selectedSummary.weekEnding || "No Data"}.`
      : `${currentWeek.weekEnding} moved ${formatSignedDelta(overallDelta)} versus ${previousWeek.weekEnding}.`;
  elements.agentStrongestValue.textContent = bestKpi ? `${bestKpi.label} ${formatScore(bestKpi.score)}` : "N/A";
  elements.agentStrongestNarrative.textContent = bestKpi
    ? `${bestKpi.rawText}. This is the best KPI to reinforce.`
    : "No strongest KPI available for the selected view.";
  elements.agentWeakestValue.textContent = weakestKpi ? `${weakestKpi.label} ${formatScore(weakestKpi.score)}` : "N/A";
  elements.agentWeakestNarrative.textContent = weakestKpi
    ? `${weakestKpi.rawText}. This is the KPI to prioritize in coaching.`
    : "No weakest KPI available for the selected view.";
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

function buildCurrentPreviousDetail(label, currentValue, previousValue, formatter) {
  const currentText = currentValue === null || currentValue === undefined ? "N/A" : formatter(currentValue);
  const previousText = previousValue === null || previousValue === undefined ? "N/A" : formatter(previousValue);
  return `${label}: ${currentText} | Previous: ${previousText}`;
}

function hasValidNumber(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

function describeOverallFormula(summary) {
  if (!summary) return "Overall score pending";
  if (summary.overallIncludesQa) {
    return "Performance + Attendance + QA";
  }
  return "Performance + Attendance only | QA pending";
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
    overall: `${describeOverallFormula(currentWeekSummary)} | Performance ${buildCurrentPreviousDetail("current", currentWeekSummary.performanceScore, previousWeekSummary?.performanceScore, formatScore)} | Attendance ${buildCurrentPreviousDetail("current", currentWeekSummary.attendanceScore, previousWeekSummary?.attendanceScore, formatScore)} | QA ${buildCurrentPreviousDetail("current", currentWeekSummary.qaScore, previousWeekSummary?.qaScore, formatScore)}`,
    transfer: buildCurrentPreviousDetail(
      "Avg transfer rate",
      currentWeekSummary.transferRatePercent,
      previousWeekSummary?.transferRatePercent,
      (value) => formatPercent(value)
    ),
    admits: buildCurrentPreviousDetail(
      "Avg admits count",
      currentWeekSummary.admitsCount,
      previousWeekSummary?.admitsCount,
      (value) => Number(value).toFixed(2)
    ),
    aht: buildCurrentPreviousDetail(
      "Avg handle time",
      currentWeekSummary.ahtSeconds,
      previousWeekSummary?.ahtSeconds,
      (value) => formatTimeFromSeconds(value)
    ),
    attendance: buildCurrentPreviousDetail(
      "Avg attendance",
      currentWeekSummary.attendancePercentValue,
      previousWeekSummary?.attendancePercentValue,
      (value) => formatPercent(value)
    ),
    qa: buildCurrentPreviousDetail(
      "Avg QA",
      currentWeekSummary.qaPercentValue,
      previousWeekSummary?.qaPercentValue,
      (value) => formatPercent(value)
    ),
  };

  if (!hasValidNumber(currentWeekSummary.qaScore)) {
    rawText.qa = "QA data pending | Current: N/A | Previous: N/A";
  }

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
    const qaPending = !hasValidNumber(weekSummary.qaScore);
    elements.comparisonTitle.textContent = "Selected week vs previous week";
    elements.comparisonSubnote.textContent =
      comparisonWeeklyAverages.length > 1
        ? `${selectedWeek} vs ${previousWeek}.${qaPending ? " QA is pending and excluded from overall where missing." : ""}`
        : `${selectedWeek} has no prior week.${qaPending ? " QA is pending and excluded from overall where missing." : ""}`;
  }

  if (elements.rankingSubnote) {
    const qaPending = !hasValidNumber(weekSummary.qaScore);
    elements.rankingSubnote.textContent =
      state.filters.week !== "all"
        ? `Top 10 for ${state.filters.week}.${qaPending ? " QA pending is excluded from overall where missing." : ""}`
        : `Latest top 10 within ${state.filters.month === "all" ? "this view" : state.filters.month}.${qaPending ? " QA pending is excluded from overall where missing." : ""}`;
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

function handleRowToggle(rowKey) {
  state.selectedRowKey = state.selectedRowKey === rowKey ? null : rowKey;
  updateTable(getFilteredRecords(state.dataset.records, state.filters));
}

function updateTable(filteredRecords) {
  if (state.selectedRowKey && !filteredRecords.some((record) => record.key === state.selectedRowKey)) {
    state.selectedRowKey = null;
  }
  initializeTable(elements.tableHeadRow, handleSortChange, state.sort);
  renderTableSummary(elements.tableSummaryStrip, filteredRecords);
  renderTable(elements.tableBody, sortRecords(filteredRecords, state.sort), state.selectedRowKey, handleRowToggle);
}

function updateStatus(filteredRecords) {
  const totalAgents = new Set(filteredRecords.map((record) => record.agentName)).size;
  const totalWeeks = new Set(filteredRecords.map((record) => record.weekEnding)).size;
  const qaAvailable = filteredRecords.some((record) => hasValidNumber(record.qaScore));
  elements.dataStatusText.textContent =
    state.filters.agent === "all"
      ? `${filteredRecords.length} score rows across ${totalAgents} agents and ${totalWeeks} weeks.${qaAvailable ? "" : " QA data is pending, so overall rankings are using the available KPIs only."}`
      : `${filteredRecords.length} score rows for ${state.filters.agent} across ${totalWeeks} week(s).${qaAvailable ? "" : " QA data is pending, so overall scores are using the available KPIs only."}`;
}

function updateLayoutVisibility() {
  const isAgentView = state.filters.agent !== "all";
  elements.teamOnlySections.forEach((section) => {
    section.classList.toggle("is-hidden", isAgentView);
  });
  elements.agentOnlySections.forEach((section) => {
    section.classList.toggle("is-hidden", !isAgentView);
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

  state.distributionDrilldownOpen = false;
  applyDistributionDrilldownState();

  updateInsights(dashboardRecords, weeklyAverages);
  updateSummaryCards(dashboardRecords, weeklyAverages);
  updateAgentFocus(dashboardRecords, weeklyAverages);
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
      state.mobileSidebarOpen = false;
      applyMobileUiState();
    });
  });
}

function bindViewportEvents() {
  window.addEventListener("resize", () => {
    if (state.resizeRaf) {
      cancelAnimationFrame(state.resizeRaf);
    }
    state.resizeRaf = requestAnimationFrame(() => {
      state.resizeRaf = null;
      if (state.dataset) {
        if (window.innerWidth > 720) {
          state.mobileTableExpanded = true;
          state.mobileFiltersExpanded = true;
          state.mobileSidebarOpen = false;
          state.floatingLegendOpen = false;
          state.mobileMoreOpen = false;
        }
        applyMobileUiState();
        applyMobileMoreState();
        applyMobileDistributionState();
        applyFloatingLegendState();
        updateDashboard();
      }
    });
  });
}

function bindEvents() {
  elements.mobileMenuToggle?.addEventListener("click", () => {
    state.mobileSidebarOpen = !state.mobileSidebarOpen;
    applyMobileUiState();
  });

  elements.mobileHomeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      let targetId = button.dataset.mobileTarget;
      if (state.filters.agent !== "all" && (targetId === "summaryCards" || targetId === "agentsSection")) {
        targetId = "agentFocusSection";
      }
      if (targetId === "tableSection") {
        state.mobileTableExpanded = true;
        applyMobileUiState();
        setMobileDockActive("table");
      } else if (targetId === "summaryCards" || targetId === "agentFocusSection") {
        setMobileDockActive("summary");
      } else if (targetId === "agentsSection") {
        setMobileDockActive("agents");
      } else {
        setMobileDockActive("home");
      }
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  elements.mobileLegendLauncher?.addEventListener("click", () => {
    state.mobileMoreOpen = false;
    applyMobileMoreState();
    state.floatingLegendOpen = true;
    applyFloatingLegendState();
    setMobileDockActive("more");
  });

  elements.mobileFiltersLauncher?.addEventListener("click", () => {
    state.mobileMoreOpen = false;
    applyMobileMoreState();
    state.mobileFiltersExpanded = true;
    applyMobileUiState();
    setMobileDockActive("more");
    document.getElementById("filtersSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elements.mobileBottomNavButtons.forEach((button) => {
    button.addEventListener("click", () => {
      triggerMobileAction(button.dataset.mobileAction);
    });
  });

  elements.mobileDistributionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.mobileDistributionPanel = button.dataset.distributionPanel;
      applyMobileDistributionState();
    });
  });

  elements.floatingLegendToggle?.addEventListener("click", () => {
    state.floatingLegendOpen = !state.floatingLegendOpen;
    applyFloatingLegendState();
    if (state.floatingLegendOpen) {
      setMobileDockActive("more");
    }
  });

  elements.floatingLegendClose?.addEventListener("click", () => {
    state.floatingLegendOpen = false;
    applyFloatingLegendState();
    setMobileDockActive("home");
  });

  elements.mobileMoreClose?.addEventListener("click", () => {
    state.mobileMoreOpen = false;
    applyMobileMoreState();
    setMobileDockActive("home");
  });

  elements.mobileMoreLegend?.addEventListener("click", () => {
    state.mobileMoreOpen = false;
    applyMobileMoreState();
    state.floatingLegendOpen = true;
    applyFloatingLegendState();
    setMobileDockActive("more");
  });

  elements.mobileMoreFilters?.addEventListener("click", () => {
    state.mobileMoreOpen = false;
    applyMobileMoreState();
    state.mobileFiltersExpanded = true;
    applyMobileUiState();
    document.getElementById("filtersSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileDockActive("more");
  });

  elements.mobileMoreExport?.addEventListener("click", () => {
    const filteredRecords = sortRecords(getFilteredRecords(state.dataset.records, state.filters), state.sort);
    exportRowsToCsv(filteredRecords);
    state.mobileMoreOpen = false;
    applyMobileMoreState();
    setMobileDockActive("more");
  });

  elements.mobileMoreReset?.addEventListener("click", () => {
    resetDashboardFilters();
    state.mobileMoreOpen = false;
    applyMobileMoreState();
    setMobileDockActive("home");
  });

  elements.distributionDrilldownClose?.addEventListener("click", () => {
    state.distributionDrilldownOpen = false;
    state.distributionDrilldownExpanded = false;
    state.distributionDrilldownDetail = null;
    applyDistributionDrilldownState();
  });

  elements.distributionDrilldownList?.addEventListener("click", (event) => {
    const trigger = event.target.closest(".distribution-drilldown-more");
    if (!trigger) return;
    state.distributionDrilldownExpanded = true;
    renderDistributionDrilldownContent();
  });

  elements.tableCollapseToggle?.addEventListener("click", () => {
    state.mobileTableExpanded = !state.mobileTableExpanded;
    applyMobileUiState();
  });

  elements.filtersCollapseToggle?.addEventListener("click", () => {
    state.mobileFiltersExpanded = !state.mobileFiltersExpanded;
    applyMobileUiState();
  });

  elements.mobileTableToggle?.addEventListener("click", () => {
    state.mobileTableExpanded = !state.mobileTableExpanded;
    applyMobileUiState();
    if (state.mobileTableExpanded) {
      setMobileDockActive("table");
    }
    document.getElementById("tableSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

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
    resetDashboardFilters();
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

    initializeMobileDefaults();
    syncFilterOptions();
    initializeFloatingLegend();
    bindNavigation();
    bindSummaryCardInteractions();
    bindEvents();
    bindViewportEvents();
    bindMobileScrollSpy();
    applyMobileUiState();
    applyMobileMoreState();
    applyMobileDistributionState();
    applyFloatingLegendState();
    applyDistributionDrilldownState();
    updateDashboard();
  } catch (error) {
    console.error(error);
    elements.dataStatusText.textContent = "The dashboard could not load the CSV sources. Check the published sheet permissions and try again.";
    elements.tableBody.innerHTML = '<tr><td colspan="14"><div class="status-message">Unable to load dashboard data.</div></td></tr>';
  }
}

init();
