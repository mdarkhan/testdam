"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { classifyRow, parsePriceCsv, type RowError, type RowStatus } from "@/lib/csv";
import { upsertPrices } from "@/lib/price-writes";

const MAX_BYTES = 1_000_000;

export type PreviewRow = { line: number; lab: string; test: string; status: RowStatus; price: string; was: string | null };
export type PreviewResult = { fatal?: string; rows: PreviewRow[]; errors: RowError[]; counts: Record<RowStatus, number> };

async function lookups() {
  const [labs, tests, aliases] = await Promise.all([
    db.lab.findMany({ select: { id: true, slug: true, name: true, branchName: true } }),
    db.test.findMany({ select: { id: true, slug: true, nameEn: true } }),
    db.testAlias.findMany({ select: { testId: true, searchKey: true } }),
  ]);
  const testMap = new Map(tests.map((t) => [t.slug, t.id]));
  // Alias keys that point to exactly one test can be used in the test_slug column.
  const owners = new Map<string, Set<number>>();
  for (const a of aliases) owners.set(a.searchKey, (owners.get(a.searchKey) ?? new Set()).add(a.testId));
  for (const [key, ids] of owners) if (ids.size === 1 && !testMap.has(key)) testMap.set(key, [...ids][0]!);
  return {
    maps: { labs: new Map(labs.map((l) => [l.slug, l.id])), tests: testMap },
    labName: new Map(labs.map((l) => [l.id, `${l.name}${l.branchName ? ` · ${l.branchName}` : ""}`])),
    testName: new Map(tests.map((t) => [t.id, `${t.nameEn} (${t.slug})`])),
  };
}

type Parsed = { error: string } | { l: Awaited<ReturnType<typeof lookups>>; parsed: ReturnType<typeof parsePriceCsv> };

async function parse(text: string, defaultLabSlug: string): Promise<Parsed> {
  if (text.length > MAX_BYTES) return { error: "File is larger than 1 MB. Split it into smaller files." };
  const l = await lookups();
  const parsed = parsePriceCsv(text, l.maps, { defaultLabSlug: defaultLabSlug || undefined });
  return { l, parsed };
}

export async function previewCsv(text: string, defaultLabSlug: string): Promise<PreviewResult> {
  await requireUser();
  const counts: Record<RowStatus, number> = { new: 0, changed: 0, verify_only: 0 };
  const p = await parse(text, defaultLabSlug);
  if ("error" in p) return { fatal: p.error, rows: [], errors: [], counts };
  const { l, parsed } = p;
  if (parsed.fatal) return { fatal: parsed.fatal, rows: [], errors: [], counts };

  const existing = parsed.rows.length
    ? await db.labTestPrice.findMany({ where: { OR: parsed.rows.map((r) => ({ labId: r.labId, testId: r.testId })) } })
    : [];
  const byKey = new Map(existing.map((e) => [`${e.labId}:${e.testId}`, e]));
  const rows = parsed.rows.map((r): PreviewRow => {
    const ex = byKey.get(`${r.labId}:${r.testId}`);
    const status = classifyRow(r.data, ex);
    counts[status]++;
    const fmt = (reg: number, disc: number | null) => (disc ? `${disc} (reg. ${reg})` : String(reg));
    return {
      line: r.line,
      lab: l.labName.get(r.labId) ?? r.labSlug,
      test: l.testName.get(r.testId) ?? r.testSlug,
      status,
      price: fmt(r.data.regularPrice, r.data.discountPrice),
      was: ex ? fmt(ex.regularPrice, ex.discountPrice) : null,
    };
  });
  return { rows, errors: parsed.errors, counts };
}

/** Saves all valid rows (rows with errors are skipped — the preview showed them). */
export async function importCsv(text: string, defaultLabSlug: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const p = await parse(text, defaultLabSlug);
  if ("error" in p) return { ok: false, message: p.error };
  if (p.parsed.fatal) return { ok: false, message: p.parsed.fatal };
  const res = await upsertPrices(p.parsed.rows.map((r) => ({ labId: r.labId, testId: r.testId, data: r.data })), user.id);
  revalidatePath("/admin/labs", "layout");
  const skipped = p.parsed.errors.length ? `, ${p.parsed.errors.length} row(s) with errors skipped` : "";
  return { ok: true, message: `Imported: ${res.created} added, ${res.changed} changed, ${res.verified} re-verified${skipped}.` };
}
