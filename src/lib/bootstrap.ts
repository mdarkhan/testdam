// Reference data (real Dhaka areas, common test names + search aliases — NO labs, NO prices, NO medical text)
// and first-start bootstrap for an empty production database. The demo labs/prices live only in prisma/seed.ts.
import { db } from "./db";
import { aliasRows } from "./normalize";
import { verifyPassword } from "better-auth/crypto";
import { createUser, setPassword } from "./users";
import type { TestCategory } from "@/generated/prisma/client";

export const AREAS: Array<[slug: string, en: string, bn: string, aliases: string[]]> = [
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
  ["puran-dhaka", "Puran Dhaka", "পুরান ঢাকা", ["old dhaka", "english road", "nawabpur", "ইংলিশ রোড"]],
  ["shahbag", "Shahbag", "শাহবাগ", ["shahbagh", "pg hospital", "bsmmu", "bmu"]],
  ["sher-e-bangla-nagar", "Sher-e-Bangla Nagar", "শেরেবাংলা নগর", ["agargaon", "sher e bangla nagar", "আগারগাঁও"]],
];

export const NEIGHBORS: Array<[string, string]> = [
  ["mirpur", "shyamoli"], ["shyamoli", "mohammadpur"], ["mohammadpur", "dhanmondi"], ["dhanmondi", "lalbagh"],
  ["dhanmondi", "farmgate"], ["farmgate", "tejgaon"], ["tejgaon", "mohakhali"], ["mohakhali", "gulshan"],
  ["mohakhali", "banani"], ["gulshan", "banani"], ["gulshan", "badda"], ["badda", "rampura"], ["badda", "bashundhara"],
  ["bashundhara", "uttara"], ["rampura", "malibagh"], ["rampura", "khilgaon"], ["malibagh", "shantinagar"],
  ["malibagh", "khilgaon"], ["shantinagar", "motijheel"], ["motijheel", "wari"], ["wari", "jatrabari"],
  ["wari", "lalbagh"], ["khilgaon", "jatrabari"], ["farmgate", "shantinagar"],
  ["puran-dhaka", "wari"], ["puran-dhaka", "lalbagh"], ["puran-dhaka", "motijheel"],
  ["shahbag", "dhanmondi"], ["shahbag", "farmgate"], ["shahbag", "shantinagar"],
  ["sher-e-bangla-nagar", "shyamoli"], ["sher-e-bangla-nagar", "farmgate"], ["sher-e-bangla-nagar", "mirpur"],
];

export type TestSeed = { slug: string; en: string; bn: string; short?: string; cat: TestCategory; sample?: string; aliases: string[]; popular?: number };

// Names and search aliases only. sampleType is set only where it is unambiguous; owner to review.
export const TESTS: TestSeed[] = [
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
  // Added 2026-11-10 with the web-collected prices (names and search aliases only).
  { slug: "serum-bilirubin", en: "Serum Bilirubin (Total)", bn: "সিরাম বিলিরুবিন", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["bilirubin", "s bilirubin", "bilirubin total", "বিলিরুবিন", "জন্ডিস টেস্ট"] },
  { slug: "blood-urea", en: "Blood Urea", bn: "ব্লাড ইউরিয়া", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["urea", "serum urea", "ইউরিয়া"] },
  { slug: "t3", en: "Triiodothyronine (T3)", bn: "টি৩", short: "T3", cat: "HORMONE", sample: "Blood", aliases: ["t3", "total t3", "টি থ্রি"] },
  { slug: "t4", en: "Thyroxine (T4)", bn: "টি৪", short: "T4", cat: "HORMONE", sample: "Blood", aliases: ["total t4", "thyroxine", "টি ফোর"] },
  { slug: "ft3", en: "Free T3", bn: "ফ্রি টি৩", short: "FT3", cat: "HORMONE", sample: "Blood", aliases: ["ft3", "free t3"] },
  { slug: "fsh", en: "Follicle Stimulating Hormone", bn: "এফএসএইচ", short: "FSH", cat: "HORMONE", sample: "Blood", aliases: ["fsh", "s fsh"] },
  { slug: "lh", en: "Luteinizing Hormone", bn: "এলএইচ", short: "LH", cat: "HORMONE", sample: "Blood", aliases: ["lh", "s lh"] },
  { slug: "testosterone", en: "Serum Testosterone", bn: "টেস্টোস্টেরন", cat: "HORMONE", sample: "Blood", aliases: ["testosterone", "total testosterone"] },
  { slug: "anti-hcv", en: "Anti HCV", bn: "অ্যান্টি এইচসিভি", cat: "SEROLOGY", sample: "Blood", aliases: ["hcv", "anti hcv", "hepatitis c test", "হেপাটাইটিস সি টেস্ট"] },
  { slug: "hiv", en: "HIV 1 & 2 Antibody", bn: "এইচআইভি টেস্ট", cat: "SEROLOGY", sample: "Blood", aliases: ["hiv", "hiv test", "hiv 1 2", "aids test"] },
  { slug: "aso-titre", en: "ASO Titre", bn: "এএসও টাইটার", cat: "SEROLOGY", sample: "Blood", aliases: ["aso", "aso titer", "aso titre"] },
  { slug: "troponin-i", en: "Troponin I", bn: "ট্রপোনিন আই", cat: "CARDIAC", sample: "Blood", aliases: ["troponin", "trop i", "troponin i", "ট্রপোনিন"] },
  { slug: "malaria-parasite", en: "Malarial Parasite (MP)", bn: "ম্যালেরিয়া টেস্ট", short: "MP", cat: "BLOOD", sample: "Blood", aliases: ["mp", "malaria", "malaria test", "ম্যালেরিয়া"] },
  { slug: "platelet-count", en: "Platelet Count", bn: "প্লাটিলেট কাউন্ট", cat: "BLOOD", sample: "Blood", aliases: ["platelet", "platelet count", "pc", "প্লাটিলেট"] },
  { slug: "total-ige", en: "Total IgE", bn: "টোটাল আইজিই", cat: "SEROLOGY", sample: "Blood", aliases: ["ige", "serum ige", "total ige"] },
  { slug: "semen-analysis", en: "Semen Analysis", bn: "সিমেন অ্যানালাইসিস", cat: "OTHER", sample: "Semen", aliases: ["semen", "semen test", "semen analysis"] },
  { slug: "ca-125", en: "CA 125", bn: "সিএ ১২৫", short: "CA 125", cat: "OTHER", sample: "Blood", aliases: ["ca125", "ca 125"] },
  { slug: "cea", en: "Carcinoembryonic Antigen", bn: "সিইএ", short: "CEA", cat: "OTHER", sample: "Blood", aliases: ["cea"] },
  { slug: "afp", en: "Alpha Feto Protein", bn: "আলফা ফিটো প্রোটিন", short: "AFP", cat: "OTHER", sample: "Blood", aliases: ["afp", "alpha fetoprotein"] },
  { slug: "serum-calcium", en: "Serum Calcium", bn: "সিরাম ক্যালসিয়াম", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["calcium", "s calcium", "ক্যালসিয়াম"] },
  { slug: "serum-albumin", en: "Serum Albumin", bn: "সিরাম অ্যালবুমিন", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["albumin", "s albumin"] },
  { slug: "urine-pregnancy-test", en: "Urine Pregnancy Test", bn: "প্রেগন্যান্সি টেস্ট (প্রস্রাব)", cat: "URINE", sample: "Urine", aliases: ["pregnancy test", "upt", "urine for pregnancy", "প্রেগন্যান্সি টেস্ট"] },
  { slug: "blood-sugar-2h-abf", en: "Blood Sugar 2 Hours After Breakfast", bn: "নাস্তার ২ ঘণ্টা পর ব্লাড সুগার", short: "2HABF", cat: "BIOCHEMISTRY", sample: "Blood", aliases: ["2 hrs abf", "2habf", "sugar after breakfast", "খাওয়ার পরে সুগার"] },
  { slug: "usg-lower-abdomen", en: "Ultrasonography Lower Abdomen", bn: "আল্ট্রাসনোগ্রাম (লোয়ার অ্যাবডোমেন)", cat: "IMAGING", aliases: ["usg lower abdomen", "lower abdomen ultrasound", "ultrasound lower abdomen"] },
];


/** Creates/updates areas, neighbours, tests and aliases. Idempotent; never touches labs or prices. */
export async function upsertCatalog() {
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

}

/** Creates the first ADMIN from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD when no user exists yet. */
export async function ensureFirstAdmin() {
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

}

/**
 * Lock-out recovery: when ADMIN_RESET_PASSWORD is set, sets that password on the ADMIN whose email is
 * SEED_ADMIN_EMAIL. Skips when the password already matches, so leaving the variable set for one extra
 * restart does not sign anyone out again. Remove the variable after signing in.
 */
export async function resetAdminPassword() {
  const password = process.env.ADMIN_RESET_PASSWORD;
  if (!password) return;
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || password.length < 10) {
    console.warn("[admin-reset] Needs SEED_ADMIN_EMAIL and an ADMIN_RESET_PASSWORD of 10+ characters — nothing changed.");
    return;
  }
  const user = await db.user.findUnique({ where: { email }, include: { accounts: { where: { providerId: "credential" } } } });
  if (!user || user.role !== "ADMIN") {
    console.warn("[admin-reset] No ADMIN user has the email in SEED_ADMIN_EMAIL — nothing changed.");
    return;
  }
  const hash = user.accounts[0]?.password;
  if (hash && (await verifyPassword({ hash, password }))) {
    console.log("[admin-reset] Password already matches ADMIN_RESET_PASSWORD — remove the variable.");
    return;
  }
  await setPassword(user.id, password);
  console.log(`[admin-reset] Password reset for the admin (${password.length} characters received). Sign in, then remove ADMIN_RESET_PASSWORD.`);
}

/**
 * Runs once per server start (src/instrumentation.ts). On an EMPTY database it loads the catalogue;
 * it creates the first admin if there is none. Safe to run every start.
 */
export async function bootstrap() {
  if ((await db.area.count()) === 0 && (await db.test.count()) === 0) {
    await upsertCatalog();
    console.log(`[bootstrap] Loaded ${AREAS.length} areas and ${TESTS.length} tests.`);
  }
  await ensureFirstAdmin();
  await resetAdminPassword();
}
