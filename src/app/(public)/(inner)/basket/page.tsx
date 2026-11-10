import type { Metadata } from "next";
import Link from "next/link";
import { bn } from "@/i18n/bn";
import { bnDate, bnDigits, taka } from "@/lib/format";
import { db } from "@/lib/db";
import { getCatalogIndex, getTestsByIds, testDisplayName } from "@/lib/catalog";
import { searchKey } from "@/lib/normalize";
import { BASKET_MAX, basketTotals, type BasketLab } from "@/lib/pricing";
import { Breadcrumbs } from "@/components/public/price-section";
import { BasketPicker } from "@/components/public/basket-picker";
import { BasketInteractions } from "@/components/public/basket-interactions";

// The list comes from ?t=…, so every visit is rendered fresh. Not for search engines: the
// content is the visitor's own selection (the test pages are the indexable ones).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `${bn.basketTitle} | ${bn.siteName}`, description: bn.basketIntro, robots: { index: false, follow: true } };

const PARTIAL_SHOWN = 10;

type Props = { searchParams: Promise<{ t?: string | string[] }> };

export default async function BasketPage({ searchParams }: Props) {
  const raw = (await searchParams).t;
  const asked = [...new Set((Array.isArray(raw) ? raw.join(",") : raw ?? "").split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9-]{1,80}$/.test(s)))].slice(0, BASKET_MAX);

  const index = await getCatalogIndex();
  const tests = await getTestsByIds([...index.tests.keys()]); // only tests with a public page can be added
  const bySlug = new Map(tests.map((t) => [t.slug, t]));
  const selected = asked.map((s) => bySlug.get(s)).filter((t) => t !== undefined);
  const ids = selected.map((t) => t.id);

  const rows = ids.length
    ? await db.labTestPrice.findMany({
        where: { testId: { in: ids }, lab: { isActive: true } },
        select: { labId: true, testId: true, regularPrice: true, discountPrice: true, discountExpiresAt: true, verifiedAt: true, homeCollection: true },
      })
    : [];
  const { complete, partial } = basketTotals(rows, ids);
  const shownPartial = partial.slice(0, PARTIAL_SHOWN);
  const labs = new Map(
    (await db.lab.findMany({
      where: { id: { in: [...complete, ...shownPartial].map((l) => l.labId) } },
      select: { id: true, slug: true, name: true, nameBn: true, branchName: true, phone: true, area: { select: { slug: true, nameBn: true } } },
    })).map((l) => [l.id, l]),
  );
  const testName = new Map(selected.map((t) => [t.id, t.shortName ?? t.nameBn]));
  // Home collection is offered for a basket booking only if the lab collects every one of the tests.
  const homeFor = (l: BasketLab) => l.items.every((i) => rows.some((r) => r.labId === l.labId && r.testId === i.testId && r.homeCollection));
  const maxTotal = complete.length > 1 ? complete[complete.length - 1]!.total : null;

  const pickerTests = tests.map((t) => ({
    slug: t.slug,
    label: testDisplayName(t),
    keys: [t.nameBn, t.nameEn, t.shortName ?? "", t.slug.replace(/-/g, " ")].map(searchKey).filter(Boolean),
  }));

  function LabCard({ l, rank }: { l: BasketLab; rank?: number }) {
    const lab = labs.get(l.labId);
    if (!lab) return null;
    const cheapest = rank === 0;
    const saves = maxTotal != null && rank != null ? maxTotal - l.total : 0;
    return (
      <article data-price-row data-lab={lab.slug} data-area={lab.area.slug} data-lab-name={lab.nameBn ?? lab.name} data-price={l.total} data-home={homeFor(l) ? "1" : "0"} className={`rounded-xl border p-4 ${cheapest ? "border-2 border-cheapest" : "border-line"}`}>
        {cheapest && <p className="mb-2 inline-block rounded-full bg-cheapest px-3 py-0.5 text-sm font-semibold text-white">{bn.basketCheapest}</p>}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold leading-snug">
              {index.labs.has(lab.id) ? <Link href={`/lab/${lab.slug}`} className="hover:text-primary hover:underline">{lab.nameBn ?? lab.name}</Link> : lab.nameBn ?? lab.name}
            </h3>
            <p className="text-sm text-muted">{lab.branchName ? `${lab.branchName}, ` : ""}{lab.area.nameBn}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm text-muted">{l.missing.length ? bn.basketPartialTotal(bnDigits(l.items.length)) : bn.basketTotal}</p>
            <p className={`tabular text-2xl font-semibold ${cheapest ? "text-cheapest" : ""}`}>{taka(l.total)}</p>
          </div>
        </div>
        {l.missing.length > 0 && (
          <p className="mt-2 text-sm">
            <span className="font-semibold">{bn.basketPartialHave(bnDigits(l.items.length), bnDigits(ids.length))}</span>
            <span className="text-danger">. {bn.basketMissing(l.missing.map((id) => testName.get(id)).join(", "))}</span>
          </p>
        )}
        {saves > 0 && <p className="mt-2 text-sm font-semibold text-cheapest">{bn.basketSaves(taka(saves))}</p>}
        <details className="mt-2 group">
          <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-primary">{bn.basketBreakdown}</summary>
          <ul className="divide-y divide-line rounded-lg bg-slate-50 px-3">
            {l.items.map((i) => (
              <li key={i.testId} className="flex justify-between gap-3 py-2 text-sm">
                <span>{testName.get(i.testId)}</span>
                <span className="tabular font-semibold">{taka(i.price)}</span>
              </li>
            ))}
          </ul>
        </details>
        <p className="mt-1 text-sm text-muted">{bn.basketVerified(bnDate(l.oldest))}</p>
        {(l.missing.length === 0 || lab.phone) && (
          <div className={`mt-3 grid gap-2 ${l.missing.length === 0 && lab.phone ? "grid-cols-2" : ""}`}>
            {l.missing.length === 0 && (
              <button type="button" data-action="book-basket" className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-primary font-semibold text-white hover:bg-primary-hover">
                {bn.book}
              </button>
            )}
            {lab.phone && (
              <a href={`tel:${lab.phone.replace(/[^\d+]/g, "")}`} data-action="call" className="flex min-h-12 items-center justify-center rounded-lg border-2 border-primary font-semibold text-primary hover:bg-primary-soft">
                {bn.call}
              </a>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <>
      <BasketInteractions testSlugs={selected.map((t) => t.slug)} testNames={selected.map((t) => t.shortName ?? t.nameBn)} />
      <Breadcrumbs path="/basket" items={[{ name: bn.home, href: "/" }, { name: bn.basketTitle }]} />
      <h1 className="mt-2 text-2xl font-semibold leading-tight">{bn.basketTitle}</h1>
      <p className="mt-1 text-muted">{bn.basketIntro}</p>

      <BasketPicker
        tests={pickerTests}
        selected={selected.map((t) => t.slug)}
        popular={tests.filter((t) => t.popularRank != null).map((t) => t.slug)}
        fromUrl={raw !== undefined}
      />

      {selected.length === 0 ? (
        <p className="mt-6 rounded-xl bg-primary-soft px-4 py-3">{bn.basketEmpty}</p>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-semibold">{bn.basketCompleteTitle(bnDigits(complete.length))}</h2>
            {complete.length === 0 ? (
              <p className="mt-2 text-muted">{bn.basketCompleteNone}</p>
            ) : (
              <ol className="mt-3 grid gap-3">
                {complete.map((l, i) => <li key={l.labId}><LabCard l={l} rank={i} /></li>)}
              </ol>
            )}
          </section>
          {shownPartial.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">{bn.basketPartialTitle}</h2>
              <ul className="mt-3 grid gap-3">
                {shownPartial.map((l) => <li key={l.labId}><LabCard l={l} /></li>)}
              </ul>
            </section>
          )}
          <p className="mt-6 rounded-lg border-l-4 border-amber-500 bg-warn-soft px-3 py-2 text-sm">{bn.disclaimer}</p>
        </>
      )}
    </>
  );
}
