import { describe, expect, it } from "vitest";
import { bpsToPercent, commissionFor, csvCell, monthRange, percentToBps, shiftMonth, statementCsv, statementTotals } from "@/lib/commission";
import { generateBookingCode, normalizeBookingCode } from "@/lib/booking";

describe("commission maths", () => {
  it("parses percentages into basis points, Bangla digits included", () => {
    expect(percentToBps("10")).toBe(1000);
    expect(percentToBps("12.5")).toBe(1250);
    expect(percentToBps("৭.২৫%")).toBe(725);
    expect(percentToBps("")).toBeNull();
    expect(percentToBps("abc")).toBeNaN();
    expect(percentToBps("12.345")).toBeNaN();
    expect(percentToBps("60")).toBeNaN(); // above 50%
  });
  it("prints basis points back as a short percentage", () => {
    expect(bpsToPercent(1000)).toBe("10");
    expect(bpsToPercent(1250)).toBe("12.5");
    expect(bpsToPercent(725)).toBe("7.25");
  });
  it("rounds commission to whole taka", () => {
    expect(commissionFor(1990, 1000)).toBe(199);
    expect(commissionFor(1995, 1000)).toBe(200); // 199.5 → 200
    expect(commissionFor(1234, 1250)).toBe(154); // 154.25
  });
  it("gives statement month bounds and neighbours", () => {
    expect(monthRange("2026-11")).toEqual({ start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-12-01T00:00:00Z") });
    expect(monthRange("2026-13")).toBeNull();
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("booking codes", () => {
  it("are TM- plus 5 unambiguous characters", () => {
    const code = generateBookingCode(() => new Uint32Array([0, 1, 30, 31, 100]));
    expect(code).toBe("TM-23Z29"); // 31 wraps to the first character, 100 % 31 = 7 → "9"
  });
  it("never contains look-alike characters", () => {
    for (let i = 0; i < 200; i++) expect(generateBookingCode()).toMatch(/^TM-[2-9A-HJKMNP-Z]{5}$/);
  });
  it("normalises typed codes", () => {
    expect(normalizeBookingCode("tm 7k3p9")).toBe("TM-7K3P9");
    expect(normalizeBookingCode("TM-12")).toBe("TM-12");
    expect(normalizeBookingCode("hello")).toBeNull();
  });
});

describe("lab statements", () => {
  const row = (over: Partial<import("@/lib/commission").StatementRow>) => ({
    code: "TM-ABCDE", testedOn: "2026-11-05", patient: "Rahim", tests: "CBC", bill: 1000, bps: 1000, commission: 100, status: "PENDING" as const, ...over,
  });
  it("totals due, paid and waived separately", () => {
    const t = statementTotals([row({}), row({ status: "INVOICED", commission: 50 }), row({ status: "PAID", commission: 70 }), row({ status: "WAIVED", commission: 30 })]);
    expect(t).toEqual({ count: 4, bill: 4000, commission: 220, due: 150, paid: 70, waived: 30 });
  });
  it("escapes CSV cells and defuses spreadsheet formulas", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+8801712")).toBe("'+8801712");
    expect(csvCell(-5)).toBe("-5"); // numbers are numbers
  });
  it("builds a statement with rows and totals", () => {
    const csv = statementCsv([row({ patient: "Karim, Jr" })], { lab: "Demo Lab", month: "2026-11" });
    expect(csv).toContain('TM-ABCDE,2026-11-05,"Karim, Jr",CBC,1000,10,100,PENDING');
    expect(csv).toContain("Due (pending + invoiced),,,,,,100");
  });
});
