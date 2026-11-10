import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getCatalogIndex } from "@/lib/catalog";
import { buildSitemap } from "@/lib/seo";

// Regenerated hourly and on every admin price change (revalidatePath("/sitemap.xml")).
export const revalidate = 3600;

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
