import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bn } from "@/i18n/bn";
import { bnDigits, priceRangeText } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { getAreas, getCatalogIndex, getTestBySlug, getTestPrices, getTestsByIds, testDisplayName } from "@/lib/catalog";
import { testAreaKey } from "@/lib/pricing";
import { Breadcrumbs, PriceLinks, PriceSection } from "@/components/public/price-section";
import { BasketButton } from "@/components/public/basket-button";
import { TestFacts } from "@/components/public/test-facts";

// ISR: rendered on first request (the Docker build has no database), cached, re-rendered daily
// (prices go stale on their own) and immediately when an admin saves a price.
export const revalidate = 86400;
export const dynamicParams = true;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const [test, index] = await Promise.all([getTestBySlug(slug), getCatalogIndex()]);
  if (!test || !index.tests.has(test.id)) return null; // thin-content rule → 404
  return { test, index, range: index.tests.get(test.id)! };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return {};
  const name = testDisplayName(data.test);
  const range = priceRangeText(data.range.min, data.range.max);
  return pageMetadata({
    title: `${bn.testPriceTitle(name)} ঢাকায় ${range} | ${bn.siteName}`,
    description: `ঢাকার ${bnDigits(data.range.labs)}টি ল্যাবে ${name} টেস্টের দাম ${range}। যাচাইয়ের তারিখ, রিপোর্টের সময় ও হোম কালেকশন মিলিয়ে সবচেয়ে কম দামের ল্যাব খুঁজুন।`,
    path: `/test/${data.test.slug}`,
    ownImage: true,
  });
}

export default async function TestPage({ params }: Props) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { test, index } = data;
  const name = testDisplayName(test);
  const [rows, areas, others] = await Promise.all([
    getTestPrices(test.id),
    getAreas(),
    getTestsByIds([...index.tests.keys()].filter((id) => id !== test.id)),
  ]);

  const areaLinks = areas
    .map((a) => ({ a, r: index.testAreas.get(testAreaKey(test.id, a.id)) }))
    .filter((x) => x.r)
    .map(({ a, r }) => ({ href: `/test/${test.slug}/${a.slug}`, label: a.nameBn, min: r!.min }));

  return (
    <>
      <Breadcrumbs path={`/test/${test.slug}`} items={[{ name: bn.home, href: "/" }, { name: test.shortName ?? test.nameEn }]} />
      <h1 className="mt-2 text-2xl font-semibold leading-tight">{bn.testPriceTitle(name)}</h1>
      <p className="text-muted" lang="en">{test.nameEn}</p>
      <TestFacts test={test} />
      <BasketButton slug={test.slug} />
      <div className="mt-4"><PriceSection rows={rows} testName={name} index={index} areaFilter path={`/test/${test.slug}`} testSlug={test.slug} /></div>
      <PriceLinks title={bn.byArea} links={areaLinks} />
      <PriceLinks
        title={bn.otherTests}
        links={others.slice(0, 8).map((t) => ({ href: `/test/${t.slug}`, label: testDisplayName(t), min: index.tests.get(t.id)!.min }))}
      />
    </>
  );
}
