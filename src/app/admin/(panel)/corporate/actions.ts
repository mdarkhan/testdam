"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseForm, zOptText } from "@/lib/forms";
import { CORPORATE_STATUSES } from "@/lib/corporate";
import type { FormState } from "@/components/admin/form";

export async function updateCorporate(id: number, _: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  const parsed = parseForm(z.object({ status: z.enum(CORPORATE_STATUSES), notes: zOptText(4000) }), data);
  if ("error" in parsed) return parsed.error;
  await db.corporateRequest.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/corporate");
  return { ok: true, message: `Request #${id} saved.` };
}
