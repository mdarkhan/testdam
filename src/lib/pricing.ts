// Single source of truth for freshness, effective price, ranking and thin-content eligibility.
// Pure functions only (no database) — unit-tested in tests/pricing.test.ts.
import { config } from "./config";

const DAY = 86_400_000;

export type PriceLike = {
  regularPrice: number;
  discountPrice: number | null;
  discountExpiresAt: Date | null;
  verifiedAt: Date;
};

/** Prices verified before this instant are stale (also used in database queries). */
export function staleCutoff(now = new Date(), freshDays = config.freshDays): Date {
  return new Date(now.getTime() - freshDays * DAY);
}

/** Fresh = verified within the last FRESH_DAYS (default 90). */
export function isFresh(p: Pick<PriceLike, "verifiedAt">, now = new Date(), freshDays = config.freshDays): boolean {
  return p.verifiedAt.getTime() >= staleCutoff(now, freshDays).getTime();
}

/** Days before going stale when a price counts as "due" on the admin call list. */
export const DUE_SOON_DAYS = 14;

/** fresh → due (stale within DUE_SOON_DAYS) → stale. Admin call list only; public pages use isFresh. */
export function freshness(p: Pick<PriceLike, "verifiedAt">, now = new Date(), freshDays = config.freshDays): "fresh" | "due" | "stale" {
  if (!isFresh(p, now, freshDays)) return "stale";
  return isFresh(p, now, freshDays - DUE_SOON_DAYS) ? "fresh" : "due";
}

export function hasActiveDiscount(p: PriceLike, now = new Date()): boolean {
  return p.discountPrice != null && p.discountPrice < p.regularPrice && (p.discountExpiresAt == null || p.discountExpiresAt >= now);
}

/** Unexpired discount, otherwise the regular price. */
export function effectivePrice(p: PriceLike, now = new Date()): number {
  return hasActiveDiscount(p, now) ? (p.discountPrice as number) : p.regularPrice;
}

// ───────────────────────────── Ranking ─────────────────────────────

export type RankInput = PriceLike & { labName: string; reportHours: number | null; isFeatured?: boolean };
export type Ranked<T> = T & { effective: number; fresh: boolean; cheapest: boolean };

/**
 * Fresh prices sorted by effective price (ties: faster report, then lab name), then stale prices
 * in their own group, sorted the same way. Only the first fresh price is marked cheapest.
 * `isFeatured` is deliberately never read here: featured labs get a badge, never a better position.
 */
export function rankPrices<T extends RankInput>(rows: T[], now = new Date(), freshDays = config.freshDays): { fresh: Ranked<T>[]; stale: Ranked<T>[] } {
  const withPrice = rows.map((r) => ({ ...r, effective: effectivePrice(r, now), fresh: isFresh(r, now, freshDays), cheapest: false }));
  const order = (a: Ranked<T>, b: Ranked<T>) =>
    a.effective - b.effective ||
    (a.reportHours ?? Number.MAX_SAFE_INTEGER) - (b.reportHours ?? Number.MAX_SAFE_INTEGER) ||
    a.labName.localeCompare(b.labName);
  const fresh = withPrice.filter((r) => r.fresh).sort(order);
  const stale = withPrice.filter((r) => !r.fresh).sort(order);
  if (fresh[0]) fresh[0].cheapest = true;
  return { fresh, stale };
}

/** `updated` = newest verifiedAt (ms) among the fresh prices — used as the sitemap lastmod. */
export type Range = { min: number; max: number; labs: number; updated: number };

/** Price range over FRESH prices only (stale prices never appear in ranges, titles or "cheapest"). */
export function priceRange(fresh: Array<{ effective: number }>): Range | null {
  if (!fresh.length) return null;
  const values = fresh.map((r) => r.effective);
  return { min: Math.min(...values), max: Math.max(...values), labs: fresh.length, updated: 0 };
}

// ───────────────────────────── Thin-content rule ─────────────────────────────

/** Minimum number of labs with a FRESH price before a page is published (hard rule from the brief). */
export const THRESHOLDS = {
  test: 3, // /test/[slug]
  testArea: 2, // /test/[slug]/[area] — labs in that area
  lab: 5, // /lab/[slug] — fresh prices at that lab (owner to confirm)
  areaLabs: 2, // /area/[slug] — labs in the area with a fresh price, plus ≥1 eligible test × area page
} as const;

export type IndexRow = PriceLike & { labId: number; testId: number; areaId: number };

export type CatalogIndex = {
  tests: Map<number, Range>; // eligible tests only
  testAreas: Map<string, Range>; // key `${testId}:${areaId}`, eligible only
  labs: Map<number, number>; // eligible labs → fresh price count
  areas: Map<number, number>; // eligible areas → labs with fresh prices
  updated: Map<string, number>; // `lab:${id}` / `area:${id}` → newest fresh verifiedAt (ms)
  spreads: Map<number, number[]>; // eligible tests → every fresh effective price, ascending (home page spread bars)
  totals: { labs: number; prices: number }; // labs with at least one fresh price, fresh prices
};

export const testAreaKey = (testId: number, areaId: number) => `${testId}:${areaId}`;

/**
 * Builds the set of publishable pages (and their fresh price ranges) from all prices of ACTIVE labs.
 * Used by pages (404 or not), internal links, search suggestions and the sitemap — one rule everywhere.
 */
export function buildIndex(rows: IndexRow[], now = new Date(), freshDays = config.freshDays): CatalogIndex {
  const add = (m: Map<string | number, Range>, k: string | number, v: number, t: number) => {
    const r = m.get(k);
    if (r) { r.min = Math.min(r.min, v); r.max = Math.max(r.max, v); r.labs++; r.updated = Math.max(r.updated, t); }
    else m.set(k, { min: v, max: v, labs: 1, updated: t });
  };
  const updated = new Map<string, number>();
  const touch = (k: string, t: number) => updated.set(k, Math.max(updated.get(k) ?? 0, t));
  const tests = new Map<number, Range>();
  const testAreas = new Map<string, Range>();
  const labCounts = new Map<number, number>();
  const areaLabs = new Map<number, Set<number>>();
  const spreads = new Map<number, number[]>();
  let freshPrices = 0;

  for (const r of rows) {
    if (!isFresh(r, now, freshDays)) continue;
    const e = effectivePrice(r, now);
    const t = r.verifiedAt.getTime();
    add(tests as Map<string | number, Range>, r.testId, e, t);
    spreads.set(r.testId, [...(spreads.get(r.testId) ?? []), e]);
    freshPrices++;
    add(testAreas as Map<string | number, Range>, testAreaKey(r.testId, r.areaId), e, t);
    touch(`lab:${r.labId}`, t);
    touch(`area:${r.areaId}`, t);
    labCounts.set(r.labId, (labCounts.get(r.labId) ?? 0) + 1);
    areaLabs.set(r.areaId, (areaLabs.get(r.areaId) ?? new Set()).add(r.labId));
  }

  for (const [k, v] of tests) if (v.labs < THRESHOLDS.test) tests.delete(k);
  for (const k of spreads.keys()) if (!tests.has(k)) spreads.delete(k); else spreads.get(k)!.sort((a, b) => a - b);
  for (const [k, v] of testAreas) if (v.labs < THRESHOLDS.testArea) testAreas.delete(k);
  const labs = new Map([...labCounts].filter(([, n]) => n >= THRESHOLDS.lab));
  const areasWithPage = new Set([...testAreas.keys()].map((k) => Number(k.split(":")[1])));
  const areas = new Map(
    [...areaLabs].filter(([id, s]) => s.size >= THRESHOLDS.areaLabs && areasWithPage.has(id)).map(([id, s]) => [id, s.size] as [number, number]),
  );
  return { tests, testAreas, labs, areas, updated, spreads, totals: { labs: labCounts.size, prices: freshPrices } };
}
