import { describe, expect, it } from "vitest";
import { classifyRow, parsePriceCsv, toCsv, validatePrice } from "@/lib/csv";
import { dhakaDateString } from "@/lib/dates";

const lookups = { labs: new Map([["demo-lab-1", 1]]), tests: new Map([["cbc", 10], ["lipid-profile", 11]]) };
const now = new Date("2026-11-10T06:00:00Z");

describe("parsePriceCsv", () => {
  it("parses valid rows and reports errors per line", () => {
    const csv = [
      "lab_slug,test_slug,regular_price,discount_price,discount_expires,report_hours,home_collection,source,source_note,verified_on",
      "demo-lab-1,cbc,400,350,2026-12-31,6,yes,phone,,",
      "demo-lab-1,lipid-profile,\"1,200\",,,24,no,PRICE_LIST,board photo,2026-11-01",
      "demo-lab-1,unknown,500,,,,no,phone,,",
      "demo-lab-1,cbc,400,500,,,maybe,fax,,",
    ].join("\n");
    const { rows, errors, fatal } = parsePriceCsv(csv, lookups, { now });
    expect(fatal).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.data).toMatchObject({ regularPrice: 400, discountPrice: 350, reportHours: 6, homeCollection: true, source: "PHONE_CALL" });
    expect(dhakaDateString(rows[0]!.data.discountExpiresAt!)).toBe("2026-12-31");
    expect(rows[1]!.data.regularPrice).toBe(1200);
    expect(dhakaDateString(rows[1]!.data.verifiedAt)).toBe("2026-11-01");
    expect(errors.map((e) => e.line)).toEqual([4, 5]);
    expect(errors[0]!.errors.join()).toMatch(/unknown test_slug/);
    expect(errors[1]!.errors.join()).toMatch(/duplicate of line 2/);
    expect(errors[1]!.errors.join()).toMatch(/discount_price must be lower/);
    expect(errors[1]!.errors.join()).toMatch(/home_collection/);
    expect(errors[1]!.errors.join()).toMatch(/source "fax"/);
  });

  it("uses the default lab when importing from a lab's page", () => {
    const { rows } = parsePriceCsv("test_slug,regular_price,source\ncbc,৪০০,phone", lookups, { defaultLabSlug: "demo-lab-1", now });
    expect(rows[0]).toMatchObject({ labId: 1, testId: 10, data: { regularPrice: 400 } });
  });

  it("treats different aliases of one test as duplicates", () => {
    const l = { labs: lookups.labs, tests: new Map([...lookups.tests, ["sibisi", 10]]) };
    const csv = ["test_slug,regular_price,source", "cbc,400,phone", "সিবিসি,450,phone"].join("\n");
    const { rows, errors } = parsePriceCsv(csv, l, { defaultLabSlug: "demo-lab-1", now });
    expect(rows).toHaveLength(1);
    expect(errors[0]!.errors.join()).toMatch(/duplicate of line 2/);
  });

  it("fails clearly on missing columns", () => {
    expect(parsePriceCsv("foo,bar\n1,2", lookups).fatal).toMatch(/Missing column/);
  });

  it("round-trips through export", () => {
    const v = validatePrice({ regularPrice: "400", discountPrice: "350", discountExpires: "2026-12-31", source: "phone", homeCollection: "yes" }, now);
    if (!v.ok) throw new Error("invalid");
    const csv = toCsv([{ labSlug: "demo-lab-1", testSlug: "cbc", ...v.data }]);
    const back = parsePriceCsv(csv, lookups, { now });
    expect(back.errors).toEqual([]);
    expect(back.rows[0]!.data.discountExpiresAt?.getTime()).toBe(v.data.discountExpiresAt?.getTime());
  });
});

describe("classifyRow", () => {
  const base = { regularPrice: 400, discountPrice: null, discountExpiresAt: null, reportHours: 6, homeCollection: true, source: "PHONE_CALL" as const, sourceNote: null, verifiedAt: now };
  it("detects new / changed / verify-only", () => {
    expect(classifyRow(base, undefined)).toBe("new");
    expect(classifyRow(base, { ...base, verifiedAt: new Date("2026-01-01") })).toBe("verify_only");
    expect(classifyRow({ ...base, regularPrice: 450 }, base)).toBe("changed");
  });
});
