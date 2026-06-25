import "../config/loadEnv.mjs";

function formatDateLKR(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    const d = new Date();
    d.setDate(d.getDate() + 1); // default to tomorrow
    return formatDateLKR(d);
  }
  
  const clean = dateStr.toLowerCase().trim();
  
  // Conversational relative dates
  if (clean.includes("tomorrow") || clean.includes("heta")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateLKR(d);
  }
  if (clean.includes("next day") || clean.includes("day after") || clean.includes("anidda")) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return formatDateLKR(d);
  }
  if (clean.includes("today") || clean === "ada") {
    const d = new Date();
    return formatDateLKR(d);
  }
  
  // Format YYYY-MM-DD
  const yyyymmdd = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yyyymmdd) {
    const [_, y, m, d] = yyyymmdd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  
  // Format DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddmmyyyy) {
    const [_, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return formatDateLKR(parsed);
    }
  } catch (e) {}
  
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateLKR(d);
}

console.log("Today LKR:", formatDateLKR(new Date()));
console.log("tomorrow ->", normalizeDate("tomorrow"));
console.log("next day ->", normalizeDate("next day"));
console.log("25/06/2026 ->", normalizeDate("25/06/2026"));
console.log("2026-06-25 ->", normalizeDate("2026-06-25"));
console.log("invalid ->", normalizeDate("invalid-date"));
