import { describe, expect, it } from "vitest";
import { extractArea, normalizeText, romanize, searchKey, slugify } from "@/lib/normalize";

describe("searchKey", () => {
  it("lines up English spellings of the same test", () => {
    const k = searchKey("CBC");
    for (const q of ["cbc", "C.B.C", "CBC test", "cbc test er dam", "CBC test price Dhaka", "  cbc  "]) {
      expect(searchKey(q)).toBe(k);
    }
  });

  it("strips Bangla filler words", () => {
    expect(searchKey("সিবিসি টেস্টের দাম")).toBe(searchKey("সিবিসি"));
    expect(searchKey("সিবিসি টেস্ট কত টাকা")).toBe(searchKey("সিবিসি"));
  });

  it("romanises Bangla to ASCII so pg_trgm can index it", () => {
    expect(searchKey("সিবিসি")).toBe("sibisi");
    expect(searchKey("লিপিড প্রোফাইল")).toBe("lipid profail");
    expect(searchKey("সিবিসি")).toMatch(/^[a-z ]+$/);
  });

  it("merges letters people mix up (long/short vowels, sibilants)", () => {
    const decomposedYa = String.fromCharCode(0x09af, 0x09bc);
    const precomposedYa = String.fromCharCode(0x09df);
    expect(decomposedYa).not.toBe(precomposedYa);
    expect(searchKey(`থাইর${decomposedYa}েড`)).toBe(searchKey(`থাইর${precomposedYa}েড`));
    expect(searchKey(`থাইর${precomposedYa}েড`)).toBe("thairyed");
    expect(searchKey("সুগার")).toBe(searchKey("শূগার"));
  });

  it("keeps meaningful single letters such as Vitamin E", () => {
    expect(searchKey("Vitamin E test")).toBe("vitamin e");
  });

  it("does not return an empty key for a query made only of fillers", () => {
    expect(searchKey("test")).toBe("test");
  });

  it("converts Bangla digits", () => {
    expect(normalizeText("এইচবিএ১সি")).toContain("1");
  });
});

describe("slugify", () => {
  it("makes ASCII slugs", () => {
    expect(slugify("Lipid Profile")).toBe("lipid-profile");
    expect(slugify("Demo Lab 1 (Mirpur-10)")).toBe("demo-lab-1-mirpur-10");
    expect(slugify("মিরপুর")).toBe(romanize("মিরপুর"));
  });
});

describe("extractArea", () => {
  const areas = [
    { slug: "mirpur", keys: ["mirpur", "mirpur 10", searchKey("মিরপুর")] },
    { slug: "uttara", keys: ["uttara", searchKey("উত্তরা")] },
  ];
  it.each([
    ["CBC test price Mirpur", "mirpur", "cbc"],
    ["cbc mirpur 10", "mirpur", "cbc"],
    ["মিরপুরে সিবিসি টেস্টের দাম", "mirpur", "sibisi"],
    ["উত্তরায় লিপিড প্রোফাইল", "uttara", "lipid profail"],
    ["lipid profile", null, "lipid profile"],
  ])("%s", (q, area, rest) => {
    const r = extractArea(searchKey(q), areas);
    expect(r.area?.slug ?? null).toBe(area);
    expect(r.rest).toBe(rest);
  });
  it("does not match an area name inside another word", () => {
    expect(extractArea("mirpurian", areas).area).toBeNull();
  });
});
