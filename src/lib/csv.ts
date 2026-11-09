// CSV import/export for prices. Parsing and validation are pure (tests/csv.test.ts);
// the server action looks up slugs and existing prices, then calls these.
import Papa from "papaparse";
import { dhakaDateString, endOfDhakaDay, noonDhakaDay } from "./dates";
import { bnToAsciiDigits, searchKey } from "./normalize";

export const CSV_COLUMNS = [
  "lab_slug",
  "test_slug",
  "regular_price",
  "discount_price",
  "discount_expires",
  "report_hours",
  "home_collection",
  "source",
  "source_note",
  "verified_on",
] as const;

export const SOURCES = ["PHONE_CALL", "PRICE_LIST", "WEBSITE", "LAB_SUBMITTED", "VISIT"] as const;
export type Source = (typeof SOURCES)[number];

const SOURCE_ALIASES: Record<string, Source> = {
  phone: "PHONE_CALL", call: "PHONE_CALL", phone_call: "PHONE_CALL",
  list: "PRICE_LIST", price_list: "PRICE_LIST", pricelist: "PRICE_LIST", photo: "PRICE_LIST",
  web: "WEBSITE", website: "WEBSITE",
  lab: "LAB_SUBMITTED", lab_submitted: "LAB_SUBMITTED",
  visit: "VISIT",
};

export type PriceInput = {
  regularPrice: number;
  discountPrice: number | null;
  discountExpiresAt: Date | null;
  reportHours: number | null;
  homeCollection: boolean;
  source: Source;
  sourceNote: string | null;
  verifiedAt: Date;
};

export type ParsedRow = { line: number; labSlug: string; testSlug: string; labId: number; testId: number; data: PriceInput };
export type RowError = { line: number; labSlug: string; testSlug: string; errors: string[] };

export function parseSource(v: string): Source | null {
  const k = v.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!k) return null;
  return (SOURCES as readonly string[]).includes(k.toUpperCase()) ? (k.toUpperCase() as Source) : (SOURCE_ALIASES[k] ?? null);
}

export function parseYesNo(v: string): boolean | null {
  const k = v.trim().toLowerCase();
  if (["yes", "y", "true", "1", "হ্যাঁ", "হ্যা"].includes(k)) return true;
  if (["no", "n", "false", "0", "না", ""].includes(k)) return false;
  return null;
}

function parseTaka(v: string): number | null | "invalid" {
  const s = bnToAsciiDigits(v).replace(/[,\s৳]|tk|taka/gi, "");
  if (!s) return null;
  if (!/^\d+$/.test(s)) return "invalid";
  return Number(s);
}

/** Validates one price (used by CSV import and by the price grid). Returns the cleaned value or a list of errors. */
export function validatePrice(raw: {
  regularPrice: string;
  discountPrice?: string;
  discountExpires?: string;
  reportHours?: string;
  homeCollection?: string;
  source: string;
  sourceNote?: string;
  verifiedOn?: string;
}, now = new Date()): { ok: true; data: PriceInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const regular = parseTaka(raw.regularPrice);
  if (regular === null) errors.push("regular_price is required");
  else if (regular === "invalid" || regular <= 0 || regular > 500_000) errors.push(`regular_price "${raw.regularPrice}" is not a valid amount`);

  const discount = parseTaka(raw.discountPrice ?? "");
  if (discount === "invalid" || (typeof discount === "number" && discount <= 0)) errors.push(`discount_price "${raw.discountPrice}" is not a valid amount`);
  else if (typeof discount === "number" && typeof regular === "number" && discount >= regular) errors.push("discount_price must be lower than regular_price");

  let discountExpiresAt: Date | null = null;
  if (raw.discountExpires?.trim()) {
    discountExpiresAt = endOfDhakaDay(bnToAsciiDigits(raw.discountExpires));
    if (!discountExpiresAt) errors.push(`discount_expires "${raw.discountExpires}" must be YYYY-MM-DD`);
    else if (discount === null) errors.push("discount_expires given without discount_price");
  }

  let reportHours: number | null = null;
  if (raw.reportHours?.trim()) {
    const n = Number(bnToAsciiDigits(raw.reportHours.trim()));
    if (!Number.isInteger(n) || n <= 0 || n > 24 * 60) errors.push(`report_hours "${raw.reportHours}" must be a whole number of hours`);
    else reportHours = n;
  }

  const homeCollection = parseYesNo(raw.homeCollection ?? "");
  if (homeCollection === null) errors.push(`home_collection "${raw.homeCollection}" must be yes or no`);

  const source = parseSource(raw.source);
  if (!source) errors.push(`source "${raw.source}" must be one of ${SOURCES.join(", ")}`);

  let verifiedAt = now;
  if (raw.verifiedOn?.trim()) {
    const v = noonDhakaDay(bnToAsciiDigits(raw.verifiedOn));
    if (!v) errors.push(`verified_on "${raw.verifiedOn}" must be YYYY-MM-DD`);
    else if (v.getTime() > now.getTime() + 24 * 3600 * 1000) errors.push("verified_on is in the future");
    else verifiedAt = v;
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      regularPrice: regular as number,
      discountPrice: (discount as number | null) ?? null,
      discountExpiresAt,
      reportHours,
      homeCollection: homeCollection as boolean,
      source: source as Source,
      sourceNote: raw.sourceNote?.trim() || null,
      verifiedAt,
    },
  };
}

/**
 * Parses CSV text into validated rows. `labs`/`tests` map slug → id.
 * `defaultLabSlug` fills an empty or missing lab_slug column (importing from a lab's own page).
 */
export function parsePriceCsv(
  text: string,
  lookups: { labs: Map<string, number>; tests: Map<string, number> },
  opts: { defaultLabSlug?: string; now?: Date } = {},
): { rows: ParsedRow[]; errors: RowError[]; fatal?: string } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  const fields = parsed.meta.fields ?? [];
  const missing = ["test_slug", "regular_price", "source"].filter((c) => !fields.includes(c));
  if (!opts.defaultLabSlug && !fields.includes("lab_slug")) missing.unshift("lab_slug");
  if (missing.length) return { rows: [], errors: [], fatal: `Missing column(s): ${missing.join(", ")}. Expected: ${CSV_COLUMNS.join(",")}` };

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();

  parsed.data.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const labSlug = (r.lab_slug ?? "").trim() || opts.defaultLabSlug || "";
    const testSlug = (r.test_slug ?? "").trim().toLowerCase();
    const errs: string[] = [];

    const labId = lookups.labs.get(labSlug);
    // Exact slug first, then an alias key that belongs to exactly one test (lookups decide what is included).
    const testId = lookups.tests.get(testSlug) ?? lookups.tests.get(searchKey(r.test_slug ?? ""));
    if (!labSlug) errs.push("lab_slug is required");
    else if (labId === undefined) errs.push(`unknown lab_slug "${labSlug}"`);
    if (!testSlug) errs.push("test_slug is required");
    else if (testId === undefined) errs.push(`unknown test_slug "${testSlug}"`);

    // Key on resolved ids so "CBC" and "সিবিসি" in one file count as the same test.
    const key = `${labId ?? labSlug}|${testId ?? testSlug}`;
    if (seen.has(key)) errs.push(`duplicate of line ${seen.get(key)}`);
    else seen.set(key, line);

    const v = validatePrice(
      {
        regularPrice: r.regular_price ?? "",
        discountPrice: r.discount_price,
        discountExpires: r.discount_expires,
        reportHours: r.report_hours,
        homeCollection: r.home_collection,
        source: r.source ?? "",
        sourceNote: r.source_note,
        verifiedOn: r.verified_on,
      },
      opts.now,
    );
    if (!v.ok) errs.push(...v.errors);

    if (errs.length || !v.ok || labId === undefined || testId === undefined) errors.push({ line, labSlug, testSlug, errors: errs });
    else rows.push({ line, labSlug, testSlug, labId, testId, data: v.data });
  });

  return { rows, errors };
}

export type ExistingPrice = Omit<PriceInput, "verifiedAt" | "source"> & { source: string; verifiedAt: Date };
export type RowStatus = "new" | "changed" | "verify_only";

/** "changed" = any price field differs; "verify_only" = same price, only the verification is refreshed. */
export function classifyRow(next: PriceInput, existing: ExistingPrice | undefined): RowStatus {
  if (!existing) return "new";
  return isPriceChange(existing, next) ? "changed" : "verify_only";
}

/** True when a field that belongs in PriceHistory differs. */
export function isPriceChange(a: Pick<PriceInput, "regularPrice" | "discountPrice" | "discountExpiresAt">, b: Pick<PriceInput, "regularPrice" | "discountPrice" | "discountExpiresAt">): boolean {
  return (
    a.regularPrice !== b.regularPrice ||
    (a.discountPrice ?? null) !== (b.discountPrice ?? null) ||
    (a.discountExpiresAt?.getTime() ?? null) !== (b.discountExpiresAt?.getTime() ?? null)
  );
}

export function toCsv(rows: Array<{ labSlug: string; testSlug: string } & ExistingPrice>): string {
  return Papa.unparse({
    fields: [...CSV_COLUMNS],
    data: rows.map((r) => [
      r.labSlug,
      r.testSlug,
      r.regularPrice,
      r.discountPrice ?? "",
      r.discountExpiresAt ? dhakaDateString(r.discountExpiresAt) : "",
      r.reportHours ?? "",
      r.homeCollection ? "yes" : "no",
      r.source,
      r.sourceNote ?? "",
      dhakaDateString(r.verifiedAt),
    ]),
  });
}
