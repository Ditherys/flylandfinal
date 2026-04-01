function safeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(String(value).replace(/[,%]/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function titleCaseMonth(date) {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function parseWeekEnding(value) {
  if (!value) return null;
  const [month, day, year] = String(value).trim().split("/");
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function secondsFromDuration(duration) {
  if (!duration) return 0;

  const parts = String(duration)
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }
  return parts[0] ?? 0;
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeDisplayName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeAlias(value) {
  return normalizeDisplayName(value)
    .toLowerCase()
    .replace(/phillies$/i, "")
    .replace(/,/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeKey(identity, weekEnding) {
  return `${String(identity ?? "").trim()}__${String(weekEnding ?? "").trim()}`;
}

export function calculateTransferRate(transferCount, firstTimeCaller) {
  if (transferCount === null || firstTimeCaller === null || !firstTimeCaller) return null;
  return transferCount / firstTimeCaller;
}

export function calculateTransferScore(transferRate) {
  if (transferRate === null || transferRate === undefined || Number.isNaN(transferRate)) return null;
  const percent = transferRate * 100;
  if (percent < 4) return 1;
  if (percent <= 8) return 2;
  if (percent <= 10) return 3;
  if (percent <= 15) return 4;
  return 5;
}

export function calculateAdmitsScore(count) {
  if (count === null || count === undefined || Number.isNaN(count)) return null;
  if (!count) return 1;
  if (count <= 4) return 2;
  if (count <= 8) return 3;
  if (count <= 13) return 4;
  return 5;
}

export function calculateAHT(inboundMinutes, holdTime, inboundCalls) {
  if (inboundCalls === null || inboundCalls === undefined || !inboundCalls) return null;
  if (!inboundMinutes && !holdTime) return null;
  const totalSeconds = secondsFromDuration(inboundMinutes) + secondsFromDuration(holdTime);
  return totalSeconds / inboundCalls;
}

export function calculateAHTScore(ahtSeconds) {
  if (ahtSeconds === null || ahtSeconds === undefined || Number.isNaN(ahtSeconds)) return null;
  if (ahtSeconds < 104) return 5;
  if (ahtSeconds <= 140) return 4;
  if (ahtSeconds <= 176) return 3;
  if (ahtSeconds <= 212) return 2;
  return 1;
}

export function calculateAttendanceScore(attendancePercentRaw) {
  if (attendancePercentRaw === null || attendancePercentRaw === undefined || attendancePercentRaw === "") {
    return 4;
  }
  const attendancePercent = safeNumber(attendancePercentRaw);
  if (attendancePercent === null) return 4;
  if (attendancePercent >= 100) return 5;
  if (attendancePercent >= 95) return 3;
  if (attendancePercent >= 90) return 2;
  return 1;
}

export function calculateQAScore(qaPercentRaw) {
  const qaPercent = safeNumber(qaPercentRaw);
  if (qaPercent === null) return null;
  if (qaPercent >= 100) return 5;
  if (qaPercent >= 99) return 4;
  if (qaPercent >= 98) return 3;
  if (qaPercent >= 95) return 2;
  return 1;
}

export function calculatePerformanceScore(transferScore, admitsScore, ahtScore) {
  const scores = [transferScore, admitsScore, ahtScore]
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
  if (!scores.length) return null;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

export function getOverallComposition(performanceScore, attendanceScore, qaScore) {
  const baseWeights = {
    performance: 0.5,
    attendance: 0.25,
    qa: 0.25,
  };
  const availability = {
    performance: typeof performanceScore === "number" && !Number.isNaN(performanceScore),
    attendance: typeof attendanceScore === "number" && !Number.isNaN(attendanceScore),
    qa: typeof qaScore === "number" && !Number.isNaN(qaScore),
  };
  const activeWeight = Object.entries(baseWeights).reduce(
    (sum, [key, weight]) => sum + (availability[key] ? weight : 0),
    0
  );

  return {
    activeWeight,
    includesQa: availability.qa,
    weights: {
      performance: availability.performance && activeWeight ? baseWeights.performance / activeWeight : 0,
      attendance: availability.attendance && activeWeight ? baseWeights.attendance / activeWeight : 0,
      qa: availability.qa && activeWeight ? baseWeights.qa / activeWeight : 0,
    },
  };
}

export function calculateOverallScore(performanceScore, attendanceScore, qaScore) {
  const composition = getOverallComposition(performanceScore, attendanceScore, qaScore);
  if (!composition.activeWeight) return null;

  return (
    performanceScore * composition.weights.performance +
    attendanceScore * composition.weights.attendance +
    qaScore * composition.weights.qa
  );
}

function formatAHT(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return "N/A";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return `${Number(value).toFixed(digits)}%`;
}

function buildPrimaryKeyLookup(rows) {
  const byEmail = new Map();
  const byAlias = new Map();

  rows.forEach((row) => {
    const email = normalizeEmail(row.email);
    const displayName = normalizeDisplayName(row.displayName);
    const aliases = [
      displayName,
      normalizeDisplayName(row.altNameOne),
      normalizeDisplayName(row.altNameTwo),
    ].filter(Boolean);

    const entry = {
      identity: displayName || email,
      email,
      displayName,
      aliases,
    };

    if (email) {
      const emailEntries = byEmail.get(email) || [];
      emailEntries.push(entry);
      byEmail.set(email, emailEntries);
    }

    aliases.forEach((alias) => {
      const normalized = normalizeAlias(alias);
      if (!normalized) return;
      const aliasEntries = byAlias.get(normalized) || [];
      aliasEntries.push(entry);
      byAlias.set(normalized, aliasEntries);
    });
  });

  return { byEmail, byAlias };
}

function resolvePerson(primaryKeyLookup, email, fallbackName) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedFallback = normalizeAlias(fallbackName);
  const emailMatches = primaryKeyLookup.byEmail.get(normalizedEmail) || [];

  if (emailMatches.length === 1) {
    return emailMatches[0];
  }

  if (emailMatches.length > 1 && normalizedFallback) {
    const exact = emailMatches.find((entry) =>
      entry.aliases.some((alias) => normalizeAlias(alias) === normalizedFallback)
    );
    if (exact) return exact;
  }

  if (normalizedFallback) {
    const aliasMatches = primaryKeyLookup.byAlias.get(normalizedFallback) || [];
    if (aliasMatches.length === 1) return aliasMatches[0];
    if (aliasMatches.length > 1) {
      const emailExact = aliasMatches.find((entry) => entry.email === normalizedEmail);
      if (emailExact) return emailExact;
      return aliasMatches[0];
    }
  }

  return {
    identity: normalizedEmail || normalizeDisplayName(fallbackName),
    email: normalizedEmail,
    displayName: normalizeDisplayName(fallbackName),
    aliases: [normalizeDisplayName(fallbackName)].filter(Boolean),
  };
}

function mergeRows(rows, registry, sourceName, primaryKeyLookup) {
  rows.forEach((row) => {
    const weekEnding = row.weekEnding;
    const email = row.email;
    const person = resolvePerson(primaryKeyLookup, email, row.agentName);
    const key = makeKey(person.identity, weekEnding);

    if (!weekEnding || !person.identity) return;

    const existing = registry.get(key) || {
      key,
      identity: person.identity,
      weekEnding,
      weekDate: parseWeekEnding(weekEnding),
      monthLabel: "",
      email: person.email || normalizeEmail(email),
      dateRange: row.dateRange || "",
      agentName: person.displayName || "",
      sourceFlags: {},
    };

    Object.assign(existing, row);
    existing.identity = person.identity;
    existing.agentName = person.displayName || normalizeDisplayName(row.agentName || existing.agentName);
    existing.email = person.email || normalizeEmail(email);
    existing.dateRange = existing.dateRange || row.dateRange || "";
    existing.monthLabel = existing.weekDate ? titleCaseMonth(existing.weekDate) : "Unknown";
    existing.sourceFlags[sourceName] = true;
    registry.set(key, existing);
  });
}

function average(items, selector) {
  const values = items
    .map((item) => selector(item))
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function groupByWeek(records) {
  return records.reduce((map, record) => {
    const bucket = map.get(record.weekEnding) || [];
    bucket.push(record);
    map.set(record.weekEnding, bucket);
    return map;
  }, new Map());
}

export function getTopPerformers(records, limit = 5) {
  return [...records]
    .filter((record) => typeof record.overallScore === "number" && !Number.isNaN(record.overallScore))
    .sort((left, right) => right.overallScore - left.overallScore)
    .slice(0, limit);
}

export function getBottomPerformers(records, limit = 5) {
  return [...records]
    .filter((record) => typeof record.overallScore === "number" && !Number.isNaN(record.overallScore))
    .sort((left, right) => left.overallScore - right.overallScore)
    .slice(0, limit);
}

export function buildKpiDataset(rawDatasets) {
  const registry = new Map();
  const primaryKeyLookup = buildPrimaryKeyLookup(rawDatasets.primaryKey || []);

  ["admits", "transfer", "aht", "qa", "attendance"].forEach((sourceName) => {
    mergeRows(rawDatasets[sourceName] || [], registry, sourceName, primaryKeyLookup);
  });

  const records = [...registry.values()]
    .map((record) => {
      const admitsCount = safeNumber(record.admitsCount) ?? 0;
      const firstTimeCaller = safeNumber(record.firstTimeCaller);
      const transferCount = safeNumber(record.transferCount);
      const inboundCalls = safeNumber(record.inboundCalls);
      const rawAdmitsCount = safeNumber(record.admitsCount);
      const transferRate = calculateTransferRate(transferCount, firstTimeCaller);
      const transferScore = calculateTransferScore(transferRate);
      const admitsScore = calculateAdmitsScore(rawAdmitsCount);
      const ahtSeconds = calculateAHT(record.inboundMinutes, record.holdTime, inboundCalls);
      const ahtScore = calculateAHTScore(ahtSeconds);
      const attendanceScore = calculateAttendanceScore(record.attendancePercent);
      const qaScore = calculateQAScore(record.qaPercent);
      const performanceScore = calculatePerformanceScore(transferScore, admitsScore, ahtScore);
      const overallComposition = getOverallComposition(performanceScore, attendanceScore, qaScore);
      const overallScore = calculateOverallScore(performanceScore, attendanceScore, qaScore);

      return {
        ...record,
        admitsCount,
        firstTimeCaller,
        transferCount,
        inboundCalls,
        transferRate,
        transferRatePercent: transferRate === null ? null : transferRate * 100,
        transferRateDisplay: formatPercent(transferRate === null ? null : transferRate * 100),
        transferScore,
        admitsScore,
        ahtSeconds,
        ahtDisplay: formatAHT(ahtSeconds),
        ahtScore,
        attendancePercentValue: safeNumber(record.attendancePercent),
        attendancePercentDisplay: formatPercent(safeNumber(record.attendancePercent)),
        attendanceScore,
        qaPercentValue: safeNumber(record.qaPercent),
        qaPercentDisplay: formatPercent(safeNumber(record.qaPercent)),
        qaScore,
        performanceScore,
        overallScore,
        overallIncludesQa: overallComposition.includesQa,
        overallWeights: overallComposition.weights,
      };
    })
    .sort((left, right) => {
      const leftTime = left.weekDate?.getTime() ?? 0;
      const rightTime = right.weekDate?.getTime() ?? 0;
      return leftTime - rightTime || left.agentName.localeCompare(right.agentName);
    });

  const weekGroups = groupByWeek(records);
  const weeklyAverages = [...weekGroups.entries()]
    .map(([weekEnding, items]) => ({
      weekEnding,
      weekDate: items[0]?.weekDate || parseWeekEnding(weekEnding),
      monthLabel: items[0]?.monthLabel || "Unknown",
      transferScore: average(items, (item) => item.transferScore),
      admitsScore: average(items, (item) => item.admitsScore),
      ahtScore: average(items, (item) => item.ahtScore),
      attendanceScore: average(items, (item) => item.attendanceScore),
      qaScore: average(items, (item) => item.qaScore),
      performanceScore: average(items, (item) => item.performanceScore),
      overallScore: average(items, (item) => item.overallScore),
      overallIncludesQa: items.some((item) => item.overallIncludesQa),
      overallWeights: {
        performance: average(items, (item) => item.overallWeights?.performance),
        attendance: average(items, (item) => item.overallWeights?.attendance),
        qa: average(items, (item) => item.overallWeights?.qa),
      },
      transferRatePercent: average(items, (item) => item.transferRatePercent),
      admitsCount: average(items, (item) => item.admitsCount),
      ahtSeconds: average(items, (item) => item.ahtSeconds),
      attendancePercentValue: average(items, (item) => item.attendancePercentValue),
      qaPercentValue: average(items, (item) => item.qaPercentValue),
      agentCount: items.length,
    }))
    .sort((left, right) => (left.weekDate?.getTime() ?? 0) - (right.weekDate?.getTime() ?? 0));

  return {
    records,
    weeklyAverages,
    monthOptions: [...new Set(records.map((record) => record.monthLabel))],
    weekOptions: [...new Set(records.map((record) => record.weekEnding))],
    agentOptions: [...new Set(records.map((record) => record.agentName))].sort((left, right) =>
      left.localeCompare(right)
    ),
  };
}
