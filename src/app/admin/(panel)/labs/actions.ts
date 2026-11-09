"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseForm, uniqueError, zCheckbox, zOptInt, zOptText, zSlug, zText } from "@/lib/forms";
import { slugify } from "@/lib/normalize";
import { normalizeBdMobile, normalizeLabPhone } from "@/lib/phone";
import { revalidateLab } from "@/lib/revalidate";
import type { FormState } from "@/components/admin/form";

const schema = z.object({
  name: zText("Lab name"),
  nameBn: zOptText(200),
  branchName: zOptText(200),
  slug: zSlug,
  areaId: z.coerce.number({ error: "Pick an area" }).int().positive("Pick an area"),
  address: zText("Address", 500),
  phone: zText("Phone", 40).transform((v, ctx) => normalizeLabPhone(v) ?? (ctx.addIssue({ code: "custom", message: "Enter a valid phone number" }), z.NEVER)),
  whatsapp: z.string().trim().optional().transform((v, ctx) => {
    if (!v) return null;
    return normalizeBdMobile(v) ?? (ctx.addIssue({ code: "custom", message: "WhatsApp must be a Bangladeshi mobile number (01XXXXXXXXX)" }), z.NEVER);
  }),
  openingHours: zOptText(200),
  mapUrl: zOptText(1000).refine((v) => !v || /^https:\/\//.test(v), "Map link must start with https://"),
  homeCollection: zCheckbox,
  homeCollectionFee: zOptInt("Home collection fee"),
  isFeatured: zCheckbox,
  isActive: zCheckbox,
});

export async function saveLab(id: number | null, _: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseForm(schema, data);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;
  const before = id ? await db.lab.findUnique({ where: { id }, select: { isFeatured: true, area: { select: { slug: true } } } }) : null;
  if (user.role !== "ADMIN") d.isFeatured = before?.isFeatured ?? false; // featured listings are an ADMIN decision
  let slug = d.slug;
  if (!slug) {
    const area = await db.area.findUnique({ where: { id: d.areaId }, select: { slug: true } });
    slug = slugify(`${d.name} ${d.branchName ?? area?.slug ?? ""}`);
  }
  let labId: number;
  try {
    const lab = id ? await db.lab.update({ where: { id }, data: { ...d, slug } }) : await db.lab.create({ data: { ...d, slug } });
    labId = lab.id;
  } catch (e) {
    if (!uniqueError(e, "slug", "")) console.error("[admin] save failed", e);
    return uniqueError(e, "slug", "Another lab already uses this slug.") ?? { message: "Could not save the lab." };
  }
  await revalidateLab(labId, before?.area.slug);
  revalidatePath("/admin/labs");
  redirect(id ? "/admin/labs" : `/admin/labs/${labId}/prices`);
}

export async function deleteLab(id: number): Promise<FormState> {
  await requireUser("ADMIN");
  const [prices, bookings] = await Promise.all([db.labTestPrice.count({ where: { labId: id } }), db.bookingRequest.count({ where: { labId: id } })]);
  if (prices || bookings) return { message: `This lab has ${prices} price(s) and ${bookings} booking(s). Untick “Active” to hide it instead.` };
  await revalidateLab(id);
  await db.lab.delete({ where: { id } });
  revalidatePath("/admin/labs");
  redirect("/admin/labs");
}
