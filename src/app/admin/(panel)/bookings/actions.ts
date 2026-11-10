"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseForm, zOptText } from "@/lib/forms";
import type { FormState } from "@/components/admin/form";
import { BOOKING_STATUSES } from "@/lib/booking";


export async function updateBooking(id: number, _: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  const parsed = parseForm(z.object({ status: z.enum(BOOKING_STATUSES), notes: zOptText(2000) }), data);
  if ("error" in parsed) return parsed.error;
  await db.bookingRequest.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/bookings");
  return { ok: true, message: `Booking #${id} saved.` };
}
