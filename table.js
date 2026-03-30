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
  const scoreText = score === null || score === undefined || Number.isNaN(score) ? "N/A" : Number(score).toFixed(0);
  return `<div class="kpi-inline"><span>${value}</span><span class="score-pill ${scoreClass}">${scoreText}</span></div>`;
}

function formatValue(column, record) {
  if (column.type === "kpi") {
    return renderKpiCell(record, column.key);
  }
  if (column.type === "number2") {
    return Number(record[column.key]).toFixed(2);
  }
  return record[column.key] ?? "";
}

export function initializeTable(headRow, onSort, sortState) {
  headRow.innerHTML = "";
  COLUMNS.forEach((column) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent =
      sortState.key === column.key
        ? `${column.label} ${sortState.direction === "asc" ? "(asc)" : "(desc)"}`
        : column.label;
    th.addEventListener("click", () => onSort(column.key));
    headRow.appendChild(th);
  });
}

export function renderTable(bodyElement, records) {
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
    const row = document.createElement("tr");
    row.innerHTML = COLUMNS.map((column) => `<td>${formatValue(column, record)}</td>`).join("");
    bodyElement.appendChild(row);
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
