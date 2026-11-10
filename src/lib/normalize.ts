// Search-key normalisation shared by indexing (TestAlias.searchKey) and querying.
// Pure functions only — unit-tested in tests/normalize.test.ts.
//
// Why romanise: pg_trgm extracts no trigrams at all from Bangla text (verified on our Postgres:
// show_trgm('সিবিসি') = {}), because vowel signs are not "word" characters. So every key is turned
// into ASCII with a small fixed table before it reaches the database.

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function bnToAsciiDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

// Letters people type interchangeably are merged on purpose (ি/ী, শ/ষ/স, ন/ণ, ট/ত …):
// the key is for matching, not for display.
const BN_TO_LATIN: Record<string, string> = {
  // independent vowels
  "অ": "o", "আ": "a", "ই": "i", "ঈ": "i", "উ": "u", "ঊ": "u", "ঋ": "ri",
  "এ": "e", "ঐ": "oi", "ও": "o", "ঔ": "ou",
  // vowel signs
  "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u", "ৃ": "ri",
  "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou",
  // consonants
  "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "ng",
  "চ": "ch", "ছ": "ch", "জ": "j", "ঝ": "jh", "ঞ": "n",
  "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n",
  "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
  "প": "p", "ফ": "f", "ব": "b", "ভ": "bh", "ম": "m",
  "য": "j", "র": "r", "ল": "l", "শ": "s", "ষ": "s", "স": "s", "হ": "h",
  "\u09dc": "r", "\u09dd": "r", "\u09df": "y", "ৎ": "t", // precomposed ড় ঢ় য়
  // signs
  "ং": "ng", "ঃ": "h", "ঁ": "", "্": "", "়": "",
};

// Words that carry no meaning for "which test" (both scripts, plus Banglish).
// "e"/"te" are deliberately NOT here: "Vitamin E" is a test.
const FILLERS_RAW = [
  "test", "tests", "price", "prices", "dam", "daam", "er", "koto", "rate", "cost", "fee", "fees",
  "dhaka", "in", "of", "the", "ki", "taka", "tk", "bd",
  "টেস্ট", "টেস্টের", "টেষ্ট", "পরীক্ষা", "পরীক্ষার", "দাম", "এর", "কত", "কি", "টাকা", "ঢাকা", "ঢাকায়", "মূল্য",
];

/** Unicode-level clean-up: NFC, digits, case, punctuation, spacing, Bangla spelling variants. */
export function normalizeText(input: string): string {
  return bnToAsciiDigits(input.normalize("NFC"))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Latin diacritics (é → e); Bangla is outside this range
    .normalize("NFC")
    .replace(/\u09af\u09bc/g, "\u09df") // ya + nukta → precomposed (NFC leaves these decomposed)
    .replace(/\u09a1\u09bc/g, "\u09dc") // dda + nukta
    .replace(/\u09a2\u09bc/g, "\u09dd") // ddha + nukta
    .replace(/[\u200c\u200d]/g, "") // ZWNJ / ZWJ
    .replace(/[.'\u2019]/g, "") // "C.B.C" → "cbc", "Vit. D" → "vit d"
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const FILLERS = new Set(FILLERS_RAW.map(normalizeText));

export function romanize(s: string): string {
  let out = "";
  for (const ch of s) out += BN_TO_LATIN[ch] ?? ch;
  return out;
}

/**
 * The key stored in TestAlias.searchKey and computed for every query.
 * Falls back to keeping filler words if removing them would leave nothing ("test" alone).
 */
export function searchKey(input: string): string {
  const tokens = normalizeText(input).split(" ").filter(Boolean);
  const meaningful = tokens.filter((t) => !FILLERS.has(t));
  return romanize((meaningful.length ? meaningful : tokens).join(" "));
}

/** ASCII slug for URLs: "Lipid Profile" → "lipid-profile". Bangla is romanised first. */
export function slugify(input: string): string {
  return romanize(normalizeText(input))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Turns a test's names + aliases into unique TestAlias rows (one per searchKey, first spelling wins).
 * The test's own names are always included so search only needs the TestAlias table.
 */
export function aliasRows(names: Array<string | null | undefined>): Array<{ alias: string; searchKey: string }> {
  const out = new Map<string, string>();
  for (const raw of names) {
    const alias = raw?.trim();
    if (!alias) continue;
    const key = searchKey(alias);
    if (key && !out.has(key)) out.set(key, alias);
  }
  return [...out].map(([key, alias]) => ({ alias, searchKey: key }));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Finds an area inside a search key ("cbc mirpur" / "মিরপুরে সিবিসি" → mirpur) and returns the rest.
 * `areas[].keys` are searchKey()s of the area's names and spellings. Longest match wins.
 * Bangla case endings are allowed after the name: -e/-y (মিরপুরে, উত্তরায়), -er/-r (মিরপুরের).
 */
export function extractArea<T extends { keys: string[] }>(key: string, areas: T[]): { area: T | null; rest: string } {
  let best: { area: T; re: RegExp; len: number } | null = null;
  for (const area of areas) {
    for (const k of area.keys) {
      if (!k || (best && k.length <= best.len)) continue;
      const re = new RegExp(`(^| )${escapeRe(k)}(e|er|y|ye|r)?(?= |$)`);
      if (re.test(key)) best = { area, re, len: k.length };
    }
  }
  if (!best) return { area: null, rest: key };
  return { area: best.area, rest: key.replace(best.re, " ").trim().replace(/\s+/g, " ") };
}
