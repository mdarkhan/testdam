import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { breadcrumbLd, buildSitemap, JsonLd, labLd, pageMetadata, priceListLd } from "@/lib/seo";
import { buildIndex, type IndexRow } from "@/lib/pricing";

const now = new Date("2026-11-10T06:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const p = (labId: number, testId: number, areaId: number, price: number, age = 1): IndexRow => ({
  labId, testId, areaId, regularPrice: price, discountPrice: null, discountExpiresAt: null, verifiedAt: daysAgo(age),
});

describe("buildSitemap", () => {
  // test 1: 3 fresh labs (2 in area 10) → test page + test×area page. test 2: only 2 labs → no page.
  // labs 1,2 have 5 fresh prices → lab pages; lab 3 has 1 → none. area 10 → page, area 20 → none.
  const rows: IndexRow[] = [p(1, 1, 10, 300), p(2, 1, 10, 400, 3), p(3, 1, 20, 500), p(1, 2, 10, 100), p(2, 2, 10, 200)];
  for (let t = 3; t <= 5; t++) rows.push(p(1, t, 10, 100), p(2, t, 10, 100, 120)); // lab 2's are stale
  rows.push(p(2, 6, 10, 100), p(2, 7, 10, 100), p(2, 8, 10, 100));
  const index = buildIndex(rows, now, 90);
  const slugs = {
    tests: new Map(Array.from({ length: 8 }, (_, i) => [i + 1, `t${i + 1}`] as [number, string])),
    areas: new Map([[10, "mirpur"], [20, "uttara"]]),
    labs: new Map([[1, "lab-1"], [2, "lab-2"], [3, "lab-3"]]),
  };
  const urls = buildSitemap(index, slugs, now).map((e) => e.url.replace(/^https?:\/\/[^/]+/, ""));

  it("lists exactly the published pages (thin-content rule)", () => {
    expect(urls).toContain("/test/t1");
    expect(urls).toContain("/test/t1/mirpur");
    expect(urls).not.toContain("/test/t2");
    expect(urls).not.toContain("/test/t1/uttara");
    expect(urls).toContain("/area/mirpur");
    expect(urls).not.toContain("/area/uttara");
    expect(urls).not.toContain("/lab/lab-3");
    expect(urls.filter((u) => u.startsWith("/lab/")).sort()).toEqual([...index.labs.keys()].map((id) => `/lab/lab-${id}`).sort());
  });

  it("uses the newest fresh verification as lastModified", () => {
    const e = buildSitemap(index, slugs, now).find((x) => x.url.endsWith("/test/t1/mirpur"))!;
    expect(e.lastModified.getTime()).toBe(daysAgo(1).getTime());
  });

  it("skips ids whose slug is unknown", () => {
    expect(buildSitemap(index, { ...slugs, tests: new Map() }, now).some((e) => e.url.includes("/test/"))).toBe(false);
  });
});

describe("structured data", () => {
  it("escapes < so database text cannot close the script tag", () => {
    const html = renderToStaticMarkup(JsonLd({ data: { name: "</script><script>alert(1)</script>" } }));
    expect(html).not.toContain("</script><script>");
    expect(html).toContain("\\u003c/script");
  });

  it("builds breadcrumbs with positions and absolute URLs", () => {
    const ld = breadcrumbLd([{ name: "হোম", path: "/" }, { name: "CBC" }], "/test/cbc");
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(ld.itemListElement[1]!.item).toMatch(/\/test\/cbc$/);
  });

  it("has no review or rating markup anywhere", () => {
    const all = JSON.stringify([
      labLd({ name: "Demo Lab 1", nameBn: null, branchName: null, address: "x", phone: "1", mapUrl: null, areaNameEn: "Mirpur", path: "/lab/x" }),
      priceListLd("CBC", "/test/cbc", [{ name: "Lab", price: "৳৩০০", path: null }]),
    ]);
    expect(all).not.toMatch(/rating|review/i);
  });

  it("gives every page a canonical URL and Open Graph data", () => {
    const m = pageMetadata({ title: "t", description: "d", path: "/test/cbc" });
    expect(m.alternates?.canonical).toBe("/test/cbc");
    expect(m.openGraph).toMatchObject({ url: "/test/cbc", locale: "bn_BD" });
  });
});
