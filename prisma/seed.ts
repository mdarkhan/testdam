// Seed: 20 real Dhaka areas, ~40 common tests with aliases, and CLEARLY FAKE labs and prices.
// - No real lab names, no real prices, no real phone numbers (phones are 000-… placeholders).
// - No medical descriptions or preparation notes: those stay null with DRAFT_NEEDS_REVIEW.
// - Idempotent: re-running updates areas/tests/aliases/labs; demo prices are only created for labs that have none yet.
// Run: npm run db:seed
import "dotenv/config";
import { db } from "../src/lib/db";
import { bnDigits } from "../src/lib/format";
import { AREAS, TESTS, ensureFirstAdmin, upsertCatalog } from "../src/lib/bootstrap";
import type { PriceSource } from "../src/generated/prisma/client";

// Deterministic pseudo-random so re-seeding a fresh DB gives the same demo data.
let state = 42;
const rand = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)] as T;

// Arbitrary demo base prices (NOT real market prices) — just spread so ranking has something to sort.
const demoBase = (i: number) => 200 + ((i * 137) % 23) * 150;
const SOURCES: PriceSource[] = ["PHONE_CALL", "PRICE_LIST", "WEBSITE", "LAB_SUBMITTED", "VISIT"];
const DAY = 86_400_000;

async function main() {
  await upsertCatalog();

  // Demo labs: 2 per area for the first 10 areas, 1 for the rest → 30 labs
  const areas = await db.area.findMany({ orderBy: { id: "asc" } });
  let n = 0;
  for (const [i, area] of areas.entries()) {
    const count = i < 10 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      n++;
      const slug = `demo-lab-${n}-${area.slug}`;
      const data = {
        name: `Demo Lab ${n}`,
        nameBn: `ডেমো ল্যাব ${bnDigits(n)}`,
        branchName: `${area.nameEn} branch`,
        areaId: area.id,
        address: `House ${n}, Demo Road, ${area.nameEn}, Dhaka (demo address)`,
        phone: `000-0000-${String(n).padStart(4, "0")}`, // deliberately not a real number
        whatsapp: null,
        openingHours: "প্রতিদিন সকাল ৮টা – রাত ১০টা (ডেমো)",
        homeCollection: n % 3 !== 0,
        homeCollectionFee: n % 3 !== 0 ? (n % 2 ? 0 : 200) : null,
        isFeatured: n === 2, // one featured lab to test "badge never changes sort order"
      };
      await db.lab.upsert({ where: { slug }, create: { slug, ...data }, update: data });
    }
  }

  // Demo prices: each lab offers ~70% of tests; ~20% of prices are stale (91–200 days old)
  // Only the seed's own demo labs ever get fake prices — never labs entered by an admin.
  const labs = (await db.lab.findMany({ orderBy: { id: "asc" } })).filter((l) => /^Demo Lab \d+$/.test(l.name) && /^demo-lab-\d+-/.test(l.slug));
  const tests = await db.test.findMany({ orderBy: { id: "asc" } });
  const labsWithPrices = new Set((await db.labTestPrice.findMany({ select: { labId: true }, distinct: ["labId"] })).map((p) => p.labId));
  const now = Date.now();
  let created = 0;
  for (const lab of labs) {
    if (labsWithPrices.has(lab.id)) continue; // never touch prices of a lab that already has some
    for (const [ti, test] of tests.entries()) {
      const r = rand();
      if (r > 0.7) continue;
      const regular = Math.round((demoBase(ti) * (0.7 + rand() * 0.8)) / 10) * 10;
      const hasDiscount = rand() < 0.2;
      const stale = rand() < 0.2;
      const verifiedAt = new Date(now - (stale ? 91 + Math.floor(rand() * 110) : Math.floor(rand() * 80)) * DAY);
      const discountPrice = hasDiscount ? Math.round((regular * 0.85) / 10) * 10 : null;
      const source = pick(SOURCES);
      const discountExpiresAt = hasDiscount && rand() < 0.5 ? new Date(now + Math.floor(rand() * 60 - 15) * DAY) : null;
      await db.$transaction([
        db.labTestPrice.create({
          data: {
            labId: lab.id, testId: test.id, regularPrice: regular, discountPrice, discountExpiresAt,
            reportHours: pick([4, 6, 12, 24, 24, 48, 72]),
            homeCollection: lab.homeCollection && test.category !== "IMAGING" && test.category !== "CARDIAC",
            source, sourceNote: "Demo data", verifiedAt,
          },
        }),
        db.priceHistory.create({ data: { labId: lab.id, testId: test.id, change: "CREATED", regularPrice: regular, discountPrice, discountExpiresAt, source, changedAt: verifiedAt } }),
      ]);
      created++;
    }
  }

  await ensureFirstAdmin();

  console.log(`Seeded ${AREAS.length} areas, ${TESTS.length} tests, ${labs.length} demo labs, ${created} new demo prices.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
