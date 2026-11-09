"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parseSource, validatePrice, type PriceInput } from "@/lib/csv";
import { deletePrices, upsertPrices, verifyPrices } from "@/lib/price-writes";

export type GridRowInput = {
  testId: number;
  regularPrice: string;
  discountPrice: string;
  discountExpires: string;
  reportHours: string;
  homeCollection: boolean;
  source: string;
  sourceNote: string;
};

export type GridSaveResult = { ok: boolean; message: string; errors: Record<number, string[]> };

/** Saves edited grid rows. Every saved row counts as verified now (you just confirmed it). */
export async function saveGrid(labId: number, rows: GridRowInput[], deleteTestIds: number[]): Promise<GridSaveResult> {
  const user = await requireUser();
  const errors: Record<number, string[]> = {};
  const writes: Array<{ labId: number; testId: number; data: PriceInput }> = [];
  for (const r of rows) {
    const v = validatePrice({ ...r, homeCollection: r.homeCollection ? "yes" : "no" });
    if (v.ok) writes.push({ labId, testId: r.testId, data: v.data });
    else errors[r.testId] = v.errors;
  }
  if (Object.keys(errors).length) {
    return { ok: false, message: `${Object.keys(errors).length} row(s) have errors. Nothing was saved.`, errors };
  }
  const res = await upsertPrices(writes, user.id);
  const deleted = await deletePrices(labId, deleteTestIds, user.id);
  revalidatePath(`/admin/labs/${labId}/prices`);
  const parts = [`${res.created} added`, `${res.changed} changed`, `${res.verified} re-verified`];
  if (deleted) parts.push(`${deleted} removed`);
  return { ok: true, message: `Saved: ${parts.join(", ")}.`, errors: {} };
}

export async function bulkVerify(labId: number, testIds: number[], source: string): Promise<GridSaveResult> {
  const user = await requireUser();
  const s = source ? parseSource(source) : undefined;
  const n = await verifyPrices(labId, testIds, user.id, s ?? undefined);
  revalidatePath(`/admin/labs/${labId}/prices`);
  return { ok: true, message: `Marked ${n} price(s) verified today${s ? ` (source: ${s})` : ""}.`, errors: {} };
}
