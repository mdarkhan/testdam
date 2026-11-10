"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { bn } from "@/i18n/bn";
import { db } from "@/lib/db";
import { cleanAttribution, generateBookingCode, validateBooking, type BookingFields, type BookingInput } from "@/lib/booking";
import { validateCorporate, type CorporateFields, type CorporateInput } from "@/lib/corporate";
import { BASKET_MAX, effectivePrice, isFresh } from "@/lib/pricing";
import { createRateLimiter } from "@/lib/rate-limit";
import type { Prisma } from "@/generated/prisma/client";

export type BookingResult =
  | { ok: true; id: number | null; price: number; code: string | null; discountPct: number | null }
  | { ok: false; message: string; fieldErrors?: Partial<Record<keyof BookingFields, string>> };

// Spam protection (no CAPTCHA, per the brief): honeypot + 5 requests / 10 min per IP + 3 / day per phone.
const perIp = createRateLimiter(5, 10 * 60_000);
const perPhone = createRateLimiter(3, 24 * 60 * 60_000);
// Company requests: rarer and longer, so a tighter per-IP limit of their own.
const corpPerIp = createRateLimiter(3, 60 * 60_000);

const HONEYPOT_OK = { ok: true, id: null, price: 0, code: null, discountPct: null } as const;

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** The discount a partner lab promises for a Test Mate code, or null. */
const partnerDiscount = (lab: { isPartner: boolean; partnerDiscountPct: number | null }) =>
  lab.isPartner && lab.partnerDiscountPct ? lab.partnerDiscountPct : null;

/** Creates the booking with a fresh random code; retries if a code is already taken (unique index). */
async function createWithCode(data: Omit<Prisma.BookingRequestUncheckedCreateInput, "code">) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.bookingRequest.create({ data: { ...data, code: generateBookingCode() } });
    } catch (e) {
      // The only unique column on a booking is `code`, so P2002 means "pick another code".
      if (attempt < 4 && (e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }
}

export async function createBooking(input: BookingInput): Promise<BookingResult> {
  // Honeypot filled → pretend success, store nothing (bots get no signal to adapt to).
  if (input.website) return HONEYPOT_OK;

  const v = validateBooking(input);
  if (!v.ok) return { ok: false, message: bn.bookingFix, fieldErrors: v.fieldErrors };

  const ip = await clientIp();
  if (!perIp.allow(ip) || !perPhone.allow(v.data.phone)) return { ok: false, message: bn.bookingErrors.rateLimited };

  try {
    // The price shown is re-read from the database — never trusted from the browser.
    const price = await db.labTestPrice.findFirst({
      where: { test: { slug: input.testSlug }, lab: { slug: input.labSlug, isActive: true } },
      include: { lab: { select: { id: true, isPartner: true, partnerDiscountPct: true, area: { select: { slug: true } } } }, test: { select: { id: true } } },
    });
    if (!price) return { ok: false, message: bn.bookingErrors.unavailable };
    const now = new Date();
    const area = input.areaSlug && (await db.area.findUnique({ where: { slug: input.areaSlug }, select: { slug: true } }));
    const discountPct = partnerDiscount(price.lab);

    const booking = await createWithCode({
      testId: price.test.id,
      labId: price.lab.id,
      areaSlug: area ? area.slug : price.lab.area.slug,
      priceAtRequest: effectivePrice(price, now),
      patientName: v.data.name,
      phone: v.data.phone,
      preferredDate: new Date(`${v.data.preferredDate}T00:00:00Z`),
      homeCollection: !!input.homeCollection && price.homeCollection,
      partnerDiscountPct: discountPct,
      notes: isFresh(price, now) ? null : "Price was stale when the request was made — confirm with the lab.",
      ...cleanAttribution(input.attribution),
    });
    revalidatePath("/admin/bookings");
    return { ok: true, id: booking.id, price: booking.priceAtRequest, code: booking.code, discountPct };
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
  if (input.website) return HONEYPOT_OK;

  const slugs = [...new Set(Array.isArray(input.testSlugs) ? input.testSlugs : [])].filter((s) => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s));
  if (!slugs.length || slugs.length > BASKET_MAX) return { ok: false, message: bn.bookingErrors.unavailable };

  const v = validateBooking({ ...input, testSlug: slugs[0]! });
  if (!v.ok) return { ok: false, message: bn.bookingFix, fieldErrors: v.fieldErrors };

  const ip = await clientIp();
  if (!perIp.allow(ip) || !perPhone.allow(v.data.phone)) return { ok: false, message: bn.bookingErrors.rateLimited };

  try {
    const lab = await db.lab.findFirst({
      where: { slug: input.labSlug, isActive: true },
      select: { id: true, isPartner: true, partnerDiscountPct: true, area: { select: { slug: true } } },
    });
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
    const discountPct = partnerDiscount(lab);

    const booking = await createWithCode({
      testId: items[0]!.testId,
      labId: lab.id,
      areaSlug: lab.area.slug,
      priceAtRequest: total,
      patientName: v.data.name,
      phone: v.data.phone,
      preferredDate: new Date(`${v.data.preferredDate}T00:00:00Z`),
      homeCollection: !!input.homeCollection && items.every((i) => i.home),
      partnerDiscountPct: discountPct,
      notes: stale ? "A price was stale when the request was made — confirm with the lab." : null,
      items: { create: items.map(({ testId, priceAtRequest }) => ({ testId, priceAtRequest })) },
      ...cleanAttribution(input.attribution),
    });
    revalidatePath("/admin/bookings");
    return { ok: true, id: booking.id, price: total, code: booking.code, discountPct };
  } catch (e) {
    console.error("[booking] basket create failed", e);
    return { ok: false, message: bn.bookingErrors.server };
  }
}

export type CorporateResult =
  | { ok: true; id: number | null; employees: number }
  | { ok: false; message: string; fieldErrors?: Partial<Record<CorporateFields, string>> };

/** "Health check-up for your office" request (/corporate). */
export async function createCorporateRequest(input: CorporateInput & { attribution?: BookingInput["attribution"] }): Promise<CorporateResult> {
  if (input.website) return { ok: true, id: null, employees: 0 };

  const v = validateCorporate(input);
  if (!v.ok) return { ok: false, message: bn.bookingFix, fieldErrors: v.fieldErrors };

  if (!corpPerIp.allow(await clientIp()) || !perPhone.allow(v.data.phone)) return { ok: false, message: bn.bookingErrors.rateLimited };

  try {
    const req = await db.corporateRequest.create({ data: { ...v.data, ...cleanAttribution(input.attribution) } });
    revalidatePath("/admin/corporate");
    return { ok: true, id: req.id, employees: req.employees };
  } catch (e) {
    console.error("[corporate] create failed", e);
    return { ok: false, message: bn.bookingErrors.server };
  }
}
