function scoreColor(score) {
  if (score <= 1.5) return "#d83b3b";
  if (score <= 2.5) return "#f28c28";
  if (score <= 3.5) return "#e8b100";
  if (score <= 4.5) return "#74c365";
  return "#1f9d55";
}

const CHART_COLORS = {
  transfer: "#3B82F6",
  admits: "#10B981",
  aht: "#F59E0B",
  attendance: "#8B5CF6",
  qa: "#EC4899",
  overall: "#1F2937",
  ranking: "#1F2937",
};

const valueLabelPlugin = {
  id: "valueLabelPlugin",
  afterDatasetsDraw(chart, _args, pluginOptions) {
    if (!pluginOptions?.enabled) return;

    const { ctx } = chart;
    const formatter = pluginOptions.formatter || ((value) => String(value));
    const textColor = pluginOptions.color || "#10213d";
    const fontSize = pluginOptions.fontSize || 11;
    const fontWeight = pluginOptions.fontWeight || "700";
    const offset = pluginOptions.offset ?? 8;
    const inside = pluginOptions.inside ?? false;

    ctx.save();
    ctx.fillStyle = textColor;
    ctx.font = `${fontWeight} ${fontSize}px Manrope, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;

      meta.data.forEach((element, index) => {
        const rawValue = dataset.data[index];
        if (rawValue === null || rawValue === undefined || Number.isNaN(rawValue)) return;

        const parsed = meta.controller.getParsed(index);
        let numericValue = Number(rawValue);
        if (typeof parsed === "object" && parsed !== null) {
          if (chart.config.type === "bar" && chart.options.indexAxis === "y") {
            numericValue = Number(parsed.x);
          } else if (chart.config.type === "bar") {
            numericValue = Number(parsed.y);
          } else {
            numericValue = Number(parsed.y ?? parsed.x ?? rawValue);
          }
        }
        if (Number.isNaN(numericValue)) return;

        const label = formatter(numericValue, {
          chart,
          dataset,
          datasetIndex,
          dataIndex: index,
        });
        if (!label) return;

        const position = element.tooltipPosition();
        let x = position.x;
        let y = position.y - offset;

        if (chart.config.type === "bar") {
          if (chart.options.indexAxis === "y") {
            x = inside ? position.x - offset : position.x + offset;
            ctx.textAlign = inside ? "right" : "left";
            y = position.y;
          } else if (inside) {
            y = position.y + 10;
          }
        }

        ctx.fillText(label, x, y);
      });
    });

    ctx.restore();
  },
};

const strictChartAreaTooltipPlugin = {
  id: "strictChartAreaTooltipPlugin",
  beforeEvent(chart, args, pluginOptions) {
    if (!pluginOptions?.enabled) return;

    const event = args.event;
    if (!event || (event.type !== "mousemove" && event.type !== "click")) return;

    const area = chart.chartArea;
    if (!area) return;

    const outsideChartArea =
      event.x < area.left || event.x > area.right || event.y < area.top || event.y > area.bottom;

    if (outsideChartArea) {
      chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
      chart.setActiveElements([]);
      args.changed = true;
    }
  },
};

Chart.register(valueLabelPlugin, strictChartAreaTooltipPlugin);

function destroyIfExists(chart) {
  if (chart) chart.destroy();
}

function buildBaseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          boxHeight: 10,
        },
      },
      tooltip: {
        backgroundColor: "rgba(16, 33, 61, 0.96)",
        titleFont: {
          size: 16,
          weight: "700",
        },
        bodyFont: {
          size: 15,
        },
        footerFont: {
          size: 14,
          weight: "700",
        },
        padding: 16,
        cornerRadius: 12,
        callbacks: {
          label(context) {
            const value = typeof context.parsed === "object" ? context.parsed.y ?? context.parsed.x : context.parsed;
            return `${context.dataset.label}: ${Number(value).toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 5,
        grid: {
          color: "rgba(16, 33, 61, 0.08)",
        },
        ticks: {
          stepSize: 1,
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${Number(value).toFixed(2)}%`;
}

function formatTime(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function hexToRgba(hex, alpha) {
  const cleaned = hex.replace("#", "");
  const value = cleaned.length === 3
    ? cleaned.split("").map((char) => char + char).join("")
    : cleaned;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function formatSnapshotLabel(label, weekSummary) {
  const rawMap = {
    Transfer: formatPercent(weekSummary.transferRatePercent),
    Admits: weekSummary.admitsCount === null || weekSummary.admitsCount === undefined ? "N/A" : Number(weekSummary.admitsCount).toFixed(2),
    AHT: formatTime(weekSummary.ahtSeconds),
    Attendance: formatPercent(weekSummary.attendancePercentValue),
    QA: formatPercent(weekSummary.qaPercentValue),
    Overall: weekSummary.overallScore === null || weekSummary.overallScore === undefined ? "N/A" : Number(weekSummary.overallScore).toFixed(2),
  };

  return rawMap[label] || "";
}

function formatComparisonRaw(label, weekSummary) {
  if (!weekSummary) return "Average: N/A";

  const rawMap = {
    Transfer: `Avg rate: ${formatPercent(weekSummary.transferRatePercent)}`,
    Admits: `Avg count: ${
      weekSummary.admitsCount === null || weekSummary.admitsCount === undefined
        ? "N/A"
        : Number(weekSummary.admitsCount).toFixed(2)
    }`,
    AHT: `Avg time: ${formatTime(weekSummary.ahtSeconds)}`,
    Attendance: `Avg attendance: ${formatPercent(weekSummary.attendancePercentValue)}`,
    QA: `Avg QA: ${formatPercent(weekSummary.qaPercentValue)}`,
    Overall: `Weighted overall: ${
      weekSummary.overallScore === null || weekSummary.overallScore === undefined
        ? "N/A"
        : Number(weekSummary.overallScore).toFixed(2)
    }`,
  };

  return rawMap[label] || "Average: N/A";
}

function isValidMetric(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

export function renderLineChart(canvas, chart, weeklyAverages) {
  destroyIfExists(chart);
  return new Chart(canvas, {
    type: "line",
    data: {
      labels: weeklyAverages.map((item) => item.weekEnding),
      datasets: [
        { label: "Transfer", data: weeklyAverages.map((item) => item.transferScore), borderColor: CHART_COLORS.transfer, backgroundColor: CHART_COLORS.transfer, tension: 0.35 },
        { label: "Admits", data: weeklyAverages.map((item) => item.admitsScore), borderColor: CHART_COLORS.admits, backgroundColor: CHART_COLORS.admits, tension: 0.35 },
        { label: "AHT", data: weeklyAverages.map((item) => item.ahtScore), borderColor: CHART_COLORS.aht, backgroundColor: CHART_COLORS.aht, tension: 0.35 },
        { label: "Attendance", data: weeklyAverages.map((item) => item.attendanceScore), borderColor: CHART_COLORS.attendance, backgroundColor: CHART_COLORS.attendance, tension: 0.35 },
        { label: "QA", data: weeklyAverages.map((item) => item.qaScore), borderColor: CHART_COLORS.qa, backgroundColor: CHART_COLORS.qa, tension: 0.35 },
        { label: "Overall", data: weeklyAverages.map((item) => item.overallScore), borderColor: CHART_COLORS.overall, backgroundColor: CHART_COLORS.overall, borderWidth: 3, tension: 0.35 },
      ],
    },
    options: {
      ...buildBaseOptions(),
      plugins: {
        ...buildBaseOptions().plugins,
        tooltip: {
          ...buildBaseOptions().plugins.tooltip,
          callbacks: {
            title(items) {
              return items[0]?.label || "";
            },
            label(context) {
              const item = weeklyAverages[context.dataIndex];
              const score = Number(context.parsed.y).toFixed(2);
              const rawMap = {
                Transfer: `Avg rate: ${formatPercent(item?.transferRatePercent)}`,
                Admits: `Avg count: ${item?.admitsCount === null || item?.admitsCount === undefined ? "N/A" : Number(item.admitsCount).toFixed(2)}`,
                AHT: `Avg time: ${formatTime(item?.ahtSeconds)}`,
                Attendance: `Avg attendance: ${formatPercent(item?.attendancePercentValue)}`,
                QA: `Avg QA: ${formatPercent(item?.qaPercentValue)}`,
                Overall: `Weighted overall: ${score}`,
              };
              return [`Score: ${score}`, rawMap[context.dataset.label]];
            },
          },
        },
      },
    },
  });
}

export function renderBarChart(canvas, chart, weekSummary) {
  destroyIfExists(chart);
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Transfer", "Admits", "AHT", "Attendance", "QA", "Overall"],
      datasets: [
        {
          label: "Average Score",
          data: [
            weekSummary.transferScore,
            weekSummary.admitsScore,
            weekSummary.ahtScore,
            weekSummary.attendanceScore,
            weekSummary.qaScore,
            weekSummary.overallScore,
          ],
          backgroundColor: [CHART_COLORS.transfer, CHART_COLORS.admits, CHART_COLORS.aht, CHART_COLORS.attendance, CHART_COLORS.qa, CHART_COLORS.overall],
          borderRadius: 10,
        },
      ],
    },
    options: {
      ...buildBaseOptions(),
      plugins: {
        ...buildBaseOptions().plugins,
        valueLabelPlugin: {
          enabled: true,
          color: "#10213d",
          fontSize: 11,
          formatter(_value, context) {
            const label = context.chart.data.labels?.[context.dataIndex];
            return formatSnapshotLabel(label, weekSummary);
          },
        },
        tooltip: {
          ...buildBaseOptions().plugins.tooltip,
          callbacks: {
            label(context) {
              const label = context.label;
              const rawMap = {
                Transfer: `Avg rate: ${formatPercent(weekSummary.transferRatePercent)}`,
                Admits: `Avg count: ${weekSummary.admitsCount === null || weekSummary.admitsCount === undefined ? "N/A" : Number(weekSummary.admitsCount).toFixed(2)}`,
                AHT: `Avg time: ${formatTime(weekSummary.ahtSeconds)}`,
                Attendance: `Avg attendance: ${formatPercent(weekSummary.attendancePercentValue)}`,
                QA: `Avg QA: ${formatPercent(weekSummary.qaPercentValue)}`,
                Overall: `Weighted score`,
              };
              return [`Score: ${Number(context.parsed.y).toFixed(2)}`, rawMap[label]];
            },
          },
        },
      },
    },
  });
}

export function renderContributionChart(canvas, chart, weekSummary) {
  destroyIfExists(chart);
  const performanceAvailable = isValidMetric(weekSummary.performanceScore);
  const attendanceAvailable = isValidMetric(weekSummary.attendanceScore);
  const qaAvailable = isValidMetric(weekSummary.qaScore);
  const contributionConfig = [
    {
      key: "performance",
      label: performanceAvailable ? "Performance (50%)" : "Performance (Missing)",
      value: performanceAvailable ? weekSummary.performanceScore * 0.5 : 0,
      score: weekSummary.performanceScore,
      color: performanceAvailable ? CHART_COLORS.overall : "#d5ddea",
      detail: performanceAvailable
        ? `Performance score: ${Number(weekSummary.performanceScore).toFixed(2)}`
        : "Transfer, Admits, or AHT data is incomplete",
    },
    {
      key: "attendance",
      label: attendanceAvailable ? "Attendance (25%)" : "Attendance (Missing)",
      value: attendanceAvailable ? weekSummary.attendanceScore * 0.25 : 0,
      score: weekSummary.attendanceScore,
      color: attendanceAvailable ? CHART_COLORS.attendance : "#d5ddea",
      detail: attendanceAvailable
        ? `Attendance score: ${Number(weekSummary.attendanceScore).toFixed(2)}`
        : "Attendance data is unavailable",
    },
    {
      key: "qa",
      label: qaAvailable ? "QA (25%)" : "QA (Missing)",
      value: qaAvailable ? weekSummary.qaScore * 0.25 : 0,
      score: weekSummary.qaScore,
      color: qaAvailable ? CHART_COLORS.qa : "#d5ddea",
      detail: qaAvailable
        ? `QA score: ${Number(weekSummary.qaScore).toFixed(2)}`
        : "QA data is unavailable",
    },
  ];
  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: contributionConfig.map((item) => item.label),
      datasets: [
        {
          data: contributionConfig.map((item) => item.value),
          backgroundColor: contributionConfig.map((item) => item.color),
          borderColor: "#ffffff",
          borderWidth: 2,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
        tooltip: {
          ...buildBaseOptions().plugins.tooltip,
          callbacks: {
            title(items) {
              return items[0]?.label || "";
            },
            label(context) {
              const item = contributionConfig[context.dataIndex];
              if (!item) return "";
              if (!isValidMetric(item.score)) {
                return ["Contribution unavailable", item.detail];
              }
              return [
                `Contribution: ${Number(item.value).toFixed(2)}`,
                item.detail,
              ];
            },
          },
        },
      },
      cutout: "68%",
    },
  });
}

export function renderVarianceChart(canvas, chart, weeklyAverages) {
  destroyIfExists(chart);
  const currentWeek = weeklyAverages.at(-1) || null;
  const previousWeek = weeklyAverages.length > 1 ? weeklyAverages[0] : null;
  const kpiLabels = ["Transfer", "Admits", "AHT", "Attendance", "QA", "Overall"];
  const kpiKeys = ["transferScore", "admitsScore", "ahtScore", "attendanceScore", "qaScore", "overallScore"];
  const colors = [
    CHART_COLORS.transfer,
    CHART_COLORS.admits,
    CHART_COLORS.aht,
    CHART_COLORS.attendance,
    CHART_COLORS.qa,
    CHART_COLORS.overall,
  ];

  const varianceValues = kpiKeys.map((key) => {
    if (
      !currentWeek ||
      currentWeek[key] === null ||
      currentWeek[key] === undefined ||
      Number.isNaN(currentWeek[key]) ||
      !previousWeek ||
      previousWeek[key] === null ||
      previousWeek[key] === undefined ||
      Number.isNaN(previousWeek[key])
    ) {
      return 0;
    }
    return Number(currentWeek[key]) - Number(previousWeek[key]);
  });

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: kpiLabels,
      datasets: [
        {
          label: "Variance",
          data: varianceValues,
          backgroundColor: varianceValues.map((value, index) =>
            value >= 0 ? colors[index] : hexToRgba(colors[index], 0.28)
          ),
          borderColor: colors,
          borderWidth: 1.2,
          borderRadius: 10,
          maxBarThickness: 34,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        valueLabelPlugin: {
          enabled: true,
          color: "#10213d",
          fontSize: 11,
          fontWeight: "800",
          offset: 10,
          formatter(value) {
            const prefix = value > 0 ? "+" : "";
            return `${prefix}${Number(value).toFixed(2)}`;
          },
        },
        tooltip: {
          ...buildBaseOptions().plugins.tooltip,
          callbacks: {
            title(items) {
              return items[0]?.label || "";
            },
            label(context) {
              const currentValue = currentWeek?.[kpiKeys[context.dataIndex]];
              const previousValue = previousWeek?.[kpiKeys[context.dataIndex]];
              const variance = Number(context.parsed.y);
              const prefix = variance > 0 ? "+" : "";
              return [
                `Variance: ${prefix}${variance.toFixed(2)}`,
                `Selected week: ${currentValue === null || currentValue === undefined ? "N/A" : Number(currentValue).toFixed(2)}`,
                `Previous week: ${previousValue === null || previousValue === undefined ? "N/A" : Number(previousValue).toFixed(2)}`,
              ];
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: "rgba(16, 33, 61, 0.08)",
          },
          ticks: {
            callback(value) {
              const prefix = Number(value) > 0 ? "+" : "";
              return `${prefix}${Number(value).toFixed(1)}`;
            },
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

export function renderRankingChart(canvas, chart, records) {
  destroyIfExists(chart);
  const ranked = [...records]
    .filter((record) => typeof record.overallScore === "number" && !Number.isNaN(record.overallScore))
    .sort((left, right) => right.overallScore - left.overallScore)
    .slice(0, 10);
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: ranked.map((record) => record.agentName),
      datasets: [
        {
          label: "Overall Score",
          data: ranked.map((record) => record.overallScore),
          backgroundColor: CHART_COLORS.ranking,
          borderColor: "#0f172a",
          borderWidth: 1.5,
          borderRadius: 10,
          barThickness: 18,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      interaction: {
        mode: "nearest",
        axis: "xy",
        intersect: true,
      },
      plugins: {
        legend: {
          display: false,
        },
        strictChartAreaTooltipPlugin: {
          enabled: true,
        },
        valueLabelPlugin: {
          enabled: true,
          color: "#ffffff",
          fontSize: 11,
          fontWeight: "800",
          inside: true,
          offset: 10,
          formatter(value) {
            return Number(value).toFixed(2);
          },
        },
        tooltip: {
          enabled: false,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 5,
          grid: {
            color: "rgba(16, 33, 61, 0.08)",
          },
        },
        y: {
          ticks: {
            font: {
              size: 11,
            },
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

export function renderStackedBarChart(canvas, chart, records) {
  destroyIfExists(chart);
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: records.map((record) => record.agentName),
      datasets: [
        { label: "Transfer", data: records.map((record) => record.transferScore), backgroundColor: CHART_COLORS.transfer },
        { label: "Admits", data: records.map((record) => record.admitsScore), backgroundColor: CHART_COLORS.admits },
        { label: "AHT", data: records.map((record) => record.ahtScore), backgroundColor: CHART_COLORS.aht },
        { label: "Attendance", data: records.map((record) => record.attendanceScore), backgroundColor: CHART_COLORS.attendance },
        { label: "QA", data: records.map((record) => record.qaScore), backgroundColor: CHART_COLORS.qa },
      ],
    },
    options: {
      ...buildBaseOptions(),
      plugins: {
        ...buildBaseOptions().plugins,
        tooltip: {
          ...buildBaseOptions().plugins.tooltip,
          callbacks: {
            title(items) {
              return items[0]?.label || "";
            },
            label(context) {
              const record = records[context.dataIndex];
              const rawMap = {
                Transfer: `Avg rate: ${formatPercent(record?.transferRatePercent)}`,
                Admits: `Avg count: ${record?.admitsCount === null || record?.admitsCount === undefined ? "N/A" : Number(record.admitsCount).toFixed(0)}`,
                AHT: `Avg time: ${formatTime(record?.ahtSeconds)}`,
                Attendance: `Avg attendance: ${formatPercent(record?.attendancePercentValue)}`,
                QA: `Avg QA: ${formatPercent(record?.qaPercentValue)}`,
              };
              return [`Score: ${Number(context.parsed.y).toFixed(2)}`, rawMap[context.dataset.label]];
            },
            footer(items) {
              const total = items.reduce((sum, item) => sum + Number(item.parsed.y || 0), 0);
              return `Total KPI Sum: ${total.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: "rgba(16, 33, 61, 0.08)" },
        },
      },
    },
  });
}

export function renderComparisonChart(canvas, chart, weeklyAverages) {
  destroyIfExists(chart);
  const currentWeek = weeklyAverages.at(-1) || null;
  const previousWeek = weeklyAverages.length > 1 ? weeklyAverages[0] : null;
  const kpiLabels = ["Transfer", "Admits", "AHT", "Attendance", "QA", "Overall"];
  const kpiKeys = ["transferScore", "admitsScore", "ahtScore", "attendanceScore", "qaScore", "overallScore"];
  const colors = [
    CHART_COLORS.transfer,
    CHART_COLORS.admits,
    CHART_COLORS.aht,
    CHART_COLORS.attendance,
    CHART_COLORS.qa,
    CHART_COLORS.overall,
  ];

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: kpiLabels,
      datasets: [
        {
          label: previousWeek?.weekEnding || "Previous Week",
          data: kpiKeys.map((key) => previousWeek?.[key] ?? null),
          backgroundColor: colors.map((color) => hexToRgba(color, 0.3)),
          borderColor: colors.map((color) => hexToRgba(color, 0.55)),
          borderWidth: 1.2,
          borderRadius: 12,
          categoryPercentage: 0.62,
          barPercentage: 0.92,
          maxBarThickness: 30,
        },
        {
          label: currentWeek?.weekEnding || "Selected Week",
          data: kpiKeys.map((key) => currentWeek?.[key] ?? null),
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1.2,
          borderRadius: 12,
          categoryPercentage: 0.62,
          barPercentage: 0.92,
          maxBarThickness: 30,
        },
      ],
    },
    options: {
      ...buildBaseOptions(),
      plugins: {
        ...buildBaseOptions().plugins,
        valueLabelPlugin: {
          enabled: true,
          color: "#10213d",
          fontSize: 11,
          fontWeight: "800",
          offset: 10,
          formatter(value, context) {
            if (context.datasetIndex !== 1) return "";
            const previousValue = previousWeek?.[kpiKeys[context.dataIndex]];
            if (previousValue === null || previousValue === undefined || Number.isNaN(previousValue)) {
              return Number(value).toFixed(2);
            }
            const delta = Number(value) - Number(previousValue);
            const deltaPrefix = delta > 0 ? "+" : "";
            return `${deltaPrefix}${delta.toFixed(2)}`;
          },
        },
        tooltip: {
          ...buildBaseOptions().plugins.tooltip,
          callbacks: {
            title(items) {
              return items[0]?.label || "";
            },
            label(context) {
              const weekSummary = context.datasetIndex === 0 ? previousWeek : currentWeek;
              return [
                `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)}`,
                formatComparisonRaw(context.label, weekSummary),
              ];
            },
            footer(items) {
              const currentItem = items.find((item) => item.datasetIndex === 1);
              const previousItem = items.find((item) => item.datasetIndex === 0);
              if (!currentItem || !previousItem) return "";
              const delta = Number(currentItem.parsed.y) - Number(previousItem.parsed.y);
              const prefix = delta > 0 ? "+" : "";
              return `Delta: ${prefix}${delta.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 5,
          grid: {
            color: "rgba(16, 33, 61, 0.08)",
          },
          ticks: {
            stepSize: 1,
          },
        },
        x: {
          offset: true,
          stacked: false,
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

function buildDistributionData(records, field) {
  const counts = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: records.filter((record) => Math.round(record[field]) === score).length,
  }));
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  return { counts, total };
}

export function renderDistributionChart(canvas, chart, records, field, label, color) {
  destroyIfExists(chart);
  const { counts, total } = buildDistributionData(
    records.filter((record) => typeof record[field] === "number" && !Number.isNaN(record[field])),
    field
  );
  const maxCount = Math.max(...counts.map((item) => item.count), 0);
  const suggestedMax = Math.max(1, maxCount + Math.max(1, Math.ceil(maxCount * 0.18)));

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: counts.map((item) => `Score ${item.score}`),
      datasets: [
        {
          label,
          data: counts.map((item) => item.count),
          backgroundColor: counts.map((item) => (item.count ? color : "rgba(127, 143, 179, 0.18)")),
          borderColor: color,
          borderWidth: 1.2,
          borderRadius: 10,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        valueLabelPlugin: {
          enabled: true,
          color: "#10213d",
          fontSize: 13,
          fontWeight: "800",
          offset: 12,
          formatter(value) {
            return String(Math.round(value));
          },
        },
        tooltip: {
          backgroundColor: "rgba(16, 33, 61, 0.96)",
          titleFont: {
            size: 14,
            weight: "700",
          },
          bodyFont: {
            size: 13,
          },
          padding: 12,
          cornerRadius: 12,
          callbacks: {
            title(items) {
              return items[0]?.label || "";
            },
            label(context) {
              const count = Number(context.parsed.y || 0);
              const percent = total ? ((count / total) * 100).toFixed(1) : "0.0";
              return [`Agents: ${count}`, `Share: ${percent}%`];
            },
            footer() {
              return `Scored agents: ${total}`;
            },
          },
        },
      },
      scales: {
        x: {
          offset: true,
          grid: {
            display: false,
          },
          ticks: {
            color: "#6e7d98",
            font: {
              size: 11,
              weight: "700",
            },
          },
        },
        y: {
          beginAtZero: true,
          suggestedMax,
          grid: {
            display: false,
          },
          ticks: {
            display: false,
          },
          border: {
            display: false,
          },
        },
      },
    },
  });
}

export function renderTopBottomChart(canvas, chart, records, label) {
  destroyIfExists(chart);
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: records.map((record) => record.agentName),
      datasets: [
        {
          label,
          data: records.map((record) => record.overallScore),
          backgroundColor: records.map((record) => scoreColor(record.overallScore)),
          borderRadius: 10,
        },
      ],
    },
    options: {
      ...buildBaseOptions(),
      interaction: {
        mode: "nearest",
        axis: "xy",
        intersect: true,
      },
      plugins: {
        ...buildBaseOptions().plugins,
        legend: {
          display: false,
        },
        strictChartAreaTooltipPlugin: {
          enabled: true,
        },
        valueLabelPlugin: {
          enabled: true,
          color: "#10213d",
          fontSize: 11,
          formatter(value) {
            return Number(value).toFixed(2);
          },
        },
        tooltip: {
          ...buildBaseOptions().plugins.tooltip,
          mode: "nearest",
          axis: "xy",
          intersect: true,
        },
      },
    },
  });
}

export function renderImprovementChart(canvas, chart, records) {
  destroyIfExists(chart);
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: records.map((record) => record.agentName),
      datasets: [
        {
          label: "Improvement",
          data: records.map((record) => record.delta),
          backgroundColor: records.map((record) =>
            record.delta >= 0 ? CHART_COLORS.admits : hexToRgba(CHART_COLORS.admits, 0.26)
          ),
          borderColor: CHART_COLORS.admits,
          borderWidth: 1.2,
          borderRadius: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "nearest",
        axis: "xy",
        intersect: true,
      },
      plugins: {
        legend: {
          display: false,
        },
        strictChartAreaTooltipPlugin: {
          enabled: true,
        },
        valueLabelPlugin: {
          enabled: true,
          color: "#10213d",
          fontSize: 11,
          fontWeight: "800",
          formatter(value) {
            const prefix = value > 0 ? "+" : "";
            return `${prefix}${Number(value).toFixed(2)}`;
          },
        },
        tooltip: {
          ...buildBaseOptions().plugins.tooltip,
          mode: "nearest",
          axis: "xy",
          intersect: true,
          callbacks: {
            title(items) {
              return items[0]?.label || "";
            },
            label(context) {
              const record = records[context.dataIndex];
              const delta = Number(context.parsed.y);
              const prefix = delta > 0 ? "+" : "";
              return [
                `Improvement: ${prefix}${delta.toFixed(2)}`,
                `Current overall: ${Number(record.currentOverallScore).toFixed(2)}`,
                `Previous overall: ${Number(record.previousOverallScore).toFixed(2)}`,
              ];
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(16, 33, 61, 0.08)",
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}
