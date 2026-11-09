import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { btn, tableCls } from "@/components/admin/styles";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Tests" };

export default async function TestsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  await requireUser();
  const { q = "", filter } = await searchParams;
  const where: Prisma.TestWhereInput = {
    ...(q && { OR: [{ nameEn: { contains: q, mode: "insensitive" } }, { nameBn: { contains: q } }, { slug: { contains: q.toLowerCase() } }, { aliases: { some: { alias: { contains: q, mode: "insensitive" } } } }] }),
    ...(filter === "review" && { contentStatus: "DRAFT_NEEDS_REVIEW", OR: [{ description: { not: null } }, { preparationNote: { not: null } }] }),
  };
  const tests = await db.test.findMany({
    where,
    orderBy: [{ popularRank: { sort: "asc", nulls: "last" } }, { nameEn: "asc" }],
    include: { _count: { select: { aliases: true, prices: true } } },
  });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Tests ({tests.length})</h1>
        <Link href="/admin/tests/new" className={btn()}>Add test</Link>
      </div>
      <form className="mt-4 flex flex-wrap items-end gap-2" role="search">
        <label className="text-sm font-semibold">Search <input name="q" defaultValue={q} className="mt-1 block rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="filter" value="review" defaultChecked={filter === "review"} className="size-4 accent-primary" /> Only texts awaiting review</label>
        <button className={btn("plain")}>Filter</button>
      </form>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
        <table className={tableCls}>
          <thead><tr><th>Test</th><th>Slug</th><th>Category</th><th>Aliases</th><th>Prices</th><th>Popular</th><th>Text</th></tr></thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/admin/tests/${t.id}`} className="font-semibold text-primary underline">{t.nameEn}</Link>
                  {t.shortName && <span className="text-muted"> ({t.shortName})</span>} <span lang="bn" className="text-muted">{t.nameBn}</span>
                </td>
                <td className="font-mono text-xs">{t.slug}</td>
                <td>{t.category}</td>
                <td className="tabular">{t._count.aliases}</td>
                <td className="tabular">{t._count.prices}</td>
                <td className="tabular">{t.popularRank ?? ""}</td>
                <td>{t.description || t.preparationNote ? (t.contentStatus === "REVIEWED" ? "Reviewed" : <span className="text-danger">Needs review</span>) : <span className="text-muted">None</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
