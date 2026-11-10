import "server-only";
// Commission statements: bookings with a recorded bill, by test month (ADMIN pages and CSV).
import { db } from "./db";
import { dhakaDateString } from "./dates";
import { monthRange, type StatementRow } from "./commission";

export const currentMonth = () => dhakaDateString(new Date()).slice(0, 7);

/** "2026-11" when valid, else this month in Dhaka. */
export const pickMonth = (m: string | undefined) => (m && monthRange(m) ? m : currentMonth());

export async function loadStatementRows(month: string, labId?: number) {
  const range = monthRange(month)!;
  const bookings = await db.bookingRequest.findMany({
    where: {
      testedOn: { gte: range.start, lt: range.end },
      billAmount: { not: null },
      commissionStatus: { not: null },
      ...(labId && { labId }),
    },
    orderBy: [{ testedOn: "asc" }, { id: "asc" }],
    select: {
      id: true, labId: true, code: true, testedOn: true, patientName: true, billAmount: true, commissionBps: true, commissionAmount: true, commissionStatus: true,
      test: { select: { shortName: true, nameEn: true } },
      items: { orderBy: { id: "asc" }, select: { test: { select: { shortName: true, nameEn: true } } } },
      lab: { select: { name: true, branchName: true } },
    },
  });
  return bookings.map((b) => ({
    id: b.id,
    labId: b.labId,
    labName: `${b.lab.name}${b.lab.branchName ? ` (${b.lab.branchName})` : ""}`,
    row: {
      code: b.code ?? `#${b.id}`,
      testedOn: b.testedOn!.toISOString().slice(0, 10),
      patient: b.patientName,
      tests: (b.items.length ? b.items.map((i) => i.test) : [b.test]).map((t) => t.shortName ?? t.nameEn).join(", "),
      bill: b.billAmount!,
      bps: b.commissionBps ?? 0,
      commission: b.commissionAmount ?? 0,
      status: b.commissionStatus!,
    } satisfies StatementRow,
  }));
}
