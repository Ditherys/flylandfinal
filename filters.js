export function populateSelect(selectElement, options, placeholder) {
  selectElement.innerHTML = "";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "all";
  placeholderOption.textContent = placeholder;
  selectElement.appendChild(placeholderOption);

  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option;
    optionElement.textContent = option;
    selectElement.appendChild(optionElement);
  });
}

export function getFilteredRecords(records, filters) {
  return records.filter((record) => {
    const matchesMonth = filters.month === "all" || record.monthLabel === filters.month;
    const matchesWeek = filters.week === "all" || record.weekEnding === filters.week;
    const matchesAgent = filters.agent === "all" || record.agentName === filters.agent;
    const searchTarget = `${record.agentName} ${record.weekEnding}`.toLowerCase();
    const matchesSearch =
      !filters.search || searchTarget.includes(filters.search.trim().toLowerCase());

    return matchesMonth && matchesWeek && matchesAgent && matchesSearch;
  });
}

export function getAvailableWeeks(records, monthFilter) {
  return [...new Set(
    records
      .filter((record) => monthFilter === "all" || record.monthLabel === monthFilter)
      .map((record) => record.weekEnding)
  )];
}

export function getAvailableAgents(records, monthFilter, weekFilter) {
  return [...new Set(
    records
      .filter((record) => monthFilter === "all" || record.monthLabel === monthFilter)
      .filter((record) => weekFilter === "all" || record.weekEnding === weekFilter)
      .map((record) => record.agentName)
  )].sort((left, right) => left.localeCompare(right));
}
