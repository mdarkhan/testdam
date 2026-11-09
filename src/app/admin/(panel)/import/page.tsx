import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CSV_COLUMNS, SOURCES } from "@/lib/csv";
import { btn } from "@/components/admin/styles";
import { CsvImport } from "./csv-import";

export const metadata = { title: "CSV import / export" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ lab?: string }> }) {
  await requireUser();
  const { lab = "" } = await searchParams;
  const labs = await db.lab.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true, branchName: true } });
  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold">CSV import / export</h1>

      <section className="mt-4 rounded-lg border border-line bg-white p-4 text-sm">
        <h2 className="font-semibold">Format</h2>
        <p className="mt-1">First row is the header. Columns (only <code>test_slug</code>, <code>regular_price</code>, <code>source</code> and — unless you pick a lab below — <code>lab_slug</code> are required):</p>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 text-xs">{CSV_COLUMNS.join(",")}
demo-lab-1-mirpur,cbc,400,350,2026-12-31,6,yes,PHONE_CALL,asked reception,2026-11-10</pre>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li><code>test_slug</code> may also be an alias such as <code>CBC</code> or <code>সিবিসি</code> when it matches exactly one test.</li>
          <li>Dates are <code>YYYY-MM-DD</code>. <code>verified_on</code> blank = today. <code>discount_expires</code> is the last valid day.</li>
          <li><code>source</code>: {SOURCES.join(", ")} (or phone, list, website, lab, visit).</li>
          <li>Prices in whole taka; Bangla digits and commas are fine.</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/admin/export" className={btn("plain")}>Export all prices</a>
          <a href="/admin/export?template=1" className={btn("plain")}>Download empty template</a>
        </div>
      </section>

      <CsvImport labs={labs.map((l) => ({ slug: l.slug, label: `${l.name}${l.branchName ? ` · ${l.branchName}` : ""}` }))} initialLab={lab} />
    </div>
  );
}
