import Link from "next/link";
import { bn } from "@/i18n/bn";
import { bnDigits, priceRangeText, taka } from "@/lib/format";
import { breadcrumbLd, JsonLd, priceListLd } from "@/lib/seo";
import { priceRange, rankPrices, type CatalogIndex } from "@/lib/pricing";
import type { TestPriceRow } from "@/lib/catalog";
import { PriceCard } from "./price-card";
import { PriceFilters } from "./price-filters";
import { PriceInteractions } from "./price-interactions";
import { PriceSpread } from "./price-spread";

/** Ranks prices (fresh by price, stale apart) and renders summary, filters, cards and the stale group. */
export function PriceSection({ rows, testName, index, areaFilter, path, testSlug, pageAreaSlug }: {
  rows: TestPriceRow[]; testName: string; index: CatalogIndex; areaFilter: boolean; path: string; testSlug: string; pageAreaSlug?: string;
}) {
  const { fresh, stale } = rankPrices(rows.map((r) => ({ ...r, labName: r.lab.name })));
  const range = priceRange(fresh);
  const labHref = (r: TestPriceRow) => (index.labs.has(r.lab.id) ? `/lab/${r.lab.slug}` : null);
  const areas = areaFilter
    ? [...new Map(fresh.map((r) => [r.lab.area.slug, r.lab.area.nameBn])).entries()].map(([slug, nameBn]) => ({ slug, nameBn })).sort((a, b) => a.nameBn.localeCompare(b.nameBn, "bn"))
    : undefined;

  return (
    <>
      <JsonLd data={priceListLd(bn.testPriceTitle(testName), path, fresh.map((r) => ({ name: r.lab.nameBn ?? r.lab.name, price: taka(r.effective), path: labHref(r) })))} />
      <PriceInteractions testSlug={testSlug} testName={testName} pageAreaSlug={pageAreaSlug} view={range ? { labCount: range.labs, minPrice: range.min } : undefined} />
      {range && (
        <div className="rounded-xl bg-primary-soft px-4 py-3">
          <p className="text-sm font-semibold text-primary">{bn.priceRange}</p>
          <p className="tabular text-3xl font-semibold">{priceRangeText(range.min, range.max)}</p>
          <p className="text-sm text-muted">{bn.labsWithFreshPrice(bnDigits(range.labs))}</p>
          {range.max > range.min && (
            <div className="mt-3">
              <PriceSpread prices={fresh.map((r) => r.effective).sort((a, b) => a - b)} labels={false} />
              <p className="mt-2 text-sm font-semibold text-cheapest">{bn.spreadSave(taka(range.max - range.min))}</p>
            </div>
          )}
        </div>
      )}

      <h2 className="mt-4 text-lg font-semibold">{bn.labPricesHeading}</h2>
      <div className="mt-2"><PriceFilters areas={areas} total={fresh.length} /></div>
      <div id="price-list" className="mt-3 space-y-3">
        {fresh.map((r) => <PriceCard key={r.id} row={r} testName={testName} labHref={labHref(r)} showArea={areaFilter} />)}
      </div>

      <p className="mt-4 rounded-lg border-l-4 border-amber-500 bg-warn-soft px-3 py-2 text-sm">{bn.disclaimer}</p>

      {stale.length > 0 && (
        <details className="mt-6 rounded-xl border border-line">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-stale">{bn.staleGroup(bnDigits(stale.length))}</summary>
          <div className="space-y-3 p-3">
            {stale.map((r) => <PriceCard key={r.id} row={r} testName={testName} labHref={labHref(r)} showArea={areaFilter} />)}
          </div>
        </details>
      )}
    </>
  );
}

export function Breadcrumbs({ items, path }: { items: Array<{ name: string; href?: string }>; path: string }) {
  return (
    <>
    <JsonLd data={breadcrumbLd(items.map((it) => ({ name: it.name, path: it.href })), path)} />
    <nav aria-label="breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>›</span>}
            {it.href ? <Link href={it.href} className="underline underline-offset-2 hover:text-primary">{it.name}</Link> : <span aria-current="page">{it.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
    </>
  );
}

/** A list of links with a price ("৳৩০০ থেকে") — used for area, nearby-area and other-test links. */
export function PriceLinks({ title, links }: { title: string; links: Array<{ href: string; label: string; min: number }> }) {
  if (!links.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 hover:border-primary">
              <span className="font-semibold">{l.label}</span>
              <span className="tabular shrink-0 text-sm text-muted">{bn.searchFrom(taka(l.min))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
