"use client";
// A lab's own price list: search box, tests grouped by category, and a row per test that opens
// (native <details>) to show report time, source and the actions — book this test here, add it to
// the list, or compare with other labs. Booking goes through <PriceInteractions> (data-action="book").
import { useMemo, useState } from "react";
import Link from "next/link";
import { bn } from "@/i18n/bn";
import { bnDigits, taka } from "@/lib/format";
import { searchKey } from "@/lib/normalize";
import { BasketToggle } from "./basket-button";

export type LabTestRow = {
  id: number; slug: string; name: string; category: string; keys: string[];
  price: number; regular: number; fresh: boolean; home: boolean;
  meta: string | null; // report time · verified · source (null when the shared line above says it)
  href: string | null; // the test's comparison page, when it is published
  basketable: boolean; // the basket only takes tests with a public page
};

export function LabTestList({ rows, categories, lab, commonVerified }: {
  rows: LabTestRow[];
  categories: Array<{ key: string; label: string }>;
  lab: { slug: string; name: string; areaSlug: string };
  commonVerified: string | null;
}) {
  const [q, setQ] = useState("");
  const key = searchKey(q);
  const shown = useMemo(() => (key ? rows.filter((r) => r.keys.some((k) => k.includes(key))) : rows), [rows, key]);
  const groups = categories.map((c) => ({ ...c, rows: shown.filter((r) => r.category === c.key) })).filter((g) => g.rows.length);

  return (
    <div>
      {rows.length > 8 && (
        <div className="mt-2">
          <label htmlFor="lab-filter" className="text-sm font-semibold">{bn.labFilterLabel}</label>
          <input
            id="lab-filter" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={bn.labFilterPlaceholder}
            autoComplete="off" enterKeyHint="search"
            className="mt-1 block min-h-12 w-full rounded-lg border-2 border-line bg-white px-3 text-base focus:border-primary"
          />
          <p role="status" className="mt-1 text-sm text-muted">{bn.labFilterCount(bnDigits(shown.length), bnDigits(rows.length))}</p>
        </div>
      )}
      {commonVerified && <p className="mt-2 text-sm text-muted">{commonVerified}</p>}
      <p className="mt-1 text-sm text-muted">{bn.labRowHint}</p>

      {shown.length === 0 && <p className="mt-3 rounded-lg bg-primary-soft px-3 py-3">{bn.labFilterNone}</p>}

      {groups.map((g) => (
        <section key={g.key} className="mt-5">
          <h3 className="font-semibold text-muted">{g.label} <span className="font-normal">({bnDigits(g.rows.length)})</span></h3>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {g.rows.map((r) => (
              <li
                key={r.id}
                data-price-row data-lab={lab.slug} data-lab-name={lab.name} data-area={lab.areaSlug}
                data-test={r.slug} data-test-name={r.name} data-price={r.price} data-home={r.home ? "1" : "0"}
                className={r.fresh ? "" : "text-stale"}
              >
                <details className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 font-semibold">{r.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-right">
                        <span className="tabular block text-lg font-semibold">{taka(r.price)}</span>
                        {r.price < r.regular && <span className="tabular block text-sm text-muted"><s>{taka(r.regular)}</s></span>}
                      </span>
                      <svg aria-hidden viewBox="0 0 20 20" className="size-5 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l5 5 5-5" /></svg>
                    </span>
                  </summary>
                  <div className="px-3 pb-3">
                    {r.meta && <p className="text-sm">{r.meta}</p>}
                    {!r.fresh && <p className="text-sm font-semibold">{bn.stale}</p>}
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {r.fresh && (
                        <button type="button" data-action="book" className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary-hover">
                          {bn.book}
                        </button>
                      )}
                      {r.basketable && <BasketToggle slug={r.slug} />}
                      {r.href && (
                        <Link href={r.href} className="flex min-h-12 items-center justify-center rounded-lg border-2 border-line px-4 font-semibold text-ink hover:border-primary">
                          {bn.labCompare}
                        </Link>
                      )}
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
