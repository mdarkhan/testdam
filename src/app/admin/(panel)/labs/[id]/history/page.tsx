import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dhakaDateString } from "@/lib/dates";
import { btn, tableCls } from "@/components/admin/styles";

export const metadata = { title: "Price history" };

const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });

/** Append-only PriceHistory for one lab (optionally one test), newest first, with the change vs. the previous entry. */
export default async function PriceHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ test?: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { test } = await searchParams;
  const lab = await db.lab.findUnique({ where: { id }, select: { id: true, name: true, branchName: true } });
  if (!lab) notFound();

  const testFilter = test ? await db.test.findUnique({ where: { slug: test }, select: { id: true } }) : null;
  const history = await db.priceHistory.findMany({
    where: { labId: id, ...(testFilter && { testId: testFilter.id }) },
    orderBy: [{ changedAt: "asc" }, { id: "asc" }],
    include: { changedBy: { select: { email: true } } },
    take: 2000,
  });
  const tests = await db.test.findMany({
    where: { id: { in: [...new Set(history.map((h) => h.testId))] } },
    select: { id: true, slug: true, nameEn: true, shortName: true },
  });
  const testName = new Map(tests.map((t) => [t.id, t.shortName ?? t.nameEn]));

  // Effective price of each entry vs. the previous entry for the same test (history is oldest → newest here).
  const last = new Map<number, number>();
  const rows = history.map((h) => {
    const eff = h.discountPrice != null && (h.discountExpiresAt == null || h.discountExpiresAt >= h.changedAt) ? h.discountPrice : h.regularPrice;
    const prev = last.get(h.testId);
    if (eff != null) last.set(h.testId, eff);
    return { ...h, eff, delta: h.change === "UPDATED" && prev != null && eff != null ? eff - prev : null };
  }).reverse();

  return (
    <>
      <Link href={`/admin/labs/${lab.id}/prices`} className="text-sm text-primary underline">← Price grid</Link>
      <h1 className="mt-1 text-xl font-semibold">Price history · {lab.name}{lab.branchName ? ` · ${lab.branchName}` : ""}</h1>
      <p className="mt-1 text-sm text-muted">Every price change is logged here and never edited. Re-verifying a price without changing it is not a change.</p>
      <form className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-sm font-semibold">Test
          <select name="test" defaultValue={test ?? ""} className="mt-1 block min-h-11 rounded-md border border-slate-300 px-2">
            <option value="">All tests</option>
            {[...tests].sort((a, b) => a.nameEn.localeCompare(b.nameEn)).map((t) => <option key={t.id} value={t.slug}>{t.shortName ?? t.nameEn}</option>)}
          </select>
        </label>
        <button className={btn("plain")}>Show</button>
      </form>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
        <table className={tableCls}>
          <thead><tr><th>When (Dhaka)</th><th>Test</th><th>Change</th><th>Regular ৳</th><th>Discount ৳</th><th>Until</th><th>Effective ৳</th><th>Source</th><th>By</th></tr></thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id}>
                <td className="tabular whitespace-nowrap">{when.format(h.changedAt)}</td>
                <td><Link href={`?test=${tests.find((t) => t.id === h.testId)?.slug ?? ""}`} className="text-primary underline">{testName.get(h.testId) ?? h.testId}</Link></td>
                <td>{h.change === "CREATED" ? "Added" : h.change === "DELETED" ? <span className="text-danger">Removed</span> : "Changed"}</td>
                <td className="tabular">{h.regularPrice ?? "—"}</td>
                <td className="tabular">{h.discountPrice ?? ""}</td>
                <td className="tabular">{h.discountExpiresAt ? dhakaDateString(h.discountExpiresAt) : ""}</td>
                <td className="tabular">
                  {h.eff ?? "—"}
                  {h.delta ? <span className={`ml-1 font-semibold ${h.delta > 0 ? "text-danger" : "text-cheapest"}`}>{h.delta > 0 ? `▲ ${h.delta}` : `▼ ${-h.delta}`}</span> : null}
                </td>
                <td>{h.source ?? ""}</td>
                <td className="text-muted">{h.changedBy?.email ?? (h.changedById ? "deleted user" : "seed")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-4 text-sm text-muted">No history yet.</p>}
      </div>
    </>
  );
}
