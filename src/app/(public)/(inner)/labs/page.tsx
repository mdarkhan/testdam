import type { Metadata } from "next";
import Link from "next/link";
import { bn } from "@/i18n/bn";
import { bnDigits } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { db } from "@/lib/db";
import { getCatalogIndex } from "@/lib/catalog";
import { Breadcrumbs } from "@/components/public/price-section";

// Per request from the cached catalogue index, like the home page (the build has no database).
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({ title: `${bn.allLabsTitle} | ${bn.siteName}`, description: bn.allLabsIntro, path: "/labs" });

export default async function LabsPage() {
  const index = await getCatalogIndex();
  const labs = await db.lab.findMany({
    where: { id: { in: [...index.labs.keys()] }, isActive: true }, // thin-content rule: only labs with a page
    select: { id: true, slug: true, name: true, nameBn: true, branchName: true, area: { select: { id: true, slug: true, nameBn: true, nameEn: true } } },
    orderBy: { name: "asc" },
  });
  const byArea = new Map<number, { area: (typeof labs)[number]["area"]; labs: typeof labs }>();
  for (const l of labs) {
    const g = byArea.get(l.area.id) ?? { area: l.area, labs: [] };
    g.labs.push(l);
    byArea.set(l.area.id, g);
  }
  const groups = [...byArea.values()].sort((a, b) => b.labs.length - a.labs.length || a.area.nameEn.localeCompare(b.area.nameEn));

  return (
    <>
      <Breadcrumbs path="/labs" items={[{ name: bn.home, href: "/" }, { name: bn.allLabsTitle }]} />
      <h1 className="mt-2 text-2xl font-semibold leading-tight">{bn.allLabsTitle}</h1>
      <p className="mt-1 text-muted">{bn.allLabsIntro}</p>

      {groups.map(({ area, labs: list }) => (
        <section key={area.id} className="mt-8">
          <h2 className="text-lg font-semibold">
            {index.areas.has(area.id)
              ? <Link href={`/area/${area.slug}`} className="hover:text-primary hover:underline">{area.nameBn}</Link>
              : area.nameBn}
            <span className="ml-2 text-base font-normal text-muted">{bn.labsCount(bnDigits(list.length))}</span>
          </h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {list.map((l) => (
              <li key={l.id}>
                <Link href={`/lab/${l.slug}`} className="flex min-h-12 h-full flex-col justify-center rounded-lg border border-line px-3 py-2 hover:border-primary">
                  <span className="font-semibold">{l.nameBn ?? l.name}</span>
                  <span className="text-sm text-muted">
                    {l.branchName && <>{l.branchName}, </>}{bn.freshPrices(bnDigits(index.labs.get(l.id)!))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
