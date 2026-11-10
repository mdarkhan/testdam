"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { monthRange } from "@/lib/commission";
import type { FormState } from "@/components/admin/form";

/**
 * Bulk status change for one lab's statement month (ADMIN):
 * "invoiced" moves PENDING → INVOICED; "paid" moves PENDING/INVOICED → PAID (dated now).
 * WAIVED and already PAID rows are never touched.
 */
export async function markStatement(labId: number, month: string, to: "INVOICED" | "PAID"): Promise<FormState> {
  await requireUser("ADMIN");
  const range = monthRange(month);
  if (!range) return { message: "Unknown month." };
  const { count } = await db.bookingRequest.updateMany({
    where: {
      labId,
      testedOn: { gte: range.start, lt: range.end },
      billAmount: { not: null },
      commissionStatus: to === "INVOICED" ? "PENDING" : { in: ["PENDING", "INVOICED"] },
    },
    data: to === "PAID" ? { commissionStatus: "PAID", commissionPaidAt: new Date() } : { commissionStatus: "INVOICED" },
  });
  revalidatePath("/admin/commissions");
  revalidatePath(`/admin/commissions/${labId}`);
  revalidatePath("/admin/bookings");
  return { ok: true, message: `${count} booking(s) marked ${to === "PAID" ? "paid" : "invoiced"}.` };
}
