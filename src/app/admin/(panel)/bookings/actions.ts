"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseForm, zOptInt, zOptText } from "@/lib/forms";
import type { FormState } from "@/components/admin/form";
import { BOOKING_STATUSES, COMMISSION_STATUSES } from "@/lib/booking";
import { commissionFor, percentToBps } from "@/lib/commission";

export async function updateBooking(id: number, _: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  const parsed = parseForm(z.object({ status: z.enum(BOOKING_STATUSES), notes: zOptText(2000) }), data);
  if ("error" in parsed) return parsed.error;
  await db.bookingRequest.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/bookings");
  return { ok: true, message: `Booking #${id} saved.` };
}

const commissionSchema = z.object({
  testedOn: z.string().trim().optional().transform((v) => v || null)
    .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Test date must be a date"),
  billAmount: zOptInt("Bill amount"),
  commissionPct: z.string().optional().transform((v, ctx) => {
    const bps = percentToBps(v);
    if (Number.isNaN(bps)) { ctx.addIssue({ code: "custom", message: "Commission must be a percentage from 0 to 50, e.g. 10 or 12.5" }); return z.NEVER; }
    return bps;
  }),
  commissionStatus: z.union([z.enum(COMMISSION_STATUSES), z.literal("")]).optional().transform((v) => v || null),
});

/**
 * Records what the patient paid and what the lab owes us (ADMIN only). A blank bill clears the
 * commission. A blank rate uses the lab's agreed rate. The amount is always recomputed here.
 */
export async function updateCommission(id: number, _: FormState, data: FormData): Promise<FormState> {
  await requireUser("ADMIN");
  const parsed = parseForm(commissionSchema, data);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;
  const booking = await db.bookingRequest.findUnique({
    where: { id },
    select: { status: true, preferredDate: true, commissionStatus: true, commissionPaidAt: true, lab: { select: { commissionBps: true } } },
  });
  if (!booking) return { message: "Booking not found." };

  if (d.billAmount == null) {
    await db.bookingRequest.update({
      where: { id },
      data: { billAmount: null, commissionBps: null, commissionAmount: null, commissionStatus: null, commissionPaidAt: null, testedOn: d.testedOn ? new Date(`${d.testedOn}T00:00:00Z`) : null },
    });
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/commissions");
    return { ok: true, message: `Booking #${id}: commission cleared.` };
  }

  const bps = d.commissionPct ?? booking.lab.commissionBps;
  if (bps == null) return { message: "Enter a commission % (this lab has no agreed rate yet).", fieldErrors: { commissionPct: "Enter a commission %" } };
  if (!d.testedOn) return { message: "Enter the test date: it decides the statement month.", fieldErrors: { testedOn: "Enter the test date" } };
  const status = d.commissionStatus ?? "PENDING";

  await db.bookingRequest.update({
    where: { id },
    data: {
      testedOn: new Date(`${d.testedOn}T00:00:00Z`),
      billAmount: d.billAmount,
      commissionBps: bps,
      commissionAmount: commissionFor(d.billAmount, bps),
      commissionStatus: status,
      commissionPaidAt: status === "PAID" ? (booking.commissionPaidAt ?? new Date()) : null,
      // A bill means the test happened.
      ...(booking.status !== "COMPLETED" && { status: "COMPLETED" as const }),
    },
  });
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/commissions");
  return { ok: true, message: `Booking #${id}: commission ৳${commissionFor(d.billAmount, bps)} saved.` };
}
