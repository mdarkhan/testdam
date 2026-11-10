import Link from "next/link";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { requireUser } from "@/lib/auth";
import { dhakaDateString } from "@/lib/dates";
import { DUE_SOON_DAYS, freshness } from "@/lib/pricing";
import { btn, tableCls } from "@/components/admin/styles";

export const metadata = { title: "Call list" };

/** Which labs to call next: most stale prices first, then most "due soon", then oldest verification. */
export default async function StalePage() {
  await requireUser();
  const now = new Date();
  const labs = await db.lab.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, branchName: true, phone: true, whatsapp: true,
      area: { select: { nameEn: true } },
      prices: { select: { verifiedAt: true, discountExpiresAt: true } },
    },
  });
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
  const rows = labs
    .map((l) => {
      const counts = { fresh: 0, due: 0, stale: 0 };
      for (const p of l.prices) counts[freshness(p, now)]++;
      const oldest = l.prices.reduce<Date | null>((m, p) => (!m || p.verifiedAt < m ? p.verifiedAt : m), null);
      const offersEnding = l.prices.filter((p) => p.discountExpiresAt && p.discountExpiresAt >= now && p.discountExpiresAt <= weekAhead).length;
      return { ...l, ...counts, total: l.prices.length, oldest, offersEnding };
    })
    .filter((r) => r.stale || r.due || r.offersEnding)
    .sort((a, b) => b.stale - a.stale || b.due - a.due || (a.oldest?.getTime() ?? 0) - (b.oldest?.getTime() ?? 0));

  const totals = rows.reduce((t, r) => ({ stale: t.stale + r.stale, due: t.due + r.due }), { stale: 0, due: 0 });

  return (
    <>
      <h1 className="text-xl font-semibold">Call list — prices to re-check</h1>
      <p className="mt-1 text-sm text-muted">
        Stale = verified more than {config.freshDays} days ago (greyed on the site, never “cheapest”, and they don&apos;t count toward a page being published).
        Due = goes stale within {DUE_SOON_DAYS} days. Call the top lab first, then use “Mark verified today” or edit the prices in its grid.
      </p>
      <p className="mt-3 text-sm"><strong className="text-danger">{totals.stale}</strong> stale and <strong>{totals.due}</strong> due prices across <strong>{rows.length}</strong> labs.</p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-line bg-white p-4 text-sm">Nothing to call — every price is fresh.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
          <table className={tableCls}>
            <thead><tr><th>#</th><th>Lab</th><th>Phone</th><th>Stale</th><th>Due</th><th>Fresh</th><th>Offers ending ≤ 7 days</th><th>Oldest check</th><th></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="tabular text-muted">{i + 1}</td>
                  <td><span className="font-semibold">{r.name}</span>{r.branchName && <span className="text-muted"> · {r.branchName}</span>}<span className="block text-xs text-muted">{r.area.nameEn}</span></td>
                  <td className="tabular"><a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="text-primary underline">{r.phone}</a></td>
                  <td className={`tabular ${r.stale ? "font-semibold text-danger" : ""}`}>{r.stale}</td>
                  <td className="tabular">{r.due}</td>
                  <td className="tabular text-muted">{r.fresh} / {r.total}</td>
                  <td className="tabular">{r.offersEnding || ""}</td>
                  <td className="tabular">{r.oldest ? dhakaDateString(r.oldest) : "—"}</td>
                  <td><Link href={`/admin/labs/${r.id}/prices?check=1`} className={btn("plain")}>Open grid</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
