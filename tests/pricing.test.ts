import { describe, expect, it } from "vitest";
import { effectivePrice, isFresh } from "@/lib/pricing";
import { endOfDhakaDay } from "@/lib/dates";

const now = new Date("2026-11-10T06:00:00Z");
const day = 86_400_000;

describe("isFresh", () => {
  it("uses the configured threshold", () => {
    expect(isFresh({ verifiedAt: new Date(now.getTime() - 90 * day) }, now, 90)).toBe(true);
    expect(isFresh({ verifiedAt: new Date(now.getTime() - 91 * day) }, now, 90)).toBe(false);
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
});
