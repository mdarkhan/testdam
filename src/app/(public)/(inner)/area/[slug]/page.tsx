import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { bn } from "@/i18n/bn";
import { bnDigits } from "@/lib/format";
import { db } from "@/lib/db";
import { getAreaBySlug, getCatalogIndex, getTestsByIds, testDisplayName } from "@/lib/catalog";
import { testAreaKey } from "@/lib/pricing";
import { Breadcrumbs, PriceLinks } from "@/components/public/price-section";

export const revalidate = 86400;
export const dynamicParams = true;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const [area, index] = await Promise.all([getAreaBySlug(slug), getCatalogIndex()]);
  if (!area || !index.areas.has(area.id)) return null; // thin-content rule → 404
  return { area, index };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return {};
  return {
    title: `${bn.areaTitle(data.area.nameBn)} | ${bn.siteName}`,
    description: `${data.area.nameBn} (${data.area.nameEn}) এলাকার ${bnDigits(data.index.areas.get(data.area.id)!)}টি ল্যাবে টেস্টের যাচাই করা দাম তুলনা করুন।`,
  };
}

export default async function AreaPage({ params }: Props) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { area, index } = data;

  const testIds = [...index.testAreas.keys()].filter((k) => k.endsWith(`:${area.id}`)).map((k) => Number(k.split(":")[0]));
  const [tests, labs] = await Promise.all([
    getTestsByIds(testIds),
    db.lab.findMany({ where: { areaId: area.id, isActive: true }, select: { id: true, slug: true, name: true, nameBn: true, branchName: true }, orderBy: { name: "asc" } }),
  ]);
  const nearby = area.neighbors.filter((n) => index.areas.has(n.id));

  return (
    <>
      <Breadcrumbs items={[{ name: bn.home, href: "/" }, { name: area.nameBn }]} />
      <h1 className="mt-2 text-2xl font-semibold leading-tight">{bn.areaTitle(area.nameBn)}</h1>
      <p className="text-muted" lang="en">{area.nameEn}</p>
      <p className="mt-3 rounded-lg border-l-4 border-amber-500 bg-warn-soft px-3 py-2 text-sm">{bn.disclaimer}</p>

      <PriceLinks
        title={bn.areaTests}
        links={tests.map((t) => ({ href: `/test/${t.slug}/${area.slug}`, label: testDisplayName(t), min: index.testAreas.get(testAreaKey(t.id, area.id))!.min }))}
      />

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{bn.areaLabs}</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {labs.map((l) => {
            const count = index.labs.get(l.id);
            const inner = (
              <>
                <span className="font-semibold">{l.nameBn ?? l.name}{l.branchName && <span className="ml-1 font-normal text-muted">· {l.branchName}</span>}</span>
                {count && <span className="shrink-0 text-sm text-muted">{bn.freshPrices(bnDigits(count))}</span>}
              </>
            );
            return (
              <li key={l.id}>
                {count ? (
                  <Link href={`/lab/${l.slug}`} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 hover:border-primary">{inner}</Link>
                ) : (
                  <div className="flex min-h-12 items-center rounded-lg border border-line px-3 py-2">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {nearby.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{bn.nearbyAreaLinks}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {nearby.map((n) => (
              <li key={n.id}>
                <Link href={`/area/${n.slug}`} className="flex min-h-12 items-center rounded-full border border-line px-4 font-semibold hover:border-primary">{n.nameBn}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
