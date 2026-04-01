const COLUMNS = [
  { key: "agentName", label: "Agent Name", type: "text" },
  { key: "weekEnding", label: "Week Ending", type: "text" },
  { key: "transfer", label: "Transfer", type: "kpi" },
  { key: "admits", label: "Admits", type: "kpi" },
  { key: "aht", label: "AHT", type: "kpi" },
  { key: "attendance", label: "Attendance", type: "kpi" },
  { key: "qa", label: "QA", type: "kpi" },
  { key: "performanceScore", label: "Performance", type: "number2" },
  { key: "overallScore", label: "Overall", type: "number2" },
];

function getColumnSortLabel(column, sortState) {
  if (sortState.key !== column.key) return column.label;
  return `${column.label} ${sortState.direction === "asc" ? "^" : "v"}`;
}

function scoreText(value) {
  return value === null || value === undefined || Number.isNaN(value) ? "N/A" : Number(value).toFixed(2);
}

function getRowState(record) {
  const kpiScores = [
    record.transferScore,
    record.admitsScore,
    record.ahtScore,
    record.attendanceScore,
    record.qaScore,
  ].filter((value) => typeof value === "number" && !Number.isNaN(value));
  const weakestScore = kpiScores.length ? Math.min(...kpiScores) : null;

  if (typeof record.overallScore === "number" && record.overallScore >= 4.25) return "top";
  if (weakestScore !== null && weakestScore <= 2) return "watch";
  return "steady";
}

function getRowStateLabel(rowState) {
  if (rowState === "top") return "Top Performer";
  if (rowState === "watch") return "Needs Attention";
  return "Stable";
}

function getDetailKpiRows(record) {
  return [
    ["Transfer", `${record.transferRateDisplay} | Score ${scoreText(record.transferScore)}`],
    ["Admits", `${record.admitsCount === null || record.admitsCount === undefined ? "N/A" : Number(record.admitsCount).toFixed(0)} | Score ${scoreText(record.admitsScore)}`],
    ["AHT", `${record.ahtDisplay} | Score ${scoreText(record.ahtScore)}`],
    ["Attendance", `${record.attendancePercentDisplay} | Score ${scoreText(record.attendanceScore)}`],
    ["QA", `${record.qaPercentDisplay} | Score ${scoreText(record.qaScore)}`],
  ];
}

function renderExpandedRow(record) {
  const detailItems = getDetailKpiRows(record)
    .map(([label, value]) => `<div class="table-detail-item"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");

  return `
    <tr class="table-detail-row">
      <td colspan="${COLUMNS.length}">
        <div class="table-detail-panel">
          <div class="table-detail-topline">
            <span class="table-row-state table-row-state-${getRowState(record)}">${getRowStateLabel(getRowState(record))}</span>
            <strong>${record.agentName} | Week Ending ${record.weekEnding}</strong>
            <span>Overall ${scoreText(record.overallScore)} | Performance ${scoreText(record.performanceScore)}</span>
          </div>
          <div class="table-detail-grid">${detailItems}</div>
        </div>
      </td>
    </tr>
  `;
}

function renderKpiCell(record, key) {
  const map = {
    transfer: [record.transferRateDisplay, record.transferScore],
    admits: [record.admitsCount === null || record.admitsCount === undefined ? "N/A" : Number(record.admitsCount).toFixed(0), record.admitsScore],
    aht: [record.ahtDisplay, record.ahtScore],
    attendance: [record.attendancePercentDisplay, record.attendanceScore],
    qa: [record.qaPercentDisplay, record.qaScore],
  };

  const [value, score] = map[key];
  const scoreClass =
    score === null || score === undefined || Number.isNaN(score) ? "score-na" : `score-${Math.round(score)}`;
  const scoreDisplay = score === null || score === undefined || Number.isNaN(score) ? "N/A" : Number(score).toFixed(0);
  return `<div class="kpi-inline"><span>${value}</span><span class="score-pill ${scoreClass}">${scoreDisplay}</span></div>`;
}

function formatValue(column, record) {
  if (column.type === "kpi") {
    return renderKpiCell(record, column.key);
  }
  if (column.type === "number2") {
    const value = record[column.key];
    return value === null || value === undefined || Number.isNaN(value) ? "N/A" : Number(value).toFixed(2);
  }
  return record[column.key] ?? "";
}

function buildTableCell(column, record) {
  return `<td data-label="${column.label}">${formatValue(column, record)}</td>`;
}

export function initializeTable(headRow, onSort, sortState) {
  headRow.innerHTML = "";
  COLUMNS.forEach((column) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = getColumnSortLabel(column, sortState);
    th.addEventListener("click", () => onSort(column.key));
    headRow.appendChild(th);
  });
}

export function renderTableSummary(summaryElement, records) {
  if (!summaryElement) return;
  if (!records.length) {
    summaryElement.innerHTML = "";
    return;
  }

  const validOverall = records
    .map((record) => record.overallScore)
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
  const averageOverall = validOverall.length
    ? validOverall.reduce((sum, value) => sum + value, 0) / validOverall.length
    : null;
  const topRecord = [...records]
    .filter((record) => typeof record.overallScore === "number" && !Number.isNaN(record.overallScore))
    .sort((left, right) => right.overallScore - left.overallScore)[0];
  const lowRecord = [...records]
    .filter((record) => typeof record.overallScore === "number" && !Number.isNaN(record.overallScore))
    .sort((left, right) => left.overallScore - right.overallScore)[0];

  summaryElement.innerHTML = `
    <div class="table-summary-card">
      <span class="table-summary-label">Rows Shown</span>
      <strong>${records.length}</strong>
      <p>Current filtered records in view.</p>
    </div>
    <div class="table-summary-card">
      <span class="table-summary-label">Average Overall</span>
      <strong>${scoreText(averageOverall)}</strong>
      <p>Mean weighted score across shown rows.</p>
    </div>
    <div class="table-summary-card">
      <span class="table-summary-label">Highest Overall</span>
      <strong>${topRecord ? `${topRecord.agentName} ${scoreText(topRecord.overallScore)}` : "N/A"}</strong>
      <p>Best row in the current table selection.</p>
    </div>
    <div class="table-summary-card">
      <span class="table-summary-label">Lowest Overall</span>
      <strong>${lowRecord ? `${lowRecord.agentName} ${scoreText(lowRecord.overallScore)}` : "N/A"}</strong>
      <p>Watch this row for coaching follow-up.</p>
    </div>
  `;
}

export function renderTable(bodyElement, records, selectedRowKey, onRowSelect) {
  bodyElement.innerHTML = "";
  if (!records.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = COLUMNS.length;
    cell.innerHTML = '<div class="status-message">No rows match the current filters.</div>';
    row.appendChild(cell);
    bodyElement.appendChild(row);
    return;
  }

  records.forEach((record) => {
    const rowState = getRowState(record);
    const row = document.createElement("tr");
    row.className = `table-data-row table-data-row-${rowState}${selectedRowKey === record.key ? " is-selected" : ""}`;
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-expanded", selectedRowKey === record.key ? "true" : "false");
    row.innerHTML = COLUMNS.map((column) => buildTableCell(column, record)).join("");
    row.addEventListener("click", () => onRowSelect(record.key));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRowSelect(record.key);
      }
    });
    bodyElement.appendChild(row);

    if (selectedRowKey === record.key) {
      const detailRow = document.createElement("tbody");
      detailRow.innerHTML = renderExpandedRow(record);
      bodyElement.appendChild(detailRow.firstElementChild);
    }
  });
}

function getSortValue(record, key) {
  const sortMap = {
    transfer: record.transferScore,
    admits: record.admitsScore,
    aht: record.ahtScore,
    attendance: record.attendanceScore,
    qa: record.qaScore,
  };
  return sortMap[key] ?? record[key];
}

export function sortRecords(records, sortState) {
  const direction = sortState.direction === "asc" ? 1 : -1;
  return [...records].sort((left, right) => {
    const leftValue = getSortValue(left, sortState.key);
    const rightValue = getSortValue(right, sortState.key);

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }

    return String(leftValue).localeCompare(String(rightValue)) * direction;
  });
}

export function exportRowsToCsv(records) {
  const headerRow = COLUMNS.map((column) => column.label).join(",");
  const lines = records.map((record) => {
    const values = [
      record.agentName,
      record.weekEnding,
      `${record.transferRateDisplay} ${record.transferScore ?? "N/A"}`,
      `${record.admitsCount === null || record.admitsCount === undefined ? "N/A" : Number(record.admitsCount).toFixed(0)} ${record.admitsScore ?? "N/A"}`,
      `${record.ahtDisplay} ${record.ahtScore ?? "N/A"}`,
      `${record.attendancePercentDisplay} ${record.attendanceScore ?? "N/A"}`,
      `${record.qaPercentDisplay} ${record.qaScore ?? "N/A"}`,
      record.performanceScore === null || record.performanceScore === undefined ? "N/A" : Number(record.performanceScore).toFixed(2),
      record.overallScore === null || record.overallScore === undefined ? "N/A" : Number(record.overallScore).toFixed(2),
    ];
    return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
  });

  const csv = [headerRow, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "flyland-kpi-dashboard.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
