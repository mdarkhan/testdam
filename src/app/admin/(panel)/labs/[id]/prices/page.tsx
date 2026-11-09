import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { requireUser } from "@/lib/auth";
import { dhakaDateString } from "@/lib/dates";
import { isFresh } from "@/lib/pricing";
import { btn } from "@/components/admin/styles";
import { PriceGrid, type GridRow } from "./price-grid";

export const metadata = { title: "Prices" };

export default async function LabPrices({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const lab = await db.lab.findUnique({ where: { id }, include: { area: { select: { nameEn: true } } } });
  if (!lab) notFound();
  const [tests, prices] = await Promise.all([
    db.test.findMany({ orderBy: [{ popularRank: { sort: "asc", nulls: "last" } }, { nameEn: "asc" }], select: { id: true, slug: true, nameEn: true, nameBn: true, shortName: true } }),
    db.labTestPrice.findMany({ where: { labId: id }, include: { verifiedBy: { select: { email: true } } } }),
  ]);
  const byTest = new Map(prices.map((p) => [p.testId, p]));
  const now = new Date();
  const rows: GridRow[] = tests.map((t) => {
    const p = byTest.get(t.id);
    return {
      testId: t.id,
      label: t.shortName && t.shortName !== t.nameEn ? `${t.nameEn} (${t.shortName})` : t.nameEn,
      labelBn: t.nameBn,
      slug: t.slug,
      saved: p
        ? {
            regularPrice: String(p.regularPrice),
            discountPrice: p.discountPrice?.toString() ?? "",
            discountExpires: p.discountExpiresAt ? dhakaDateString(p.discountExpiresAt) : "",
            reportHours: p.reportHours?.toString() ?? "",
            homeCollection: p.homeCollection,
            source: p.source,
            sourceNote: p.sourceNote ?? "",
          }
        : null,
      verifiedOn: p ? dhakaDateString(p.verifiedAt) : null,
      verifiedBy: p?.verifiedBy?.email ?? null,
      stale: p ? !isFresh(p, now) : false,
    };
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/admin/labs" className="text-sm text-primary underline">← Labs</Link>
          <h1 className="mt-1 text-xl font-semibold">
            Prices · {lab.name}{lab.branchName ? ` · ${lab.branchName}` : ""} <span className="text-base font-normal text-muted">({lab.area.nameEn})</span>
          </h1>
          <p className="text-sm text-muted">
            {prices.length} prices · stale after {config.freshDays} days · <span className="tabular">{lab.phone}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/labs/${lab.id}`} className={btn("plain")}>Lab details</Link>
          <a href={`/admin/export?lab=${lab.slug}`} className={btn("plain")}>Export CSV</a>
          <Link href={`/admin/import?lab=${lab.slug}`} className={btn("plain")}>Import CSV</Link>
        </div>
      </div>
      <PriceGrid labId={lab.id} rows={rows} defaultHomeCollection={lab.homeCollection} />
    </>
  );
}
