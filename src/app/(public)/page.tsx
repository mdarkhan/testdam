import type { Metadata } from "next";
import Link from "next/link";
import { bn } from "@/i18n/bn";
import { bnDigits, taka } from "@/lib/format";
import { db } from "@/lib/db";
import { CATEGORY_ORDER, categoryAnchor, getCatalogIndex, getTestsByIds, testDisplayName } from "@/lib/catalog";
import { SearchBox } from "@/components/public/search-box";
import { SiteHeader } from "@/components/public/site-header";
import { PriceSpread } from "@/components/public/price-spread";
import { pageMetadata } from "@/lib/seo";

// Rendered per request (cheap: it reads the in-memory catalogue index) so `next build` needs no
// database — the Docker build on FlyNode has none. Test/area/lab pages stay ISR.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({ title: `${bn.siteName} — ${bn.tagline}`, description: bn.homeIntro, path: "/" });

const POPULAR_COUNT = 8;
const QUICK_COUNT = 4;

export default async function Home() {
  const index = await getCatalogIndex();
  const [tests, areas] = await Promise.all([
    getTestsByIds([...index.tests.keys()]),
    db.area.findMany({ where: { id: { in: [...index.areas.keys()] } }, orderBy: { nameEn: "asc" } }),
  ]);
  const popular = [...tests.filter((t) => t.popularRank != null), ...tests.filter((t) => t.popularRank == null)].slice(0, POPULAR_COUNT);
  // Hero example: the popular test compared at the most labs (ties → the wider spread). Real numbers only.
  const hero = [...popular].sort((a, b) => {
    const ra = index.tests.get(a.id)!, rb = index.tests.get(b.id)!;
    return rb.labs - ra.labs || (rb.max - rb.min) - (ra.max - ra.min);
  })[0];
  const heroRange = hero && index.tests.get(hero.id)!;
  const categories = CATEGORY_ORDER.map((c) => ({ c, n: tests.filter((t) => t.category === c).length })).filter((x) => x.n > 0);

  return (
    <>
      <SiteHeader />
      <main id="main" className="w-full">
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 pb-10 pt-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-12 lg:pb-14 lg:pt-12">
            <div>
              <h1 className="text-[1.85rem] font-semibold leading-[1.3] text-ink sm:text-4xl sm:leading-[1.25]">{bn.homeHero}</h1>
              <p className="mt-3 max-w-xl text-lg text-muted">{bn.homeHeroIntro}</p>
              <div className="mt-6"><SearchBox size="lg" /></div>
              {popular.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted">{bn.quickSearch}</span>
                  {popular.slice(0, QUICK_COUNT).map((t) => (
                    <Link key={t.id} href={`/test/${t.slug}`} className="flex min-h-12 items-center rounded-full border border-line px-4 font-semibold hover:border-primary hover:text-primary">
                      {t.shortName ?? t.nameBn}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {hero && heroRange && (
              <figure className="rounded-2xl border border-primary/25 bg-primary-soft p-5 sm:p-6">
                <figcaption>
                  <p className="text-sm text-muted">{bn.spreadCaption(bnDigits(heroRange.labs))}</p>
                  <p className="mt-0.5 text-xl font-semibold leading-snug">{testDisplayName(hero)}</p>
                </figcaption>
                <div className="mt-5"><PriceSpread prices={index.spreads.get(hero.id)!} size="lg" /></div>
                {heroRange.max > heroRange.min && (
                  <p className="mt-4 font-semibold text-cheapest">{bn.spreadSave(taka(heroRange.max - heroRange.min))}</p>
                )}
                <Link href={`/test/${hero.slug}`} className="mt-4 flex min-h-12 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary-hover">
                  {bn.seeAllLabs}
                </Link>
              </figure>
            )}
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 pb-14">
          <ul className="grid grid-cols-3 divide-x divide-line border-b border-line py-5 text-center sm:text-left">
            {[
              [bn.factLabs(bnDigits(index.totals.labs)), bn.factLabsSub],
              [bn.factTests(bnDigits(index.tests.size)), bn.factTestsSub],
              [bn.factPrices(bnDigits(index.totals.prices)), bn.factPricesSub],
            ].map(([title, sub]) => (
              <li key={title} className="px-2 sm:px-6 first:sm:pl-0">
                <p className="text-lg font-semibold sm:text-xl">{title}</p>
                <p className="text-sm text-muted">{sub}</p>
              </li>
            ))}
          </ul>

          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-semibold">{bn.popularTests}</h2>
              <Link href="/tests" className="flex min-h-12 items-center font-semibold text-primary hover:underline">{bn.seeAllTests}</Link>
            </div>
            <ul className="mt-2 grid gap-x-10 md:grid-cols-2">
              {popular.map((t) => {
                const r = index.tests.get(t.id)!;
                return (
                  <li key={t.id} className="border-b border-line">
                    <Link href={`/test/${t.slug}`} className="group block py-4">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold group-hover:text-primary group-hover:underline">{testDisplayName(t)}</span>
                        <span className="shrink-0 text-sm text-muted">{bn.labsCount(bnDigits(r.labs))}</span>
                      </span>
                      <span className="mt-2 block"><PriceSpread prices={index.spreads.get(t.id)!} /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-10 flex flex-col gap-4 rounded-2xl bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-xl font-semibold">{bn.basketHomeCta}</h2>
              <p className="mt-1 text-muted">{bn.basketHomeCtaBody}</p>
            </div>
            <Link href="/basket" className="flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-white hover:bg-primary-hover">{bn.basketOpen}</Link>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-semibold">{bn.howTitle}</h2>
            <ol className="mt-4 grid gap-6 md:grid-cols-3">
              {bn.howSteps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-lg font-semibold text-white">{bnDigits(i + 1)}</span>
                  <div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-1 text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {categories.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-semibold">{bn.byCategory}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {categories.map(({ c, n }) => (
                  <li key={c}>
                    <Link href={`/tests#${categoryAnchor(c)}`} className="flex min-h-12 items-center gap-2 rounded-lg border border-line px-4 hover:border-primary">
                      <span className="font-semibold">{bn.categories[c]}</span>
                      <span className="text-sm text-muted">{bn.testsCount(bnDigits(n))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-12 flex flex-col gap-4 rounded-2xl border border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-xl font-semibold">{bn.corpHomeTitle}</h2>
              <p className="mt-1 text-muted">{bn.corpHomeBody}</p>
            </div>
            <Link href="/corporate" className="flex min-h-12 shrink-0 items-center justify-center rounded-lg border-2 border-primary px-5 font-semibold text-primary hover:bg-primary-soft">{bn.corpHomeCta}</Link>
          </section>

          {areas.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-semibold">{bn.areasHeading}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {areas.map((a) => (
                  <li key={a.id}>
                    <Link href={`/area/${a.slug}`} className="flex min-h-12 items-center gap-2 rounded-full border border-line px-4 hover:border-primary">
                      <span className="font-semibold">{a.nameBn}</span>
                      <span className="text-sm text-muted">{bn.labsCount(bnDigits(index.areas.get(a.id)!))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
