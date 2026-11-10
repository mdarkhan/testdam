"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { bn } from "@/i18n/bn";
import { db } from "@/lib/db";
import { cleanAttribution, validateBooking, type BookingFields, type BookingInput } from "@/lib/booking";
import { effectivePrice, isFresh } from "@/lib/pricing";
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
