import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { CSV_COLUMNS, toCsv } from "@/lib/csv";
import { dhakaDateString } from "@/lib/dates";

// GET /admin/export            → all prices
// GET /admin/export?lab=<slug> → one lab
// GET /admin/export?template=1 → header row only
export async function GET(req: Request) {
  if (!(await getUser())) return new Response("Sign in first", { status: 401 });
  const url = new URL(req.url);
  const lab = url.searchParams.get("lab") ?? undefined;
  const template = url.searchParams.has("template");

  const prices = template
    ? []
    : await db.labTestPrice.findMany({
        where: lab ? { lab: { slug: lab } } : undefined,
        include: { lab: { select: { slug: true } }, test: { select: { slug: true } } },
        orderBy: [{ lab: { slug: "asc" } }, { test: { slug: "asc" } }],
      });
  const csv = template
    ? CSV_COLUMNS.join(",") + "\r\n"
    : toCsv(prices.map((p) => ({ ...p, labSlug: p.lab.slug, testSlug: p.test.slug })));
  const name = `testmate-${template ? "template" : `prices-${lab ?? "all"}-${dhakaDateString(new Date())}`}.csv`;
  // BOM so Excel opens Bangla text as UTF-8.
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
