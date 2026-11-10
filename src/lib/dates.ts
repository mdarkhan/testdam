// Asia/Dhaka is UTC+6 all year (no DST since 2009), so a fixed offset is exact.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of the given instant, as seen in Dhaka. */
export function dhakaDateString(d: Date): string {
  return new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Parses "YYYY-MM-DD" (a Dhaka calendar day) → UTC instant of 23:59:59.999 that day in Dhaka. */
export function endOfDhakaDay(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (dhakaDateString(new Date(utc - DHAKA_OFFSET_MS)) !== ymd.trim()) return null; // e.g. 2026-02-31
  return new Date(utc - DHAKA_OFFSET_MS + DAY_MS - 1);
}

/** Parses "YYYY-MM-DD" → UTC instant of 12:00 that day in Dhaka (used for "verified on" dates from CSV). */
export function noonDhakaDay(ymd: string): Date | null {
  const end = endOfDhakaDay(ymd);
  return end ? new Date(end.getTime() + 1 - DAY_MS / 2) : null;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

/** Adds whole days to a Dhaka "YYYY-MM-DD". */
export function addDhakaDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
