import type { Metadata } from "next";
import Link from "next/link";
import { bn } from "@/i18n/bn";
import { bnDigits, taka } from "@/lib/format";
import { db } from "@/lib/db";
import { getCatalogIndex, getTestsByIds, testDisplayName } from "@/lib/catalog";
import { SearchBox } from "@/components/public/search-box";

export const revalidate = 86400; // plus on-demand revalidation on every admin price change

export const metadata: Metadata = {
  title: `${bn.siteName} — ${bn.tagline}`,
  description: bn.homeIntro,
};

export default async function Home() {
  const index = await getCatalogIndex();
  const [tests, areas] = await Promise.all([
    getTestsByIds([...index.tests.keys()]),
    db.area.findMany({ where: { id: { in: [...index.areas.keys()] } }, orderBy: { nameEn: "asc" } }),
  ]);
  const popular = [...tests.filter((t) => t.popularRank != null), ...tests.filter((t) => t.popularRank == null)].slice(0, 12);

  return (
    <>
      <header className="bg-primary-soft">
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-5">
          <p className="text-xl font-semibold text-primary">{bn.siteName}</p>
          <h1 className="mt-6 text-2xl font-semibold leading-tight sm:text-3xl">{bn.homeHeading}</h1>
          <p className="mt-2 text-muted">{bn.homeIntro}</p>
          <div className="mt-4"><SearchBox size="lg" /></div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-6">
        <section>
          <h2 className="text-lg font-semibold">{bn.popularTests}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {popular.map((t) => (
              <li key={t.id}>
                <Link href={`/test/${t.slug}`} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 hover:border-primary">
                  <span className="font-semibold">{testDisplayName(t)}</span>
                  <span className="tabular shrink-0 text-sm text-muted">{bn.searchFrom(taka(index.tests.get(t.id)!.min))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{bn.areasHeading}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {areas.map((a) => (
              <li key={a.id}>
                <Link href={`/area/${a.slug}`} className="flex min-h-12 items-center gap-2 rounded-full border border-line bg-white px-4 hover:border-primary">
                  <span className="font-semibold">{a.nameBn}</span>
                  <span className="text-sm text-muted">{bn.labsCount(bnDigits(index.areas.get(a.id)!))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
