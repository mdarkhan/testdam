"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseForm, uniqueError, zSlug, zText } from "@/lib/forms";
import { slugify } from "@/lib/normalize";
import { revalidateArea } from "@/lib/revalidate";
import type { FormState } from "@/components/admin/form";

const schema = z.object({
  nameEn: zText("English name"),
  nameBn: zText("Bangla name"),
  slug: zSlug,
  aliases: z.string().optional().transform((v) => (v ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean)),
  neighbors: z.union([z.string(), z.array(z.string())]).optional().transform((v) => [v ?? []].flat().map(Number)),
});

export async function saveArea(id: number | null, _: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  const parsed = parseForm(schema, data);
  if ("error" in parsed) return parsed.error;
  const { neighbors, ...d } = parsed.data;
  const slug = d.slug || slugify(d.nameEn);
  const neighborIds = neighbors.filter((n) => n !== id).map((n) => ({ id: n }));
  try {
    const before = id ? await db.area.findUnique({ where: { id }, select: { slug: true } }) : null;
    const area = id
      ? await db.area.update({ where: { id }, data: { ...d, slug, neighbors: { set: neighborIds }, neighborOf: { set: neighborIds } } })
      : await db.area.create({ data: { ...d, slug, neighbors: { connect: neighborIds }, neighborOf: { connect: neighborIds } } });
    revalidateArea(area.slug);
    if (before && before.slug !== area.slug) revalidateArea(before.slug);
  } catch (e) {
    if (!uniqueError(e, "slug", "")) console.error("[admin] save failed", e);
    return uniqueError(e, "slug", "Another area already uses this slug.") ?? { message: "Could not save the area." };
  }
  revalidatePath("/admin/areas");
  redirect("/admin/areas");
}

export async function deleteArea(id: number): Promise<FormState> {
  await requireUser("ADMIN");
  const labs = await db.lab.count({ where: { areaId: id } });
  if (labs) return { message: `This area has ${labs} lab(s). Move them to another area first.` };
  const area = await db.area.delete({ where: { id } });
  revalidateArea(area.slug);
  revalidatePath("/admin/areas");
  redirect("/admin/areas");
}
