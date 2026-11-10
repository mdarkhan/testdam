// Acceptance tests for search (brief: Bangla, English, synonyms and misspellings all find the test).
import { afterAll, describe, expect, it } from "vitest";
import { searchTests } from "@/lib/search";
import { db } from "@/lib/db";

afterAll(() => db.$disconnect());

describe("searchTests", () => {
  it.each([
    ["CBC", "cbc"],
    ["cbc test er dam", "cbc"],
    ["সিবিসি", "cbc"],
    ["সিবিসি টেস্টের দাম", "cbc"],
    ["complete blood count", "cbc"],
    ["compleet blod count", "cbc"],
    ["C.B.C", "cbc"],
    ["lipid profile", "lipid-profile"],
    ["লিপিড প্রোফাইল", "lipid-profile"],
    ["lipid profail", "lipid-profile"],
    ["thyroid test", "tsh"],
    ["ডেঙ্গু টেস্ট", "dengue-ns1"],
    ["hba1c", "hba1c"],
    ["xray chest", "chest-xray"],
    ["urine re", "urine-re"],
    ["ভিটামিন ডি", "vitamin-d"],
  ])("%s → %s", async (q, slug) => {
    const { results } = await searchTests(q);
    expect(results[0]?.slug).toBe(slug);
  });

  it("detects the area and links to the test × area page when it exists", async () => {
    const { results, area } = await searchTests("CBC test price Mirpur");
    expect(area?.slug).toBe("mirpur");
    expect(results[0]?.slug).toBe("cbc");
    expect(results[0]?.href).toMatch(/^\/test\/cbc(\/mirpur)?$/);
  });

  it("understands Bangla case endings on area names", async () => {
    const { area, results } = await searchTests("মিরপুরে সিবিসি");
    expect(area?.slug).toBe("mirpur");
    expect(results[0]?.slug).toBe("cbc");
  });

  it("returns nothing for gibberish", async () => {
    expect((await searchTests("qwxzv")).results).toEqual([]);
  });
});
