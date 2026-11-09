import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { btn, tableCls } from "@/components/admin/styles";

export const metadata = { title: "Areas" };

export default async function AreasPage() {
  await requireUser();
  const areas = await db.area.findMany({
    orderBy: { nameEn: "asc" },
    include: { _count: { select: { labs: true } }, neighbors: { select: { nameEn: true }, orderBy: { nameEn: "asc" } } },
  });
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Areas ({areas.length})</h1>
        <Link href="/admin/areas/new" className={btn()}>Add area</Link>
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
        <table className={tableCls}>
          <thead><tr><th>Area</th><th>Slug</th><th>Labs</th><th>Nearby</th><th>Search spellings</th></tr></thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/admin/areas/${a.id}`} className="font-semibold text-primary underline">{a.nameEn}</Link> <span lang="bn">{a.nameBn}</span></td>
                <td className="font-mono text-xs">{a.slug}</td>
                <td className="tabular">{a._count.labs}</td>
                <td className="text-muted">{a.neighbors.map((n) => n.nameEn).join(", ")}</td>
                <td className="text-muted">{a.aliases.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
