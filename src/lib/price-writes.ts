import "server-only";
// All writes to LabTestPrice go through here, so PriceHistory and revalidation are never forgotten.
import { db } from "./db";
import { isPriceChange, type PriceInput } from "./csv";
import { revalidatePrices } from "./revalidate";

export type PriceWrite = { labId: number; testId: number; data: PriceInput };

/** Upserts prices. Writes a PriceHistory row when a price field changed (not for verify-only updates). */
export async function upsertPrices(writes: PriceWrite[], userId: string) {
  if (!writes.length) return { created: 0, changed: 0, verified: 0 };
  const existing = await db.labTestPrice.findMany({
    where: { OR: writes.map((w) => ({ labId: w.labId, testId: w.testId })) },
  });
  const byKey = new Map(existing.map((p) => [`${p.labId}:${p.testId}`, p]));
  let created = 0, changed = 0, verified = 0;

  await db.$transaction(async (tx) => {
    for (const w of writes) {
      const before = byKey.get(`${w.labId}:${w.testId}`);
      const data = { ...w.data, verifiedById: userId };
      if (!before) {
        await tx.labTestPrice.create({ data: { labId: w.labId, testId: w.testId, ...data } });
        created++;
      } else {
        await tx.labTestPrice.update({ where: { id: before.id }, data });
        if (isPriceChange(before, w.data)) changed++;
        else verified++;
      }
      if (!before || isPriceChange(before, w.data)) {
        await tx.priceHistory.create({
          data: {
            labId: w.labId, testId: w.testId, change: before ? "UPDATED" : "CREATED",
            regularPrice: w.data.regularPrice, discountPrice: w.data.discountPrice, discountExpiresAt: w.data.discountExpiresAt,
            source: w.data.source, changedById: userId,
          },
        });
      }
    }
  }, { timeout: 30_000 });

  await revalidateByLab(writes.map((w) => [w.labId, w.testId]));
  return { created, changed, verified };
}

export async function deletePrices(labId: number, testIds: number[], userId: string) {
  if (!testIds.length) return 0;
  const rows = await db.labTestPrice.findMany({ where: { labId, testId: { in: testIds } } });
  await db.$transaction([
    db.labTestPrice.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } }),
    db.priceHistory.createMany({
      data: rows.map((r) => ({ labId, testId: r.testId, change: "DELETED" as const, regularPrice: r.regularPrice, discountPrice: r.discountPrice, discountExpiresAt: r.discountExpiresAt, source: r.source, changedById: userId })),
    }),
  ]);
  await revalidatePrices(labId, rows.map((r) => r.testId));
  return rows.length;
}

/** "Mark verified today": refreshes verifiedAt only; price and source stay unless a source is given. */
export async function verifyPrices(labId: number, testIds: number[], userId: string, source?: PriceInput["source"]) {
  if (!testIds.length) return 0;
  const r = await db.labTestPrice.updateMany({
    where: { labId, testId: { in: testIds } },
    data: { verifiedAt: new Date(), verifiedById: userId, ...(source && { source }) },
  });
  await revalidatePrices(labId, testIds);
  return r.count;
}

async function revalidateByLab(pairs: Array<[number, number]>) {
  const byLab = new Map<number, number[]>();
  for (const [labId, testId] of pairs) byLab.set(labId, [...(byLab.get(labId) ?? []), testId]);
  for (const [labId, testIds] of byLab) await revalidatePrices(labId, testIds);
}
