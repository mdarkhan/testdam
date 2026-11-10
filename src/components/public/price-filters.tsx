"use client";
// Filters the server-rendered cards inside #price-list by toggling `hidden` — the cards themselves
// stay server components, so this is the only JavaScript a price page needs besides search.
import { useState } from "react";
import { bn } from "@/i18n/bn";
import { bnDigits } from "@/lib/format";

type F = { area: string; home: boolean; report: number };

/** Applies the filter to the DOM and returns how many cards remain visible. */
function apply(f: F): number {
  let n = 0;
  document.querySelectorAll<HTMLElement>("#price-list [data-price-row]").forEach((el) => {
    const ok = (!f.area || el.dataset.area === f.area) && (!f.home || el.dataset.home === "1") && (!f.report || Number(el.dataset.report) <= f.report);
    el.hidden = !ok;
    if (ok) n++;
  });
  return n;
}

export function PriceFilters({ areas, total }: { areas?: Array<{ slug: string; nameBn: string }>; total: number }) {
  const [f, setF] = useState<F>({ area: "", home: false, report: 0 });
  const [shown, setShown] = useState(total);
  const update = (patch: Partial<F>) => {
    const next = { ...f, ...patch };
    setF(next);
    setShown(apply(next));
  };

  const field = "min-h-12 rounded-lg border-2 border-slate-300 bg-white px-2 text-base";
  return (
    <section aria-label={bn.filters} className="rounded-xl bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {areas && areas.length > 1 && (
          <label className="text-sm font-semibold">{bn.filterArea}
            <select value={f.area} onChange={(e) => update({ area: e.target.value })} className={`${field} mt-1 block w-full`}>
              <option value="">{bn.filterAllAreas}</option>
              {areas.map((a) => <option key={a.slug} value={a.slug}>{a.nameBn}</option>)}
            </select>
          </label>
        )}
        <label className="text-sm font-semibold">{bn.filterReport}
          <select value={f.report} onChange={(e) => update({ report: Number(e.target.value) })} className={`${field} mt-1 block w-full`}>
            <option value={0}>{bn.filterReportAny}</option>
            <option value={24}>{bn.filterReport24}</option>
            <option value={48}>{bn.filterReport48}</option>
          </select>
        </label>
        <label className="col-span-2 flex min-h-12 items-center gap-3 self-end text-base sm:col-span-1">
          <input type="checkbox" checked={f.home} onChange={(e) => update({ home: e.target.checked })} className="size-5 accent-primary" />
          {bn.filterHome}
        </label>
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-sm text-muted">
        {shown === 0 ? bn.filterNone : bn.filterShowing(bnDigits(shown), bnDigits(total))}
      </p>
    </section>
  );
}
