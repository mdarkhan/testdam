import type { Metadata } from "next";
import Link from "next/link";
import { bn } from "@/i18n/bn";
import { bnDigits, priceRangeText } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { CATEGORY_ORDER, categoryAnchor, getCatalogIndex, getTestsByIds, testDisplayName } from "@/lib/catalog";
import { Breadcrumbs } from "@/components/public/price-section";

// Per request from the cached catalogue index, like the home page (the build has no database).
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({ title: `${bn.allTestsTitle} | ${bn.siteName}`, description: bn.allTestsIntro, path: "/tests" });

export default async function TestsPage() {
  const index = await getCatalogIndex();
  const tests = await getTestsByIds([...index.tests.keys()]); // thin-content rule: only tests with a page
  const groups = CATEGORY_ORDER.map((c) => ({
    c,
    tests: tests.filter((t) => t.category === c).sort((a, b) => (a.shortName ?? a.nameEn).localeCompare(b.shortName ?? b.nameEn)),
  })).filter((g) => g.tests.length > 0);

  return (
    <>
      <Breadcrumbs path="/tests" items={[{ name: bn.home, href: "/" }, { name: bn.allTestsTitle }]} />
      <h1 className="mt-2 text-2xl font-semibold leading-tight">{bn.allTestsTitle}</h1>
      <p className="mt-1 text-muted">{bn.allTestsIntro}</p>

      {groups.length > 1 && (
        <nav aria-label={bn.byCategory} className="mt-4">
          <ul className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <li key={g.c}>
                <a href={`#${categoryAnchor(g.c)}`} className="flex min-h-12 items-center rounded-full border border-line px-4 text-sm font-semibold hover:border-primary">
                  {bn.categories[g.c]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {groups.map((g) => (
        <section key={g.c} id={categoryAnchor(g.c)} className="mt-8 scroll-mt-4">
          <h2 className="text-lg font-semibold">{bn.categories[g.c]} <span className="text-base font-normal text-muted">({bnDigits(g.tests.length)})</span></h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {g.tests.map((t) => {
              const r = index.tests.get(t.id)!;
              return (
                <li key={t.id}>
                  <Link href={`/test/${t.slug}`} className="flex min-h-12 h-full flex-col justify-center rounded-lg border border-line px-3 py-2 hover:border-primary">
                    <span className="font-semibold">{testDisplayName(t)}</span>
                    <span className="tabular text-sm text-muted">
                      <span className="font-semibold text-cheapest">{priceRangeText(r.min, r.max)}</span>, {bn.labsCount(bnDigits(r.labs))}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
