import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { bn } from "@/i18n/bn";
import { bnDigits, taka } from "@/lib/format";
import { getAreaBySlug, getCatalogIndex, getTestBySlug, getTestPrices, testDisplayName } from "@/lib/catalog";
import { testAreaKey } from "@/lib/pricing";
import { Breadcrumbs, PriceLinks, PriceSection } from "@/components/public/price-section";
import { TestFacts } from "@/components/public/test-facts";

export const revalidate = 86400;
export const dynamicParams = true;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ slug: string; area: string }> };

async function load(slug: string, areaSlug: string) {
  const [test, area, index] = await Promise.all([getTestBySlug(slug), getAreaBySlug(areaSlug), getCatalogIndex()]);
  if (!test || !area) return null;
  const range = index.testAreas.get(testAreaKey(test.id, area.id));
  if (!range) return null; // thin-content rule: needs ≥2 labs in this area with a fresh price
  return { test, area, index, range };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const data = await load(p.slug, p.area);
  if (!data) return {};
  const name = testDisplayName(data.test);
  return {
    title: `${bn.testPriceInArea(name, data.area.nameBn)} — ${taka(data.range.min)} থেকে | ${bn.siteName}`,
    description: `${data.area.nameBn} এলাকার ${bnDigits(data.range.labs)}টি ল্যাবে ${name} টেস্টের দাম ${taka(data.range.min)} – ${taka(data.range.max)}। যাচাইয়ের তারিখ ও হোম কালেকশন সহ তুলনা করুন।`,
  };
}

export default async function TestAreaPage({ params }: Props) {
  const p = await params;
  const data = await load(p.slug, p.area);
  if (!data) notFound();
  const { test, area, index } = data;
  const name = testDisplayName(test);
  const rows = await getTestPrices(test.id, area.id);
  const testPublished = index.tests.has(test.id);

  const nearby = area.neighbors
    .map((n) => ({ n, r: index.testAreas.get(testAreaKey(test.id, n.id)) }))
    .filter((x) => x.r)
    .map(({ n, r }) => ({ href: `/test/${test.slug}/${n.slug}`, label: n.nameBn, min: r!.min }));

  return (
    <>
      <Breadcrumbs
        items={[
          { name: bn.home, href: "/" },
          { name: test.shortName ?? test.nameEn, href: testPublished ? `/test/${test.slug}` : undefined },
          { name: area.nameBn },
        ]}
      />
      <h1 className="mt-2 text-2xl font-semibold leading-tight">{bn.testPriceInArea(name, area.nameBn)}</h1>
      <p className="text-muted" lang="en">{test.nameEn} · {area.nameEn}</p>
      <TestFacts test={test} />
      <div className="mt-4"><PriceSection rows={rows} testName={name} index={index} areaFilter={false} /></div>
      <PriceLinks title={bn.nearbyAreas} links={nearby} />
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {testPublished && (
          <Link href={`/test/${test.slug}`} className="inline-flex min-h-12 items-center font-semibold text-primary underline">{bn.allDhaka(test.shortName ?? test.nameEn)}</Link>
        )}
        {index.areas.has(area.id) && (
          <Link href={`/area/${area.slug}`} className="inline-flex min-h-12 items-center font-semibold text-primary underline">{bn.areaTitle(area.nameBn)}</Link>
        )}
      </div>
    </>
  );
}
