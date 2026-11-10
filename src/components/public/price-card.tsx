// One lab's price for one test. Server component: no JavaScript shipped.
import Link from "next/link";
import { bn } from "@/i18n/bn";
import { config } from "@/lib/config";
import { bnDate, reportTime, taka } from "@/lib/format";
import type { Ranked } from "@/lib/pricing";
import type { TestPriceRow } from "@/lib/catalog";

type Row = Ranked<TestPriceRow & { labName: string }>;

export function PriceCard({ row, testName, labHref, showArea = true }: { row: Row; testName: string; labHref: string | null; showArea?: boolean }) {
  const lab = row.lab;
  const discounted = row.effective < row.regularPrice;
  const report = reportTime(row.reportHours);
  const fee = lab.homeCollectionFee;
  const wa = config.whatsappCentralNumber || lab.whatsapp;
  const waText = `আসসালামু আলাইকুম। টেস্টদাম থেকে দেখেছি — ${lab.name}${lab.branchName ? ` (${lab.branchName})` : ""}-এ ${testName} টেস্ট করাতে চাই। দাম ও সময়টা জানাবেন?`;

  return (
    <article
      data-price-row data-area={lab.area.slug} data-home={row.homeCollection ? "1" : "0"} data-report={row.reportHours ?? 9999}
      className={`rounded-xl border bg-white p-4 ${row.cheapest ? "border-2 border-cheapest" : "border-line"} ${row.fresh ? "" : "text-stale"}`}
    >
      {(row.cheapest || lab.isFeatured) && (
        <p className="mb-2 flex flex-wrap gap-2 text-sm font-semibold">
          {row.cheapest && <span className="rounded-full bg-cheapest px-3 py-0.5 text-white">{bn.cheapest}</span>}
          {lab.isFeatured && <span className="rounded-full border border-primary px-3 py-0.5 text-primary" title={bn.featuredNote}>{bn.featured}</span>}
        </p>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug">
            {labHref ? <Link href={labHref} className="underline decoration-slate-300 underline-offset-4 hover:decoration-primary">{lab.nameBn ?? lab.name}</Link> : lab.nameBn ?? lab.name}
          </h3>
          <p className="text-sm text-muted">
            {[lab.branchName, showArea ? lab.area.nameBn : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`tabular text-2xl font-semibold ${row.cheapest ? "text-cheapest" : row.fresh ? "text-ink" : "text-stale"}`}>{taka(row.effective)}</p>
          {discounted && <p className="tabular text-sm text-muted"><s>{taka(row.regularPrice)}</s></p>}
        </div>
      </div>
      {discounted && row.discountExpiresAt && <p className="mt-1 text-sm">{bn.offerUntil(bnDate(row.discountExpiresAt))}</p>}

      <ul className="mt-3 space-y-1 text-sm">
        {report && <li>{bn.report}: <strong>{report}</strong></li>}
        <li>
          {row.homeCollection ? bn.homeCollectionYes : bn.homeCollectionNo}
          {row.homeCollection && fee != null && <> ({fee === 0 ? bn.homeCollectionFree : bn.homeCollectionFee(taka(fee))})</>}
        </li>
        <li className={row.fresh ? "text-muted" : "font-semibold"}>
          {bn.verified(bnDate(row.verifiedAt))} · {bn.sources[row.source] ?? row.source}
        </li>
        {!row.fresh && <li className="font-semibold">{bn.stale}</li>}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={`tel:${lab.phone.replace(/[^\d+]/g, "")}`}
          className={`${wa ? "" : "col-span-2 "}flex min-h-12 items-center justify-center rounded-lg bg-primary px-3 font-semibold text-white hover:bg-primary-hover`}>
          {bn.call}
        </a>
        {wa ? (
          <a href={`https://wa.me/88${wa}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener"
            className="flex min-h-12 items-center justify-center rounded-lg border-2 border-primary px-3 font-semibold text-primary hover:bg-primary-soft">
            {bn.whatsapp}
          </a>
        ) : null}
      </div>
    </article>
  );
}
