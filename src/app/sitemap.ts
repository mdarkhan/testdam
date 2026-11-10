import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getCatalogIndex } from "@/lib/catalog";
import { buildSitemap } from "@/lib/seo";

// Rendered per request from the cached catalogue index (crawlers fetch it rarely), so `next build`
// needs no database and the sitemap is never out of date.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const index = await getCatalogIndex();
  const [tests, areas, labs] = await Promise.all([
    db.test.findMany({ select: { id: true, slug: true } }),
    db.area.findMany({ select: { id: true, slug: true } }),
    db.lab.findMany({ where: { isActive: true }, select: { id: true, slug: true } }),
  ]);
  const toMap = (rows: Array<{ id: number; slug: string }>) => new Map(rows.map((r) => [r.id, r.slug]));
  return buildSitemap(index, { tests: toMap(tests), areas: toMap(areas), labs: toMap(labs) });
}
