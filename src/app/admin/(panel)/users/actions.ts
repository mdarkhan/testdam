"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseForm, uniqueError, zText } from "@/lib/forms";
import { createUser, setPassword } from "@/lib/users";
import type { FormState } from "@/components/admin/form";

const password = z.string().min(10, "Password must be at least 10 characters").max(200);
const role = z.enum(["ADMIN", "DATA_ENTRY"]);

export async function addUser(_: FormState, data: FormData): Promise<FormState> {
  await requireUser("ADMIN");
  const parsed = parseForm(z.object({ name: zText("Name"), email: z.email("Enter a valid email"), role, password }), data);
  if ("error" in parsed) return parsed.error;
  try {
    await createUser(parsed.data);
  } catch (e) {
    if (!uniqueError(e, "email", "")) console.error("[admin] save failed", e);
    return uniqueError(e, "email", "A user with this email already exists.") ?? { message: "Could not create the user." };
  }
  revalidatePath("/admin/users");
  return { ok: true, message: `Created ${parsed.data.email}. Share the password with them privately.` };
}

export async function updateUser(userId: string, _: FormState, data: FormData): Promise<FormState> {
  const me = await requireUser("ADMIN");
  const parsed = parseForm(z.object({ role, password: z.union([z.literal(""), password]).optional() }), data);
  if ("error" in parsed) return parsed.error;
  if (userId === me.id && parsed.data.role !== "ADMIN") return { message: "You cannot remove your own ADMIN role." };
  await db.user.update({ where: { id: userId }, data: { role: parsed.data.role } });
  if (parsed.data.password) await setPassword(userId, parsed.data.password);
  revalidatePath("/admin/users");
  return { ok: true, message: parsed.data.password ? "Saved. Password changed and the user was signed out everywhere." : "Saved." };
}
