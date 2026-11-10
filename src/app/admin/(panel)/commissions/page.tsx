import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { shiftMonth, statementTotals } from "@/lib/commission";
import { loadStatementRows, pickMonth } from "@/lib/statements";
import { btn, tableCls } from "@/components/admin/styles";

export const metadata = { title: "Commissions" };

const monthName = (ym: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));
const tk = (n: number) => `৳${n.toLocaleString("en-IN")}`;

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireUser("ADMIN");
  const month = pickMonth((await searchParams).month);
  const [rows, unbilled, partners] = await Promise.all([
    loadStatementRows(month),
    // Done tests nobody has entered a bill for yet (any month): chase the lab for these.
    db.bookingRequest.count({ where: { status: "COMPLETED", billAmount: null } }),
    db.lab.findMany({ where: { isPartner: true }, select: { id: true, name: true, branchName: true, commissionBps: true }, orderBy: { name: "asc" } }),
  ]);

  const byLab = new Map<number, { name: string; rows: typeof rows }>();
  for (const r of rows) {
    const g = byLab.get(r.labId) ?? { name: r.labName, rows: [] };
    g.rows.push(r);
    byLab.set(r.labId, g);
  }
  const labs = [...byLab.entries()].map(([id, g]) => ({ id, name: g.name, t: statementTotals(g.rows.map((r) => r.row)) })).sort((a, b) => b.t.due - a.t.due);
  const all = statementTotals(rows.map((r) => r.row));
  const noRate = partners.filter((p) => p.commissionBps == null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Commissions: {monthName(month)}</h1>
        <nav aria-label="Month" className="flex gap-2">
          <Link href={`/admin/commissions?month=${shiftMonth(month, -1)}`} className={btn("plain")}>← {monthName(shiftMonth(month, -1))}</Link>
          <Link href={`/admin/commissions?month=${shiftMonth(month, 1)}`} className={btn("plain")}>{monthName(shiftMonth(month, 1))} →</Link>
        </nav>
      </div>
      <p className="text-sm text-muted">
        Counts bookings with a bill entered, by test date. Enter bills from <Link href="/admin/bookings?status=COMPLETED" className="text-primary underline">Bookings</Link> (open a booking&apos;s “Commission” section).
      </p>

      {unbilled > 0 && (
        <p className="rounded-md bg-warn-soft px-3 py-2 text-sm">
          {unbilled} completed booking(s) have no bill yet. <Link href="/admin/bookings?status=COMPLETED" className="font-semibold text-primary underline">Enter their bills</Link>
        </p>
      )}
      {noRate.length > 0 && (
        <p className="rounded-md bg-warn-soft px-3 py-2 text-sm">
          Partner lab(s) without an agreed commission rate: {noRate.map((p, i) => (
            <span key={p.id}>{i > 0 && ", "}<Link href={`/admin/labs/${p.id}`} className="text-primary underline">{p.name}{p.branchName ? ` (${p.branchName})` : ""}</Link></span>
          ))}
        </p>
      )}

      <dl className="grid gap-3 sm:grid-cols-4">
        {[["Bookings billed", String(all.count)], ["Bills", tk(all.bill)], ["Commission due", tk(all.due)], ["Commission paid", tk(all.paid)]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-white p-3">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="tabular text-xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {labs.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-4 text-sm text-muted">No bills entered for {monthName(month)}.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className={tableCls}>
            <thead>
              <tr><th>Lab</th><th className="text-right">Bookings</th><th className="text-right">Bills</th><th className="text-right">Commission</th><th className="text-right">Due</th><th className="text-right">Paid</th><th /></tr>
            </thead>
            <tbody className="tabular">
              {labs.map((l) => (
                <tr key={l.id}>
                  <td className="font-semibold">{l.name}</td>
                  <td className="text-right">{l.t.count}</td>
                  <td className="text-right">{tk(l.t.bill)}</td>
                  <td className="text-right">{tk(l.t.commission)}</td>
                  <td className="text-right font-semibold">{tk(l.t.due)}</td>
                  <td className="text-right">{tk(l.t.paid)}</td>
                  <td className="text-right"><Link href={`/admin/commissions/${l.id}?month=${month}`} className="text-primary underline">Statement</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
