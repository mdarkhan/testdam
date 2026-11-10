import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { bn } from "@/i18n/bn";
import { taka } from "@/lib/format";
import { searchTests } from "@/lib/search";

// Results page for a submitted search (Enter without picking a suggestion). Not indexed.
export const metadata: Metadata = { title: `${bn.searchButton} | ${bn.siteName}`, robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const { results, area } = q ? await searchTests(q, 20) : { results: [], area: null };

  // One clear exact hit ("cbc mirpur") → go straight to its page. If another test matches almost as
  // well ("sugar" → RBS and FBS), show the list so the visitor chooses.
  const [first, second] = results;
  if (first?.exact && !results.slice(1).some((r) => r.exact) && (!second || second.score < 0.6)) redirect(first.href);
  if (!results.length && area?.href) redirect(area.href);

  return (
    <>
      <h1 className="text-2xl font-semibold">{q ? bn.searchResultsTitle(q) : bn.searchButton}</h1>
      {q && results.length === 0 && (
        <div className="mt-4 rounded-xl border border-line p-4">
          <p className="font-semibold">{bn.searchNoResults(q)}</p>
          <p className="mt-1 text-muted">{bn.searchNoResultsHint}</p>
          <Link href="/" className="mt-3 inline-flex min-h-12 items-center font-semibold text-primary underline">{bn.backHome}</Link>
        </div>
      )}
      <ul className="mt-4 grid gap-2">
        {results.map((r) => (
          <li key={r.href}>
            <Link href={r.href} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 hover:border-primary">
              <span className="font-semibold">{r.nameBn} ({r.shortName ?? r.nameEn})</span>
              <span className="tabular shrink-0 text-sm text-muted">{bn.searchFrom(taka(r.minPrice))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
