// Seed: 20 real Dhaka areas, ~40 common tests with aliases, and CLEARLY FAKE labs and prices.
// - No real lab names, no real prices, no real phone numbers (phones are 000-… placeholders).
// - No medical descriptions or preparation notes: those stay null with DRAFT_NEEDS_REVIEW.
// - Idempotent: re-running updates areas/tests/aliases/labs; demo prices are only created for labs that have none yet.
// Run: npm run db:seed
import "dotenv/config";
import { db } from "../src/lib/db";
import { aliasRows } from "../src/lib/normalize";
import { bnDigits } from "../src/lib/format";
import { createUser } from "../src/lib/users";
import type { PriceSource, TestCategory } from "../src/generated/prisma/client";

const AREAS: Array<[slug: string, en: string, bn: string, aliases: string[]]> = [
  ["mirpur", "Mirpur", "মিরপুর", ["mirpur 10", "mirpur 1", "মীরপুর"]],
  ["dhanmondi", "Dhanmondi", "ধানমন্ডি", ["dhanmondi 27", "ধানমণ্ডি"]],
  ["mohammadpur", "Mohammadpur", "মোহাম্মদপুর", ["mohammedpur"]],
  ["uttara", "Uttara", "উত্তরা", []],
  ["gulshan", "Gulshan", "গুলশান", []],
  ["banani", "Banani", "বনানী", []],
  ["badda", "Badda", "বাড্ডা", []],
  ["rampura", "Rampura", "রামপুরা", []],
  ["motijheel", "Motijheel", "মতিঝিল", []],
  ["shantinagar", "Shantinagar", "শান্তিনগর", []],
  ["malibagh", "Malibagh", "মালিবাগ", []],
  ["farmgate", "Farmgate", "ফার্মগেট", []],
  ["tejgaon", "Tejgaon", "তেজগাঁও", []],
  ["mohakhali", "Mohakhali", "মহাখালী", []],
  ["bashundhara", "Bashundhara", "বসুন্ধরা", ["bashundhara ra"]],
  ["khilgaon", "Khilgaon", "খিলগাঁও", []],
  ["jatrabari", "Jatrabari", "যাত্রাবাড়ী", []],
  ["shyamoli", "Shyamoli", "শ্যামলী", []],
  ["wari", "Wari", "ওয়ারী", []],
  ["lalbagh", "Lalbagh", "লালবাগ", []],
];

const NEIGHBORS: Array<[string, string]> = [
  ["mirpur", "shyamoli"], ["shyamoli", "mohammadpur"], ["mohammadpur", "dhanmondi"], ["dhanmondi", "lalbagh"],
  ["dhanmondi", "farmgate"], ["farmgate", "tejgaon"], ["tejgaon", "mohakhali"], ["mohakhali", "gulshan"],
  ["mohakhali", "banani"], ["gulshan", "banani"], ["gulshan", "badda"], ["badda", "rampura"], ["badda", "bashundhara"],
  ["bashundhara", "uttara"], ["rampura", "malibagh"], ["rampura", "khilgaon"], ["malibagh", "shantinagar"],
  ["malibagh", "khilgaon"], ["shantinagar", "motijheel"], ["motijheel", "wari"], ["wari", "jatrabari"],
  ["wari", "lalbagh"], ["khilgaon", "jatrabari"], ["farmgate", "shantinagar"],
];

type TestSeed = { slug: string; en: string; bn: string; short?: string; cat: TestCategory; sample?: string; aliases: string[]; popular?: number };

// Names and search aliases only. sampleType is set only where it is unambiguous; owner to review.
const TESTS: TestSeed[] = [
  { slug: "cbc", en: "Complete Blood Count", bn: "কমপ্লিট ব্লাড কাউন্ট", short: "CBC", cat: "BLOOD", sample: "Blood", popular: 1, aliases: ["সিবিসি", "complete blood count", "complet blood count", "blood count", "cbc with esr", "সিবিসি টেস্ট"] },
  { slug: "esr", en: "Erythrocyte Sedimentation Rate", bn: "ইএসআর", short: "ESR", cat: "BLOOD", sample: "Blood", aliases: ["esr", "ই এস আর"] },
  { slug: "hemoglobin", en: "Hemoglobin", bn: "হিমোগ্লোবিন", short: "Hb%", cat: "BLOOD", sample: "Blood", aliases: ["hb", "haemoglobin", "hemoglobin", "হিমোগ্লোবিন"] },
  { slug: "blood-grouping", en: "Blood Grouping & Rh Typing", bn: "ব্লাড গ্রুপিং", cat: "BLOOD", sample: "Blood", popular: 8, aliases: ["blood group", "blood grouping", "ব্লাড গ্রুপ", "রক্তের গ্রুপ"] },
  { slug: "pt-inr", en: "Prothrombin Time", bn: "প্রোথ্রোম্বিন টাইম", short: "PT/INR", cat: "BLOOD", sample: "Blood", aliases: ["pt", "inr", "pt inr", "prothrombin"] },
  { slug: "fbs", en: "Fasting Blood Sugar", bn: "ফাস্টিং ব্লাড সুগার", short: "FBS", cat: "BIOCHEMISTRY", sample: "Blood", popular: 3, aliases: ["fasting sugar", "sugar fasting", "fbs", "খালি পেটে সুগার", "ফাস্টিং সুগার"] },
  { slug: "rbs", en: "Random Blood Sugar", bn: "র\u200D্যান্ডম ব্লাড সুগার", short: "RBS", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["random sugar", "rbs", "blood sugar", "সুগার টেস্ট", "ডায়াবেটিস টেস্ট"] },
  { slug: "hba1c", en: "HbA1c", bn: "এইচবিএ১সি", short: "HbA1c", cat: "BIOCHEMISTRY", sample: "Blood", popular: 6, aliases: ["hba1c", "hb a1c", "glycated hemoglobin", "a1c"] },
  { slug: "lipid-profile", en: "Lipid Profile", bn: "লিপিড প্রোফাইল", cat: "BIOCHEMISTRY", sample: "Blood", popular: 2, aliases: ["lipid", "cholesterol test", "কোলেস্টেরল টেস্ট", "লিপিড"] },
  { slug: "serum-creatinine", en: "Serum Creatinine", bn: "সিরাম ক্রিয়েটিনিন", cat: "BIOCHEMISTRY", sample: "Blood", popular: 7, aliases: ["creatinine", "s creatinine", "ক্রিয়েটিনিন", "creatinin"] },
  { slug: "sgpt", en: "SGPT (ALT)", bn: "এসজিপিটি", short: "SGPT", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["alt", "sgpt", "এস জি পি টি"] },
  { slug: "sgot", en: "SGOT (AST)", bn: "এসজিওটি", short: "SGOT", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["ast", "sgot"] },
  { slug: "liver-function-test", en: "Liver Function Test", bn: "লিভার ফাংশন টেস্ট", short: "LFT", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["lft", "liver test", "লিভার টেস্ট"] },
  { slug: "kidney-function-test", en: "Kidney Function Test", bn: "কিডনি ফাংশন টেস্ট", short: "KFT", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["kft", "rft", "renal function test", "কিডনি টেস্ট"] },
  { slug: "uric-acid", en: "Serum Uric Acid", bn: "ইউরিক এসিড", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["uric acid", "ইউরিক অ্যাসিড"] },
  { slug: "serum-electrolytes", en: "Serum Electrolytes", bn: "সিরাম ইলেক্ট্রোলাইট", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["electrolytes", "electrolyte", "na k cl"] },
  { slug: "ferritin", en: "Serum Ferritin", bn: "ফেরিটিন", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["ferritin", "s ferritin"] },
  { slug: "crp", en: "C-Reactive Protein", bn: "সিআরপি", short: "CRP", cat: "SEROLOGY", sample: "Blood", aliases: ["crp", "c reactive protein"] },
  { slug: "tsh", en: "Thyroid Stimulating Hormone", bn: "টিএসএইচ", short: "TSH", cat: "HORMONE", sample: "Blood", popular: 5, aliases: ["tsh", "thyroid test", "থাইরয়েড টেস্ট"] },
  { slug: "thyroid-profile", en: "Thyroid Profile (T3, T4, TSH)", bn: "থাইরয়েড প্রোফাইল", cat: "HORMONE", sample: "Blood", aliases: ["thyroid profile", "t3 t4 tsh", "থাইরয়েড প্রোফাইল"] },
  { slug: "ft4", en: "Free T4", bn: "ফ্রি টি৪", short: "FT4", cat: "HORMONE", sample: "Blood", aliases: ["ft4", "free t4", "t4"] },
  { slug: "prolactin", en: "Serum Prolactin", bn: "প্রোল্যাক্টিন", cat: "HORMONE", sample: "Blood", aliases: ["prolactin"] },
  { slug: "beta-hcg", en: "Serum Beta hCG", bn: "বিটা এইচসিজি", cat: "HORMONE", sample: "Blood", aliases: ["beta hcg", "b hcg", "hcg"] },
  { slug: "vitamin-d", en: "Vitamin D (25-OH)", bn: "ভিটামিন ডি", cat: "BIOCHEMISTRY", sample: "Blood", popular: 9, aliases: ["vitamin d", "vit d", "25 oh vitamin d", "ভিটামিন ডি৩"] },
  { slug: "vitamin-b12", en: "Vitamin B12", bn: "ভিটামিন বি১২", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["b12", "vit b12", "vitamin b 12"] },
  { slug: "psa", en: "Prostate Specific Antigen", bn: "পিএসএ", short: "PSA", cat: "OTHER", sample: "Blood", aliases: ["psa", "total psa"] },
  { slug: "hbsag", en: "HBsAg", bn: "এইচবিএসএজি", short: "HBsAg", cat: "SEROLOGY", sample: "Blood", aliases: ["hbsag", "hepatitis b test", "হেপাটাইটিস বি টেস্ট"] },
  { slug: "dengue-ns1", en: "Dengue NS1 Antigen", bn: "ডেঙ্গু এনএস১", cat: "SEROLOGY", sample: "Blood", popular: 4, aliases: ["dengue test", "ns1", "dengue ns1", "ডেঙ্গু টেস্ট", "ডেঙ্গু পরীক্ষা"] },
  { slug: "dengue-igg-igm", en: "Dengue IgG/IgM", bn: "ডেঙ্গু আইজিজি/আইজিএম", cat: "SEROLOGY", sample: "Blood", aliases: ["dengue antibody", "dengue igg", "dengue igm"] },
  { slug: "widal", en: "Widal Test", bn: "ভিডাল টেস্ট", cat: "SEROLOGY", sample: "Blood", aliases: ["widal", "typhoid test", "টাইফয়েড টেস্ট", "উইডাল"] },
  { slug: "urine-re", en: "Urine Routine Examination", bn: "ইউরিন আর/ই", short: "Urine R/E", cat: "URINE", sample: "Urine", popular: 10, aliases: ["urine re", "urine r e", "urine routine", "urine test", "প্রস্রাব পরীক্ষা", "ইউরিন টেস্ট"] },
  { slug: "urine-culture", en: "Urine Culture & Sensitivity", bn: "ইউরিন কালচার", cat: "MICROBIOLOGY", sample: "Urine", aliases: ["urine culture", "urine c s", "ইউরিন কালচার"] },
  { slug: "stool-re", en: "Stool Routine Examination", bn: "স্টুল আর/ই", short: "Stool R/E", cat: "STOOL", sample: "Stool", aliases: ["stool re", "stool test", "পায়খানা পরীক্ষা"] },
  { slug: "ecg", en: "Electrocardiogram", bn: "ইসিজি", short: "ECG", cat: "CARDIAC", popular: 11, aliases: ["ecg", "ekg", "ই সি জি"] },
  { slug: "echocardiogram", en: "Echocardiogram", bn: "ইকোকার্ডিওগ্রাম", cat: "CARDIAC", aliases: ["echo", "color doppler echo", "ইকো", "echo cardiogram"] },
  { slug: "ett", en: "Exercise Tolerance Test", bn: "ইটিটি", short: "ETT", cat: "CARDIAC", aliases: ["ett", "stress test", "treadmill test"] },
  { slug: "chest-xray", en: "X-Ray Chest PA View", bn: "এক্স-রে চেস্ট", cat: "IMAGING", popular: 12, aliases: ["chest x ray", "x ray chest", "xray", "xray chest", "chest xray", "cxr", "বুকের এক্সরে", "এক্সরে"] },
  { slug: "usg-whole-abdomen", en: "Ultrasonography Whole Abdomen", bn: "আল্ট্রাসনোগ্রাম (হোল অ্যাবডোমেন)", cat: "IMAGING", popular: 13, aliases: ["usg", "ultrasound abdomen", "usg whole abdomen", "আলট্রাসনো", "আল্ট্রাসাউন্ড"] },
  { slug: "usg-pregnancy", en: "Ultrasonography Pregnancy Profile", bn: "আল্ট্রাসনোগ্রাম (প্রেগন্যান্সি)", cat: "IMAGING", aliases: ["pregnancy ultrasound", "usg pregnancy", "প্রেগন্যান্সি আলট্রাসনো"] },
  { slug: "ct-scan-brain", en: "CT Scan Brain", bn: "সিটি স্ক্যান (ব্রেইন)", cat: "IMAGING", aliases: ["ct brain", "ct scan head", "সিটি স্ক্যান"] },
  { slug: "mri-brain", en: "MRI Brain", bn: "এমআরআই (ব্রেইন)", cat: "IMAGING", aliases: ["mri brain", "mri head", "এমআরআই"] },
];

// Deterministic pseudo-random so re-seeding a fresh DB gives the same demo data.
let state = 42;
const rand = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)] as T;

// Arbitrary demo base prices (NOT real market prices) — just spread so ranking has something to sort.
const demoBase = (i: number) => 200 + ((i * 137) % 23) * 150;
const SOURCES: PriceSource[] = ["PHONE_CALL", "PRICE_LIST", "WEBSITE", "LAB_SUBMITTED", "VISIT"];
const DAY = 86_400_000;

async function main() {
  // Areas
  for (const [slug, nameEn, nameBn, aliases] of AREAS) {
    await db.area.upsert({ where: { slug }, create: { slug, nameEn, nameBn, aliases }, update: { nameEn, nameBn, aliases } });
  }
  for (const [a, b] of NEIGHBORS) {
    await db.area.update({ where: { slug: a }, data: { neighbors: { connect: { slug: b } }, neighborOf: { connect: { slug: b } } } });
  }

  // Tests + aliases (names become aliases too)
  for (const t of TESTS) {
    const data = { nameEn: t.en, nameBn: t.bn, shortName: t.short ?? null, category: t.cat, sampleType: t.sample ?? null, popularRank: t.popular ?? null };
    const test = await db.test.upsert({ where: { slug: t.slug }, create: { slug: t.slug, ...data }, update: data });
    for (const row of aliasRows([t.en, t.bn, t.short, ...t.aliases])) {
      await db.testAlias.upsert({
        where: { testId_searchKey: { testId: test.id, searchKey: row.searchKey } },
        create: { testId: test.id, ...row },
        update: {},
      });
    }
  }

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

  // First admin
  if ((await db.user.count()) === 0) {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password || password.length < 10) {
      console.warn("No users exist and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (10+ chars) are not set — skipping admin user.");
    } else {
      await createUser({ name: "Admin", email, password, role: "ADMIN" });
      console.log(`Created ADMIN user ${email}`);
    }
  }

  console.log(`Seeded ${AREAS.length} areas, ${TESTS.length} tests, ${labs.length} demo labs, ${created} new demo prices.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
