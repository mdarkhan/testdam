import "server-only";
// Bulk import of prices collected by hand from labs' own public websites (src/lib/web-import/data.json),
// and a one-click way to remove all of it again. Every row it writes carries `importBatch`, and nothing
// a person entered or confirmed is ever overwritten or deleted:
// - an existing price without importBatch (typed in the grid, CSV, or verified) is skipped on import;
// - a hand save or "verify" clears importBatch on that row (src/lib/price-writes.ts), so removal keeps it;
// - a lab is deleted on removal only if no price and no booking is left on it.
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { AREAS, NEIGHBORS, TESTS } from "../bootstrap";
import { aliasRows } from "../normalize";
import { invalidateCatalog } from "../catalog";
import data from "./data.json";

export type WebLab = (typeof data.labs)[number];
export const WEB_DATA = data;
export const WEB_BATCH = data.batch;

/** Noon in Dhaka on the collection day — the day the price was read off the lab's website. */
const collectedAt = new Date(`${data.collectedOn}T06:00:00Z`);

function revalidateEverything() {
  invalidateCatalog();
  revalidatePath("/", "layout");
}

/** Creates the areas/tests the dataset refers to when missing. Never changes existing catalogue rows. */
async function ensureCatalog() {
  const neededAreas = new Set(data.labs.map((l) => l.area));
  const neededTests = new Set(data.prices.map((p) => p.test));
  const haveAreas = new Set((await db.area.findMany({ select: { slug: true } })).map((a) => a.slug));
  const haveTests = new Set((await db.test.findMany({ select: { slug: true } })).map((t) => t.slug));
  const newAreas: string[] = [];

  for (const [slug, nameEn, nameBn, aliases] of AREAS) {
    if (!neededAreas.has(slug) || haveAreas.has(slug)) continue;
    await db.area.create({ data: { slug, nameEn, nameBn, aliases } });
    haveAreas.add(slug);
    newAreas.push(slug);
  }
  for (const [a, b] of NEIGHBORS) {
    if (!newAreas.includes(a) && !newAreas.includes(b)) continue;
    if (!haveAreas.has(a) || !haveAreas.has(b)) continue;
    await db.area.update({ where: { slug: a }, data: { neighbors: { connect: { slug: b } }, neighborOf: { connect: { slug: b } } } });
  }
  for (const t of TESTS) {
    if (!neededTests.has(t.slug) || haveTests.has(t.slug)) continue;
    await db.test.create({
      data: {
        slug: t.slug, nameEn: t.en, nameBn: t.bn, shortName: t.short ?? null, category: t.cat, sampleType: t.sample ?? null,
        aliases: { create: aliasRows([t.en, t.bn, t.short, ...t.aliases]) },
      },
    });
  }
  const missingArea = [...neededAreas].find((s) => !haveAreas.has(s));
  if (missingArea) throw new Error(`Area "${missingArea}" is not in the catalogue`);
}

export async function importWebData() {
  await ensureCatalog();
  const areas = new Map((await db.area.findMany({ select: { id: true, slug: true } })).map((a) => [a.slug, a.id]));
  const tests = new Map((await db.test.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]));
  const sourceUrl = new Map(data.labs.map((l) => [l.slug, l.sourceUrl]));

  // Labs: create the missing ones (tagged). An existing lab with the same slug is reused as it is.
  const labIds = new Map<string, number>();
  let labsCreated = 0;
  for (const l of data.labs) {
    const found = await db.lab.findUnique({ where: { slug: l.slug }, select: { id: true } });
    if (found) { labIds.set(l.slug, found.id); continue; }
    const lab = await db.lab.create({
      data: {
        slug: l.slug, name: l.name, nameBn: l.nameBn, branchName: l.branchName, areaId: areas.get(l.area)!,
        address: l.address, phone: l.phone, importBatch: WEB_BATCH,
      },
    });
    labIds.set(l.slug, lab.id);
    labsCreated++;
  }

  const existing = await db.labTestPrice.findMany({
    where: { labId: { in: [...labIds.values()] } },
    select: { id: true, labId: true, testId: true, importBatch: true, regularPrice: true },
  });
  const byKey = new Map(existing.map((p) => [`${p.labId}:${p.testId}`, p]));
  let created = 0, updated = 0, keptHandEntered = 0;

  await db.$transaction(async (tx) => {
    for (const p of data.prices) {
      const labId = labIds.get(p.lab)!;
      const testId = tests.get(p.test)!;
      const before = byKey.get(`${labId}:${testId}`);
      if (before && before.importBatch == null) { keptHandEntered++; continue; } // a person's price wins
      const row = {
        regularPrice: p.price, discountPrice: null, discountExpiresAt: null, source: "WEBSITE" as const,
        sourceNote: `Lab website ${sourceUrl.get(p.lab)} ("${p.sourceName}"), read on ${data.collectedOn}. Not confirmed by phone.`,
        verifiedAt: collectedAt, verifiedById: null, importBatch: WEB_BATCH,
      };
      if (before) {
        await tx.labTestPrice.update({ where: { id: before.id }, data: row });
        updated++;
        if (before.regularPrice === p.price) continue;
      } else {
        await tx.labTestPrice.create({ data: { labId, testId, ...row } });
        created++;
      }
      await tx.priceHistory.create({
        data: { labId, testId, change: before ? "UPDATED" : "CREATED", regularPrice: p.price, source: "WEBSITE", importBatch: WEB_BATCH },
      });
    }
  }, { timeout: 60_000 });

  revalidateEverything();
  return { labsCreated, created, updated, keptHandEntered };
}

export async function removeWebData() {
  const tagged = await db.labTestPrice.findMany({ where: { importBatch: { not: null } }, select: { id: true } });
  const [prices, history] = await db.$transaction([
    db.labTestPrice.deleteMany({ where: { id: { in: tagged.map((p) => p.id) } } }),
    db.priceHistory.deleteMany({ where: { importBatch: { not: null } } }),
  ]);

  // Imported labs go too, unless a person added a price or a patient booked there.
  const labs = await db.lab.findMany({
    where: { importBatch: { not: null } },
    select: { id: true, name: true, branchName: true, _count: { select: { prices: true, bookings: true } } },
  });
  const removable = labs.filter((l) => l._count.prices === 0 && l._count.bookings === 0);
  const kept = labs.filter((l) => !removable.includes(l));
  await db.lab.deleteMany({ where: { id: { in: removable.map((l) => l.id) } } });
  // Kept labs become ordinary labs: the next removal will not touch them.
  if (kept.length) await db.lab.updateMany({ where: { id: { in: kept.map((l) => l.id) } }, data: { importBatch: null } });

  revalidateEverything();
  return {
    prices: prices.count, history: history.count, labsRemoved: removable.length,
    labsKept: kept.map((l) => `${l.name}${l.branchName ? ` (${l.branchName})` : ""}: ${l._count.prices} price(s), ${l._count.bookings} booking(s)`),
  };
}

export async function webDataStatus() {
  const [prices, labs, handConfirmed] = await Promise.all([
    db.labTestPrice.count({ where: { importBatch: { not: null } } }),
    db.lab.count({ where: { importBatch: { not: null } } }),
    db.labTestPrice.count({ where: { importBatch: null, lab: { importBatch: { not: null } } } }),
  ]);
  return { prices, labs, handConfirmed };
}
