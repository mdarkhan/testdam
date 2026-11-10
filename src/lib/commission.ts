// Commission maths and statement months — pure, unit-tested (tests/commission.test.ts).
// Rates are stored as integer basis points (1000 = 10%) so no float ever touches money.
import { bnToAsciiDigits } from "./normalize";

export const MAX_BPS = 5000; // 50% — anything higher is a typo

/** "10" / "12.5" / "১০" → basis points (1000 / 1250). Blank → null. Invalid → NaN. */
export function percentToBps(input: string | null | undefined): number | null {
  const s = bnToAsciiDigits(input ?? "").trim().replace(/%$/, "").trim();
  if (!s) return null;
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(s)) return Number.NaN;
  const [whole, frac = ""] = s.split(".");
  const bps = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return bps <= MAX_BPS ? bps : Number.NaN;
}

/** 1250 → "12.5", 1000 → "10". */
export function bpsToPercent(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = String(bps % 100).padStart(2, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/** Commission in whole taka, rounded half up. */
export function commissionFor(bill: number, bps: number): number {
  return Math.round((bill * bps) / 10_000);
}

/** "2026-11" → [1 Nov, 1 Dec) as UTC midnights — testedOn is a DATE column read as UTC midnight. */
export function monthRange(ym: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12 || y < 2020 || y > 2100) return null;
  return { start: new Date(Date.UTC(y, mo - 1, 1)), end: new Date(Date.UTC(y, mo, 1)) };
}

/** The month (YYYY-MM) of a Dhaka calendar day string "YYYY-MM-DD". */
export const monthOf = (ymd: string) => ymd.slice(0, 7);

/** Previous / next month of "YYYY-MM". */
export function shiftMonth(ym: string, by: number): string {
  const r = monthRange(ym)!;
  const d = new Date(Date.UTC(r.start.getUTCFullYear(), r.start.getUTCMonth() + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ── Lab statements ──

export type StatementRow = {
  code: string; testedOn: string; patient: string; tests: string;
  bill: number; bps: number; commission: number; status: "PENDING" | "INVOICED" | "PAID" | "WAIVED";
};

/** Due = pending + invoiced (not yet paid); waived rows count towards nothing owed. */
export function statementTotals(rows: StatementRow[]) {
  const sum = (f: (r: StatementRow) => boolean) => rows.filter(f).reduce((s, r) => s + r.commission, 0);
  return {
    count: rows.length,
    bill: rows.reduce((s, r) => s + r.bill, 0),
    commission: sum((r) => r.status !== "WAIVED"),
    due: sum((r) => r.status === "PENDING" || r.status === "INVOICED"),
    paid: sum((r) => r.status === "PAID"),
    waived: sum((r) => r.status === "WAIVED"),
  };
}

/** One CSV cell: quoted when needed, and text a spreadsheet would run as a formula is defused. */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // patient names come from a public form
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function statementCsv(rows: StatementRow[], meta: { lab: string; month: string }): string {
  const t = statementTotals(rows);
  const lines: Array<Array<string | number>> = [
    ["Test Mate commission statement"],
    ["Lab", meta.lab],
    ["Month", meta.month],
    [],
    ["Booking code", "Test date", "Patient", "Tests", "Bill (BDT)", "Rate (%)", "Commission (BDT)", "Status"],
    ...rows.map((r) => [r.code, r.testedOn, r.patient, r.tests, r.bill, bpsToPercent(r.bps), r.commission, r.status]),
    [],
    ["Total bills", "", "", "", t.bill],
    ["Total commission", "", "", "", "", "", t.commission],
    ["Due (pending + invoiced)", "", "", "", "", "", t.due],
    ["Paid", "", "", "", "", "", t.paid],
  ];
  return lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
