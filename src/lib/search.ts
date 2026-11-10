import "server-only";
import { db } from "./db";
import { extractArea, searchKey } from "./normalize";
import { testAreaKey } from "./pricing";
import { getAreas, getCatalogIndex, getTestsByIds } from "./catalog";

export type SearchResult = { slug: string; href: string; nameBn: string; nameEn: string; shortName: string | null; minPrice: number; exact: boolean; score: number };
export type SearchResponse = { results: SearchResult[]; area: { slug: string; nameBn: string; href: string | null } | null };

/**
 * Fuzzy test search over TestAlias.searchKey (romanised, pg_trgm), limited to tests that have a
 * published page. "cbc mirpur" → the CBC × Mirpur page when that page exists, else the CBC page.
 */
export async function searchTests(q: string, limit = 8): Promise<SearchResponse> {
  const key = searchKey(q.slice(0, 100));
  if (!key) return { results: [], area: null };
  const [areas, index] = await Promise.all([getAreas(), getCatalogIndex()]);
  const { area, rest } = extractArea(key, areas);
  const areaOut = area ? { slug: area.slug, nameBn: area.nameBn, href: index.areas.has(area.id) ? `/area/${area.slug}` : null } : null;
  if (!rest) return { results: [], area: areaOut };

  const rows = await db.$queryRaw<Array<{ id: number; score: number; exact: boolean }>>`
    SELECT a."testId" AS id,
           max(greatest(similarity(a."searchKey", ${rest}), word_similarity(${rest}, a."searchKey")))::float8 AS score,
           bool_or(a."searchKey" = ${rest}) AS exact
    FROM "TestAlias" a
    WHERE a."searchKey" % ${rest} OR a."searchKey" LIKE ${rest + "%"} OR word_similarity(${rest}, a."searchKey") > 0.5
    GROUP BY a."testId"
    ORDER BY exact DESC, score DESC
    LIMIT 30`;

  const published = rows.filter((r) => index.tests.has(r.id));
  const tests = new Map((await getTestsByIds(published.map((r) => r.id))).map((t) => [t.id, t]));
  const results = published
    .map((r) => {
      const t = tests.get(r.id)!;
      const areaRange = area ? index.testAreas.get(testAreaKey(r.id, area.id)) : undefined;
      return {
        slug: t.slug,
        href: areaRange ? `/test/${t.slug}/${area!.slug}` : `/test/${t.slug}`,
        nameBn: t.nameBn, nameEn: t.nameEn, shortName: t.shortName,
        minPrice: (areaRange ?? index.tests.get(r.id)!).min,
        exact: r.exact,
        score: r.score,
        rank: [r.exact ? 0 : 1, -Math.round(r.score * 100), t.popularRank ?? 9999] as const,
      };
    })
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2])
    .slice(0, limit)
    .map((r) => ({ slug: r.slug, href: r.href, nameBn: r.nameBn, nameEn: r.nameEn, shortName: r.shortName, minPrice: r.minPrice, exact: r.exact, score: r.score }));
  return { results, area: areaOut };
}
