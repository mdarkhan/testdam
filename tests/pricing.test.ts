import { describe, expect, it } from "vitest";
import { buildIndex, effectivePrice, isFresh, priceRange, rankPrices, testAreaKey, THRESHOLDS, type IndexRow } from "@/lib/pricing";
import { endOfDhakaDay } from "@/lib/dates";

const now = new Date("2026-11-10T06:00:00Z");
const day = 86_400_000;
const daysAgo = (n: number) => new Date(now.getTime() - n * day);

describe("isFresh", () => {
  it("uses the configured threshold", () => {
    expect(isFresh({ verifiedAt: daysAgo(90) }, now, 90)).toBe(true);
    expect(isFresh({ verifiedAt: daysAgo(91) }, now, 90)).toBe(false);
    expect(isFresh({ verifiedAt: daysAgo(31) }, now, 30)).toBe(false);
  });
});

describe("effectivePrice", () => {
  const p = { regularPrice: 500, discountPrice: 400, discountExpiresAt: null, verifiedAt: now };
  it("uses an unexpired discount", () => {
    expect(effectivePrice(p, now)).toBe(400);
    expect(effectivePrice({ ...p, discountExpiresAt: endOfDhakaDay("2026-11-10") }, now)).toBe(400);
  });
  it("ignores an expired discount", () => {
    expect(effectivePrice({ ...p, discountExpiresAt: endOfDhakaDay("2026-11-09") }, now)).toBe(500);
  });
  it("ignores a 'discount' that is not lower than the regular price", () => {
    expect(effectivePrice({ ...p, discountPrice: 600 }, now)).toBe(500);
  });
});

describe("rankPrices", () => {
  const row = (labName: string, regularPrice: number, extra: Partial<Parameters<typeof rankPrices>[0][number]> = {}) => ({
    labName, regularPrice, discountPrice: null, discountExpiresAt: null, verifiedAt: daysAgo(1), reportHours: 24, isFeatured: false, ...extra,
  });

  it("sorts fresh prices by effective price (discounts count)", () => {
    const { fresh } = rankPrices([row("A", 500), row("B", 300), row("C", 450, { discountPrice: 250 })], now);
    expect(fresh.map((r) => r.labName)).toEqual(["C", "B", "A"]);
    expect(fresh.map((r) => r.effective)).toEqual([250, 300, 500]);
  });

  it("never lets a featured lab jump ahead of a cheaper one", () => {
    const { fresh } = rankPrices([row("Featured", 900, { isFeatured: true }), row("Cheap", 300), row("Mid", 600)], now);
    expect(fresh.map((r) => r.labName)).toEqual(["Cheap", "Mid", "Featured"]);
    expect(fresh.find((r) => r.cheapest)?.labName).toBe("Cheap");
  });

  it("keeps stale prices in their own group and never marks them cheapest", () => {
    const { fresh, stale } = rankPrices([row("Old", 100, { verifiedAt: daysAgo(120) }), row("New", 400)], now, 90);
    expect(fresh.map((r) => r.labName)).toEqual(["New"]);
    expect(stale.map((r) => r.labName)).toEqual(["Old"]);
    expect(stale[0]!.cheapest).toBe(false);
    expect(fresh[0]!.cheapest).toBe(true);
  });

  it("has no cheapest when every price is stale", () => {
    const { fresh, stale } = rankPrices([row("Old", 100, { verifiedAt: daysAgo(120) })], now, 90);
    expect(fresh).toEqual([]);
    expect(stale.some((r) => r.cheapest)).toBe(false);
  });

  it("breaks ties by faster report, then lab name", () => {
    const { fresh } = rankPrices([row("Z", 300, { reportHours: 6 }), row("B", 300, { reportHours: 24 }), row("A", 300, { reportHours: 24 }), row("N", 300, { reportHours: null })], now);
    expect(fresh.map((r) => r.labName)).toEqual(["Z", "A", "B", "N"]);
  });

  it("price range uses fresh prices only", () => {
    const { fresh } = rankPrices([row("A", 300), row("B", 650), row("Old", 50, { verifiedAt: daysAgo(200) })], now, 90);
    expect(priceRange(fresh)).toMatchObject({ min: 300, max: 650, labs: 2 });
    expect(priceRange([])).toBeNull();
  });
});

describe("buildIndex (thin-content rule)", () => {
  // test 1 in area 10 (labs 1,2) and area 20 (lab 3); test 2 only at labs 1,2.
  const p = (labId: number, testId: number, areaId: number, price: number, age = 1): IndexRow => ({
    labId, testId, areaId, regularPrice: price, discountPrice: null, discountExpiresAt: null, verifiedAt: daysAgo(age),
  });

  it("publishes a test page only with ≥3 labs holding a fresh price", () => {
    const idx = buildIndex([p(1, 1, 10, 300), p(2, 1, 10, 400), p(3, 1, 20, 500), p(1, 2, 10, 100), p(2, 2, 10, 200)], now, 90);
    expect(THRESHOLDS.test).toBe(3);
    expect(idx.tests.get(1)).toMatchObject({ min: 300, max: 500, labs: 3, updated: daysAgo(1).getTime() });
    expect(idx.tests.has(2)).toBe(false);
  });

  it("does not count stale prices", () => {
    const idx = buildIndex([p(1, 1, 10, 300), p(2, 1, 10, 400), p(3, 1, 20, 500, 120)], now, 90);
    expect(idx.tests.has(1)).toBe(false);
  });

  it("publishes a test × area page only with ≥2 labs in that area", () => {
    const idx = buildIndex([p(1, 1, 10, 300), p(2, 1, 10, 400), p(3, 1, 20, 500)], now, 90);
    expect(idx.testAreas.get(testAreaKey(1, 10))).toMatchObject({ min: 300, max: 400, labs: 2 });
    expect(idx.testAreas.has(testAreaKey(1, 20))).toBe(false);
  });

  it("publishes lab pages with ≥5 fresh prices and area pages with ≥2 labs and an eligible test × area page", () => {
    const rows: IndexRow[] = [];
    for (let t = 1; t <= 5; t++) rows.push(p(1, t, 10, 100 * t), p(2, t, 10, 110 * t));
    rows.push(p(3, 1, 20, 300), p(4, 2, 20, 300)); // area 20: 2 labs, but no test with 2 labs there
    const idx = buildIndex(rows, now, 90);
    expect([...idx.labs.keys()].sort()).toEqual([1, 2]);
    expect(idx.areas.get(10)).toBe(2);
    expect(idx.areas.has(20)).toBe(false);
  });
});

describe("freshness (admin call list)", () => {
  it("marks prices due 14 days before they go stale", async () => {
    const { freshness } = await import("@/lib/pricing");
    expect(freshness({ verifiedAt: daysAgo(10) }, now, 90)).toBe("fresh");
    expect(freshness({ verifiedAt: daysAgo(80) }, now, 90)).toBe("due");
    expect(freshness({ verifiedAt: daysAgo(91) }, now, 90)).toBe("stale");
  });
});
