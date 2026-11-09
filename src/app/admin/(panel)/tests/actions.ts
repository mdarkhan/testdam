"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseForm, uniqueError, zOptInt, zOptText, zSlug, zText } from "@/lib/forms";
import { aliasRows, slugify } from "@/lib/normalize";
import { revalidateTest } from "@/lib/revalidate";
import { TestCategory, type ContentStatus } from "@/generated/prisma/enums";
import type { FormState } from "@/components/admin/form";

const schema = z.object({
  nameEn: zText("English name"),
  nameBn: zText("Bangla name"),
  shortName: zOptText(40),
  slug: zSlug,
  category: z.enum(Object.values(TestCategory) as [TestCategory, ...TestCategory[]], { error: "Pick a category" }),
  sampleType: zOptText(60),
  popularRank: zOptInt("Popular rank"),
  aliases: z.string().optional().transform((v) => (v ?? "").split(/\n/).map((s) => s.trim()).filter(Boolean)),
  description: zOptText(4000),
  preparationNote: zOptText(2000),
  contentStatus: z.enum(["DRAFT_NEEDS_REVIEW", "REVIEWED"]).optional(),
});

export async function saveTest(id: number | null, _: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseForm(schema, data);
  if ("error" in parsed) return parsed.error;
  const { aliases, contentStatus: requested, ...d } = parsed.data;
  const slug = d.slug || slugify(d.shortName ?? d.nameEn);
  const before = id ? await db.test.findUnique({ where: { id } }) : null;

  // Medical content rule: only an ADMIN can mark text REVIEWED; any text edit by anyone else
  // (or with "needs review" chosen) puts it back to DRAFT_NEEDS_REVIEW.
  const textChanged = !before || before.description !== d.description || before.preparationNote !== d.preparationNote;
  let contentStatus: ContentStatus = before?.contentStatus ?? "DRAFT_NEEDS_REVIEW";
  if (user.role === "ADMIN" && requested) contentStatus = requested;
  else if (textChanged) contentStatus = "DRAFT_NEEDS_REVIEW";
  const review = contentStatus === "REVIEWED" && (before?.contentStatus !== "REVIEWED" || textChanged)
    ? { reviewedAt: new Date(), reviewedById: user.id }
    : contentStatus === "DRAFT_NEEDS_REVIEW" ? { reviewedAt: null, reviewedById: null } : {};

  const rows = aliasRows([d.nameEn, d.nameBn, d.shortName, ...aliases]);
  try {
    const test = await db.$transaction(async (tx) => {
      const t = id
        ? await tx.test.update({ where: { id }, data: { ...d, slug, contentStatus, ...review } })
        : await tx.test.create({ data: { ...d, slug, contentStatus, ...review } });
      await tx.testAlias.deleteMany({ where: { testId: t.id } });
      await tx.testAlias.createMany({ data: rows.map((r) => ({ ...r, testId: t.id })) });
      return t;
    }, { timeout: 15_000 });
    revalidateTest(test.slug);
    if (before && before.slug !== test.slug) revalidateTest(before.slug);
  } catch (e) {
    if (!uniqueError(e, "slug", "")) console.error("[admin] save failed", e);
    return uniqueError(e, "slug", "Another test already uses this slug.") ?? { message: "Could not save the test." };
  }
  revalidatePath("/admin/tests");
  redirect("/admin/tests");
}

export async function deleteTest(id: number): Promise<FormState> {
  await requireUser("ADMIN");
  const [prices, bookings] = await Promise.all([db.labTestPrice.count({ where: { testId: id } }), db.bookingRequest.count({ where: { testId: id } })]);
  if (prices || bookings) return { message: `This test has ${prices} price(s) and ${bookings} booking(s), so it cannot be deleted.` };
  const t = await db.test.delete({ where: { id } });
  revalidateTest(t.slug);
  revalidatePath("/admin/tests");
  redirect("/admin/tests");
}
