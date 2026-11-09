import Link from "next/link";
import { db } from "@/lib/db";
import { staleCutoff } from "@/lib/pricing";
import { requireUser } from "@/lib/auth";
import { dhakaDateString } from "@/lib/dates";
import { btn, tableCls } from "@/components/admin/styles";

export const metadata = { title: "Labs" };

export default async function LabsPage({ searchParams }: { searchParams: Promise<{ area?: string; sort?: string }> }) {
  await requireUser();
  const { area, sort } = await searchParams;
  const areaId = area ? Number(area) : undefined;
  const staleBefore = staleCutoff();
  const [areas, labs, stats, staleCounts] = await Promise.all([
    db.area.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true } }),
    db.lab.findMany({ where: { areaId }, orderBy: { name: "asc" }, include: { area: { select: { nameEn: true } } } }),
    db.labTestPrice.groupBy({ by: ["labId"], _count: true, _max: { verifiedAt: true } }),
    db.labTestPrice.groupBy({ by: ["labId"], where: { verifiedAt: { lt: staleBefore } }, _count: true }),
  ]);
  const byLab = new Map(stats.map((s) => [s.labId, s]));
  const staleByLab = new Map(staleCounts.map((s) => [s.labId, s._count]));
  const rows = labs.map((l) => ({ ...l, prices: byLab.get(l.id)?._count ?? 0, last: byLab.get(l.id)?._max.verifiedAt, stale: staleByLab.get(l.id) ?? 0 }));
  if (sort === "stale") rows.sort((a, b) => b.stale - a.stale);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Labs ({rows.length})</h1>
        <Link href="/admin/labs/new" className={btn()}>Add lab</Link>
      </div>
      <form className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-sm font-semibold">Area
          <select name="area" defaultValue={area ?? ""} className="mt-1 block min-h-11 rounded-md border border-slate-300 px-3">
            <option value="">All areas</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nameEn}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Sort
          <select name="sort" defaultValue={sort ?? ""} className="mt-1 block min-h-11 rounded-md border border-slate-300 px-3">
            <option value="">Name</option>
            <option value="stale">Most stale prices first</option>
          </select>
        </label>
        <button className={btn("plain")}>Apply</button>
      </form>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
        <table className={tableCls}>
          <thead><tr><th>Lab</th><th>Area</th><th>Phone</th><th>Prices</th><th>Stale</th><th>Last verified</th><th></th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className={l.isActive ? "" : "text-stale"}>
                <td>
                  <Link href={`/admin/labs/${l.id}`} className="font-semibold text-primary underline">{l.name}</Link>
                  {l.branchName && <span className="text-muted"> · {l.branchName}</span>}
                  {!l.isActive && <span className="ml-1 rounded bg-slate-200 px-1 text-xs">inactive</span>}
                  {l.isFeatured && <span className="ml-1 rounded bg-primary-soft px-1 text-xs text-primary">featured</span>}
                </td>
                <td>{l.area.nameEn}</td>
                <td className="tabular">{l.phone}</td>
                <td className="tabular">{l.prices}</td>
                <td className={`tabular ${l.stale ? "font-semibold text-danger" : ""}`}>{l.stale}</td>
                <td className="tabular">{l.last ? dhakaDateString(l.last) : "—"}</td>
                <td><Link href={`/admin/labs/${l.id}/prices`} className={btn("plain")}>Edit prices</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
