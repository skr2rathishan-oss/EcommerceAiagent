/**
 * date.utils.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Utility functions for normalizing conversational date expressions (e.g. 
 * "tomorrow", "heta", "next day") into ISO YYYY-MM-DD strings using the 
 * Asia/Colombo timezone (UTC+05:30).
 *
 * Required because the Kapruka MCP API rejects relative date strings and 
 * requires strict YYYY-MM-DD input.
 */

const COLOMBO_TZ = "Asia/Colombo";

/**
 * Returns a date string in "YYYY-MM-DD" format for the given Date object,
 * interpreted in the Asia/Colombo timezone.
 *
 * @param {Date} date
 * @returns {string}  e.g. "2026-06-26"
 */
export function formatDateLKR(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

/**
 * Normalises a conversational or structured date string to "YYYY-MM-DD" 
 * (Asia/Colombo timezone).
 *
 * Supported inputs
 * ────────────────
 * Relative (English)   : "today", "tomorrow", "next day", "day after tomorrow"
 * Relative (Sinhala)   : "ada", "heta", "anidda"
 * Relative (Tamil)     : "indru", "naalai", "naaLai"
 * ISO / numeric        : "2026-06-26", "26/06/2026", "26-06-2026"
 * Fallback             : returns tomorrow's date so the flow never stalls
 *
 * @param {string|null|undefined} dateStr   - Raw user input
 * @returns {string}                        - Normalised YYYY-MM-DD string
 */
export function normalizeDeliveryDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateLKR(d);
  }

  const clean = dateStr.toLowerCase().trim();

  // ── Relative: today ───────────────────────────────────────────────────────
  if (["today", "ada", "indru"].some(k => clean.includes(k))) {
    return formatDateLKR(new Date());
  }

  // ── Relative: tomorrow ────────────────────────────────────────────────────
  if (["tomorrow", "heta", "naalai", "naaalai"].some(k => clean.includes(k))) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateLKR(d);
  }

  // ── Relative: day after tomorrow / next day ───────────────────────────────
  if (["next day", "day after", "anidda"].some(k => clean.includes(k))) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return formatDateLKR(d);
  }

  // ── Already ISO YYYY-MM-DD ────────────────────────────────────────────────
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // ── YYYY/MM/DD ────────────────────────────────────────────────────────────
  const ymd = clean.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // ── DD/MM/YYYY or DD-MM-YYYY ──────────────────────────────────────────────
  const dmy = clean.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // ── Natural language with month name  e.g. "June 25" / "25 June 2026" ────
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return formatDateLKR(parsed);
    }
  } catch (_) { /* ignore */ }

  // ── Fallback: tomorrow ────────────────────────────────────────────────────
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 1);
  return formatDateLKR(fallback);
}
