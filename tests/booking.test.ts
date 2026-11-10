import { describe, expect, it } from "vitest";
import { cleanAttribution, validateBooking, type BookingInput } from "@/lib/booking";
import { eventPayload } from "@/lib/analytics";
import { createRateLimiter } from "@/lib/rate-limit";

const now = new Date("2026-11-10T20:00:00Z"); // 02:00 on 11 Nov in Dhaka
const base: BookingInput = { testSlug: "cbc", labSlug: "demo-lab-1", name: "রহিম উদ্দিন", phone: "+880 1712-345678", preferredDate: "2026-11-12", homeCollection: false };

describe("validateBooking", () => {
  it("accepts a valid request and normalises the phone", () => {
    const r = validateBooking(base, now);
    expect(r).toEqual({ ok: true, data: { name: "রহিম উদ্দিন", phone: "01712345678", preferredDate: "2026-11-12" } });
  });

  it("uses the Dhaka calendar for 'today'", () => {
    expect(validateBooking({ ...base, preferredDate: "2026-11-10" }, now).ok).toBe(false); // already yesterday in Dhaka
    expect(validateBooking({ ...base, preferredDate: "2026-11-11" }, now).ok).toBe(true);
  });

  it("rejects dates more than 60 days ahead, bad phones and empty names — with Bangla messages", () => {
    const r = validateBooking({ ...base, name: " a ", phone: "12345", preferredDate: "2027-03-01" }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.fieldErrors).sort()).toEqual(["name", "phone", "preferredDate"]);
      expect(r.fieldErrors.phone).toMatch(/মোবাইল/);
    }
  });

  it("accepts Bangla digits in the date", () => {
    expect(validateBooking({ ...base, preferredDate: "২০২৬-১১-১২" }, now).ok).toBe(true);
  });

  it("trims attribution and drops junk", () => {
    expect(cleanAttribution({ utmSource: "  facebook ", referrer: "x".repeat(900), utmMedium: "" })).toMatchObject({ utmSource: "facebook", utmMedium: null, referrer: "x".repeat(500) });
    expect(cleanAttribution(undefined).utmSource).toBeNull();
  });
});

describe("eventPayload (dataLayer)", () => {
  it("uses snake_case params and skips empty ones", () => {
    expect(eventPayload("view_test_prices", { test_slug: "cbc", area_slug: undefined, lab_count: 3, min_price: 300 })).toEqual({ event: "view_test_prices", test_slug: "cbc", lab_count: 3, min_price: 300 });
  });

  it("never lets personal data through, even if a caller passes it", () => {
    const sneaky = { test_slug: "cbc", lab_slug: "x", area_slug: "mirpur", price: 300, booking_id: 7, name: "Rahim", phone: "01712345678" } as never;
    const out = eventPayload("generate_lead", sneaky);
    expect(out).toEqual({ event: "generate_lead", test_slug: "cbc", lab_slug: "x", area_slug: "mirpur", price: 300, booking_id: 7 });
    expect(JSON.stringify(out)).not.toMatch(/Rahim|01712/);
  });
});

describe("createRateLimiter", () => {
  it("allows N hits per window per key", () => {
    const rl = createRateLimiter(2, 1000);
    expect([rl.allow("a", 0), rl.allow("a", 10), rl.allow("a", 20), rl.allow("b", 20)]).toEqual([true, true, false, true]);
    expect(rl.allow("a", 1011)).toBe(true); // first hit expired
  });
});
