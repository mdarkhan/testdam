import "server-only";
// Read side for public pages: which pages exist (thin-content rule) and the data to render them.
import { cache } from "react";
import { db } from "./db";
import { buildIndex, type CatalogIndex } from "./pricing";
import { searchKey } from "./normalize";

// The index is cheap to rebuild but needed by every page render, search request and the sitemap.
// One container → a short in-process cache; admin writes call invalidateCatalog().
const TTL_MS = 60_000;
let cached: { at: number; value: Promise<CatalogIndex> } | null = null;

export function invalidateCatalog() {
  cached = null;
}

export function getCatalogIndex(): Promise<CatalogIndex> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = db.labTestPrice
    .findMany({
      where: { lab: { isActive: true } },
      select: { labId: true, testId: true, regularPrice: true, discountPrice: true, discountExpiresAt: true, verifiedAt: true, lab: { select: { areaId: true } } },
    })
    .then((rows) => buildIndex(rows.map(({ lab, ...r }) => ({ ...r, areaId: lab.areaId }))));
  cached = { at: Date.now(), value };
  value.catch(() => { if (cached?.value === value) cached = null; });
  return value;
}

export const getAreas = cache(async () => {
  const areas = await db.area.findMany({ orderBy: { nameEn: "asc" } });
  return areas.map((a) => ({ ...a, keys: [a.slug.replace(/-/g, " "), a.nameEn, a.nameBn, ...a.aliases].map(searchKey) }));
});

export const getTestBySlug = cache((slug: string) => db.test.findUnique({ where: { slug } }));
export const getAreaBySlug = cache((slug: string) => db.area.findUnique({ where: { slug }, include: { neighbors: { orderBy: { nameEn: "asc" } } } }));

const labSelect = {
  id: true, slug: true, name: true, nameBn: true, branchName: true, phone: true, whatsapp: true, homeCollectionFee: true, isFeatured: true, isPartner: true, partnerDiscountPct: true,
  area: { select: { id: true, slug: true, nameBn: true, nameEn: true } },
} as const;

/** All prices for a test at active labs (optionally one area), with lab details for the cards. */
export function getTestPrices(testId: number, areaId?: number) {
  return db.labTestPrice.findMany({
    where: { testId, lab: { isActive: true, ...(areaId && { areaId }) } },
    include: { lab: { select: labSelect } },
  });
}

export type TestPriceRow = Awaited<ReturnType<typeof getTestPrices>>[number];

/** Tests by id with what the link lists need, in popularity order. */
export function getTestsByIds(ids: number[]) {
  return db.test.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, nameEn: true, nameBn: true, shortName: true, popularRank: true, category: true },
    orderBy: [{ popularRank: { sort: "asc", nulls: "last" } }, { nameEn: "asc" }],
  });
}

/** Display order of test categories (most searched first) on the home and /tests pages. */
export const CATEGORY_ORDER = ["BLOOD", "BIOCHEMISTRY", "HORMONE", "SEROLOGY", "URINE", "STOOL", "MICROBIOLOGY", "IMAGING", "CARDIAC", "OTHER"] as const;
export const categoryAnchor = (c: string) => `cat-${c.toLowerCase()}`;

/** "কমপ্লিট ব্লাড কাউন্ট (CBC)" — Bangla name first, English short name as people search for it. */
export function testDisplayName(t: { nameBn: string; nameEn: string; shortName: string | null }) {
  return `${t.nameBn} (${t.shortName ?? t.nameEn})`;
}
