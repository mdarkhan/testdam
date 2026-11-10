import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import { bn } from "@/i18n/bn";
import { bnDate, bnDigits, priceRangeText, reportTime, taka } from "@/lib/format";
import { JsonLd, labLd, pageMetadata } from "@/lib/seo";
import { db } from "@/lib/db";
import { getCatalogIndex, testDisplayName } from "@/lib/catalog";
import { effectivePrice, isFresh, testAreaKey } from "@/lib/pricing";
import { Breadcrumbs } from "@/components/public/price-section";
import { PriceInteractions } from "@/components/public/price-interactions";

export const revalidate = 86400;
export const dynamicParams = true;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ slug: string }> };

const getLab = cache((slug: string) =>
  db.lab.findUnique({
    where: { slug },
    include: {
      area: true,
      prices: { include: { test: { select: { id: true, slug: true, nameEn: true, nameBn: true, shortName: true, popularRank: true } } } },
    },
  }),
);

async function load(slug: string) {
  const [lab, index] = await Promise.all([getLab(slug), getCatalogIndex()]);
  if (!lab || !lab.isActive || !index.labs.has(lab.id)) return null; // thin-content rule → 404
  return { lab, index };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return {};
  const { lab } = data;
  const name = `${lab.nameBn ?? lab.name}${lab.branchName ? ` (${lab.branchName})` : ""}`;
  const now = new Date();
  const prices = lab.prices.filter((p) => isFresh(p, now)).map((p) => effectivePrice(p, now));
  const range = priceRangeText(Math.min(...prices), Math.max(...prices));
  return pageMetadata({
    title: `${name}, ${lab.area.nameBn} — ${bnDigits(prices.length)}টি টেস্টের দাম | ${bn.siteName}`,
    description: `${name}-এ ${bnDigits(prices.length)}টি টেস্টের যাচাই করা দাম (${range}), ঠিকানা, ফোন ও হোম কালেকশনের তথ্য।`,
    path: `/lab/${lab.slug}`,
  });
}

export default async function LabPage({ params }: Props) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { lab, index } = data;
  const now = new Date();

  const rows = lab.prices
    .map((p) => ({ ...p, effective: effectivePrice(p, now), fresh: isFresh(p, now) }))
    .sort((a, b) => Number(b.fresh) - Number(a.fresh) || (a.test.popularRank ?? 9999) - (b.test.popularRank ?? 9999) || a.test.nameEn.localeCompare(b.test.nameEn));
  const lastUpdated = rows.reduce<Date | null>((m, r) => (!m || r.verifiedAt > m ? r.verifiedAt : m), null);
  const testHref = (testId: number, slug: string) =>
    index.testAreas.has(testAreaKey(testId, lab.areaId)) ? `/test/${slug}/${lab.area.slug}` : index.tests.has(testId) ? `/test/${slug}` : null;

  const others = await db.lab.findMany({
    where: { areaId: lab.areaId, isActive: true, id: { not: lab.id } },
    select: { id: true, slug: true, name: true, nameBn: true, branchName: true },
    orderBy: { name: "asc" },
  });
  const otherLabs = others.filter((o) => index.labs.has(o.id));
  const name = lab.nameBn ?? lab.name;

  return (
    <>
      <PriceInteractions />
      <JsonLd data={labLd({ ...lab, areaNameEn: lab.area.nameEn, path: `/lab/${lab.slug}` })} />
      <Breadcrumbs path={`/lab/${lab.slug}`} items={[{ name: bn.home, href: "/" }, { name: lab.area.nameBn, href: index.areas.has(lab.areaId) ? `/area/${lab.area.slug}` : undefined }, { name }]} />
      <h1 className="mt-2 text-2xl font-semibold leading-tight">{name}</h1>
      <p className="text-muted">{[lab.nameBn ? lab.name : null, lab.branchName].filter(Boolean).join(" · ")}</p>
      {lastUpdated && <p className="mt-1 text-sm text-muted">{bn.lastUpdated(bnDate(lastUpdated))}</p>}

      <dl className="mt-4 grid gap-3 rounded-xl border border-line p-4 text-sm sm:grid-cols-2">
        <div><dt className="font-semibold">{bn.address}</dt><dd>{lab.address}</dd></div>
        <div><dt className="font-semibold">{bn.phone}</dt><dd className="tabular">{lab.phone}</dd></div>
        {lab.openingHours && <div><dt className="font-semibold">{bn.openingHours}</dt><dd>{lab.openingHours}</dd></div>}
        <div>
          <dt className="font-semibold">{bn.homeCollection}</dt>
          <dd>{lab.homeCollection ? bn.homeCollectionYes : bn.homeCollectionNo}{lab.homeCollection && lab.homeCollectionFee != null && ` (${lab.homeCollectionFee === 0 ? bn.homeCollectionFree : bn.homeCollectionFee(taka(lab.homeCollectionFee))})`}</dd>
        </div>
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={`tel:${lab.phone.replace(/[^\d+]/g, "")}`} className={`${lab.mapUrl ? "" : "col-span-2 "}flex min-h-12 items-center justify-center rounded-lg bg-primary font-semibold text-white hover:bg-primary-hover`} data-action="call" data-lab={lab.slug} data-area={lab.area.slug}>{bn.call}</a>
        {lab.mapUrl && <a href={lab.mapUrl} target="_blank" rel="noopener" className="flex min-h-12 items-center justify-center rounded-lg border-2 border-primary font-semibold text-primary">{bn.directions}</a>}
      </div>
      <p className="mt-3 rounded-lg border-l-4 border-amber-500 bg-warn-soft px-3 py-2 text-sm">{bn.disclaimer}</p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">{bn.labTests}</h2>
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {rows.map((r) => {
            const href = testHref(r.testId, r.test.slug);
            const label = testDisplayName(r.test);
            return (
              <li key={r.id} className={`flex items-start justify-between gap-3 px-3 py-3 ${r.fresh ? "" : "text-stale"}`}>
                <div className="min-w-0">
                  <p className="font-semibold">{href ? <Link href={href} className="underline decoration-slate-300 underline-offset-4 hover:decoration-primary">{label}</Link> : label}</p>
                  <p className="text-xs">
                    {[reportTime(r.reportHours) && `${bn.report}: ${reportTime(r.reportHours)}`, bn.verified(bnDate(r.verifiedAt)), bn.sources[r.source]].filter(Boolean).join(" · ")}
                  </p>
                  {!r.fresh && <p className="text-xs font-semibold">{bn.stale}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-lg font-semibold">{taka(r.effective)}</p>
                  {r.effective < r.regularPrice && <p className="tabular text-xs text-muted"><s>{taka(r.regularPrice)}</s></p>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {otherLabs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{bn.labsInArea(lab.area.nameBn)}</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {otherLabs.map((o) => (
              <li key={o.id}>
                <Link href={`/lab/${o.slug}`} className="flex min-h-12 items-center rounded-lg border border-line px-3 py-2 font-semibold hover:border-primary">
                  {o.nameBn ?? o.name}{o.branchName && <span className="ml-1 font-normal text-muted">· {o.branchName}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
