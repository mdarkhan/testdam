import "server-only";
// On-demand ISR: every admin write calls one of these with what changed.
// Public pages arrive in Phase 2; revalidating a path that does not exist yet is harmless.
import { revalidatePath } from "next/cache";
import { db } from "./db";

function revalidateAll(paths: Iterable<string>) {
  for (const p of new Set(paths)) revalidatePath(p);
}

/** After prices of one lab change (single edit, grid save, bulk verify, CSV import). */
export async function revalidatePrices(labId: number, testIds: number[]) {
  const lab = await db.lab.findUnique({ where: { id: labId }, select: { slug: true, area: { select: { slug: true } } } });
  if (!lab) return;
  const tests = await db.test.findMany({ where: { id: { in: testIds } }, select: { slug: true } });
  const paths = ["/", "/sitemap.xml", `/lab/${lab.slug}`, `/area/${lab.area.slug}`];
  for (const t of tests) paths.push(`/test/${t.slug}`, `/test/${t.slug}/${lab.area.slug}`);
  revalidateAll(paths);
}

/** After a lab's details change (incl. area move, active/featured flags). */
export async function revalidateLab(labId: number, previousAreaSlug?: string) {
  const lab = await db.lab.findUnique({
    where: { id: labId },
    select: { slug: true, area: { select: { slug: true } }, prices: { select: { test: { select: { slug: true } } } } },
  });
  if (!lab) return;
  const areas = [lab.area.slug, ...(previousAreaSlug ? [previousAreaSlug] : [])];
  const paths = ["/", "/sitemap.xml", `/lab/${lab.slug}`, ...areas.map((a) => `/area/${a}`)];
  for (const p of lab.prices) {
    paths.push(`/test/${p.test.slug}`);
    for (const a of areas) paths.push(`/test/${p.test.slug}/${a}`);
  }
  revalidateAll(paths);
}

/** After a test's names/aliases/content change: its pages + everything that lists tests. */
export function revalidateTest(testSlug: string) {
  // The "page" type covers /test/[slug] and /test/[slug]/[area].
  revalidatePath(`/test/${testSlug}`);
  revalidatePath("/test/[slug]/[area]", "page");
  revalidatePath("/", "layout");
}

export function revalidateArea(areaSlug: string) {
  revalidatePath(`/area/${areaSlug}`);
  revalidatePath("/test/[slug]/[area]", "page");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
}
