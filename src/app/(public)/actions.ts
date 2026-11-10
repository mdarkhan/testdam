"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { bn } from "@/i18n/bn";
import { db } from "@/lib/db";
import { cleanAttribution, validateBooking, type BookingFields, type BookingInput } from "@/lib/booking";
import { BASKET_MAX, effectivePrice, isFresh } from "@/lib/pricing";
import { createRateLimiter } from "@/lib/rate-limit";

export type BookingResult =
  | { ok: true; id: number | null; price: number }
  | { ok: false; message: string; fieldErrors?: Partial<Record<keyof BookingFields, string>> };

// Spam protection (no CAPTCHA, per the brief): honeypot + 5 requests / 10 min per IP + 3 / day per phone.
const perIp = createRateLimiter(5, 10 * 60_000);
const perPhone = createRateLimiter(3, 24 * 60 * 60_000);

export async function createBooking(input: BookingInput): Promise<BookingResult> {
  // Honeypot filled → pretend success, store nothing (bots get no signal to adapt to).
  if (input.website) return { ok: true, id: null, price: 0 };

  const v = validateBooking(input);
  if (!v.ok) return { ok: false, message: bn.bookingFix, fieldErrors: v.fieldErrors };

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  if (!perIp.allow(ip) || !perPhone.allow(v.data.phone)) return { ok: false, message: bn.bookingErrors.rateLimited };

  try {
    // The price shown is re-read from the database — never trusted from the browser.
    const price = await db.labTestPrice.findFirst({
      where: { test: { slug: input.testSlug }, lab: { slug: input.labSlug, isActive: true } },
      include: { lab: { select: { id: true, area: { select: { slug: true } } } }, test: { select: { id: true } } },
    });
    if (!price) return { ok: false, message: bn.bookingErrors.unavailable };
    const now = new Date();
    const area = input.areaSlug && (await db.area.findUnique({ where: { slug: input.areaSlug }, select: { slug: true } }));

    const booking = await db.bookingRequest.create({
      data: {
        testId: price.test.id,
        labId: price.lab.id,
        areaSlug: area ? area.slug : price.lab.area.slug,
        priceAtRequest: effectivePrice(price, now),
        patientName: v.data.name,
        phone: v.data.phone,
        preferredDate: new Date(`${v.data.preferredDate}T00:00:00Z`),
        homeCollection: !!input.homeCollection && price.homeCollection,
        notes: isFresh(price, now) ? null : "Price was stale when the request was made — confirm with the lab.",
        ...cleanAttribution(input.attribution),
      },
    });
    revalidatePath("/admin/bookings");
    return { ok: true, id: booking.id, price: booking.priceAtRequest };
  } catch (e) {
    console.error("[booking] create failed", e);
    return { ok: false, message: bn.bookingErrors.server };
  }
}

export type BasketBookingInput = Omit<BookingInput, "testSlug"> & { testSlugs: string[] };

/**
 * One request for several tests at one lab (from the test basket). Same validation and spam
 * limits as a single booking; every price is re-read here and the lab must have all the tests.
 */
export async function createBasketBooking(input: BasketBookingInput): Promise<BookingResult> {
  if (input.website) return { ok: true, id: null, price: 0 };

  const slugs = [...new Set(Array.isArray(input.testSlugs) ? input.testSlugs : [])].filter((s) => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s));
  if (!slugs.length || slugs.length > BASKET_MAX) return { ok: false, message: bn.bookingErrors.unavailable };

  const v = validateBooking({ ...input, testSlug: slugs[0]! });
  if (!v.ok) return { ok: false, message: bn.bookingFix, fieldErrors: v.fieldErrors };

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  if (!perIp.allow(ip) || !perPhone.allow(v.data.phone)) return { ok: false, message: bn.bookingErrors.rateLimited };

  try {
    const lab = await db.lab.findFirst({ where: { slug: input.labSlug, isActive: true }, select: { id: true, area: { select: { slug: true } } } });
    if (!lab) return { ok: false, message: bn.bookingErrors.unavailable };
    const prices = await db.labTestPrice.findMany({
      where: { labId: lab.id, test: { slug: { in: slugs } } },
      include: { test: { select: { id: true, slug: true } } },
    });
    const bySlug = new Map(prices.map((p) => [p.test.slug, p]));
    if (slugs.some((s) => !bySlug.has(s))) return { ok: false, message: bn.bookingErrors.unavailable };

    const now = new Date();
    const items = slugs.map((s) => { const p = bySlug.get(s)!; return { testId: p.test.id, priceAtRequest: effectivePrice(p, now), fresh: isFresh(p, now), home: p.homeCollection }; });
    const total = items.reduce((sum, i) => sum + i.priceAtRequest, 0);
    const stale = items.some((i) => !i.fresh);

    const booking = await db.bookingRequest.create({
      data: {
        testId: items[0]!.testId,
        labId: lab.id,
        areaSlug: lab.area.slug,
        priceAtRequest: total,
        patientName: v.data.name,
        phone: v.data.phone,
        preferredDate: new Date(`${v.data.preferredDate}T00:00:00Z`),
        homeCollection: !!input.homeCollection && items.every((i) => i.home),
        notes: stale ? "A price was stale when the request was made — confirm with the lab." : null,
        items: { create: items.map(({ testId, priceAtRequest }) => ({ testId, priceAtRequest })) },
        ...cleanAttribution(input.attribution),
      },
    });
    revalidatePath("/admin/bookings");
    return { ok: true, id: booking.id, price: total };
  } catch (e) {
    console.error("[booking] basket create failed", e);
    return { ok: false, message: bn.bookingErrors.server };
  }
}
