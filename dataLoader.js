export const DATA_SOURCES = {
  admits:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeRQW4lRoAHT-2wqV68VMa7L9qDTrBTLqM80Mc1ixmBJ97nv4Ua5k0iCvdxLmlr09oVLgMgXiLeMAx/pub?gid=936775180&single=true&output=csv",
  transfer:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeRQW4lRoAHT-2wqV68VMa7L9qDTrBTLqM80Mc1ixmBJ97nv4Ua5k0iCvdxLmlr09oVLgMgXiLeMAx/pub?gid=1405898281&single=true&output=csv",
  aht:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeRQW4lRoAHT-2wqV68VMa7L9qDTrBTLqM80Mc1ixmBJ97nv4Ua5k0iCvdxLmlr09oVLgMgXiLeMAx/pub?gid=75889616&single=true&output=csv",
  qa:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeRQW4lRoAHT-2wqV68VMa7L9qDTrBTLqM80Mc1ixmBJ97nv4Ua5k0iCvdxLmlr09oVLgMgXiLeMAx/pub?gid=1889029070&single=true&output=csv",
  attendance:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeRQW4lRoAHT-2wqV68VMa7L9qDTrBTLqM80Mc1ixmBJ97nv4Ua5k0iCvdxLmlr09oVLgMgXiLeMAx/pub?gid=1883055018&single=true&output=csv",
  primaryKey:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeRQW4lRoAHT-2wqV68VMa7L9qDTrBTLqM80Mc1ixmBJ97nv4Ua5k0iCvdxLmlr09oVLgMgXiLeMAx/pub?gid=1217733890&single=true&output=csv",
};

const FIELD_ALIASES = {
  weekending: "weekEnding",
  week_ending: "weekEnding",
  date: "dateRange",
  agent: "agentName",
  username: "agentName",
  user_name: "agentName",
  emails: "email",
  email: "email",
  useremail: "email",
  user_email: "email",
  count: "admitsCount",
  firsttimecaller: "firstTimeCaller",
  first_time_caller: "firstTimeCaller",
  transfercount: "transferCount",
  transfer_count: "transferCount",
  inboundcalls: "inboundCalls",
  inbound_calls: "inboundCalls",
  inboundminutes: "inboundMinutes",
  inbound_minutes: "inboundMinutes",
  holdtime: "holdTime",
  hold_time: "holdTime",
  qascore: "qaPercent",
  qa_score: "qaPercent",
  totalhourspresent: "hoursPresent",
  total_hours_present: "hoursPresent",
  totalhoursabsent: "hoursAbsent",
  total_hours_absent: "hoursAbsent",
  totalsickleavehours: "sickLeaveHours",
  total_sick_leave_hours: "sickLeaveHours",
  undertime: "undertimeHours",
  requiredhours: "requiredHours",
  required_hours: "requiredHours",
  attendancepercentage: "attendancePercent",
  attendance_percentage: "attendancePercent",
  id1: "displayName",
  id2: "altNameOne",
  id3: "altNameTwo",
};

function normalizeHeader(header) {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function csvToRows(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => String(cell).trim() !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => String(cell).trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function mapRecord(headers, row) {
  return headers.reduce((record, header, index) => {
    const alias = FIELD_ALIASES[header] || header;
    record[alias] = row[index] ?? "";
    return record;
  }, {});
}

async function fetchCsv(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load data from ${url}`);
  }
  return response.text();
}

async function fetchDataset(url) {
  const text = await fetchCsv(url);
  const rows = csvToRows(text);
  const [headerRow = [], ...bodyRows] = rows;
  const headers = headerRow.map(normalizeHeader);
  return bodyRows.map((row) => mapRecord(headers, row));
}

export async function loadAllDatasets() {
  const sourceEntries = Object.entries(DATA_SOURCES);
  const datasets = await Promise.all(
    sourceEntries.map(async ([key, url]) => [key, await fetchDataset(url)])
  );

  return Object.fromEntries(datasets);
}
