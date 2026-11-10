// Metadata + structured data helpers for public pages.
// Rule from the brief: only mark up what is visible on the page; no review/rating markup.
import type { Metadata } from "next";
import { bn } from "@/i18n/bn";
import { config } from "./config";

export const absoluteUrl = (path: string) => `${config.siteUrl}${path}`;

/** Unique title + Bangla description + canonical + Open Graph for one public page. */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "bn_BD", siteName: bn.siteName, title, description, url: path },
    twitter: { card: "summary", title, description },
  };
}

export type Crumb = { name: string; path?: string };

/** BreadcrumbList matching the visible breadcrumb (the last item is the current page). */
export function breadcrumbLd(items: Crumb[], currentPath: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path ?? currentPath),
    })),
  };
}

/** ItemList of the labs shown on a test page, in the order shown (cheapest fresh first). */
export function priceListLd(name: string, path: string, items: Array<{ name: string; price: string; path: string | null }>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: absoluteUrl(path),
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${it.name} — ${it.price}`,
      ...(it.path && { url: absoluteUrl(it.path) }),
    })),
  };
}

/** MedicalClinic (a LocalBusiness) for a lab page — only fields the page shows. */
export function labLd(lab: { name: string; nameBn: string | null; branchName: string | null; address: string; phone: string; mapUrl: string | null; areaNameEn: string; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: lab.nameBn ?? lab.name,
    ...(lab.nameBn && { alternateName: lab.name }),
    ...(lab.branchName && { department: { "@type": "MedicalClinic", name: lab.branchName } }),
    url: absoluteUrl(lab.path),
    ...(lab.phone && { telephone: lab.phone }),
    address: { "@type": "PostalAddress", streetAddress: lab.address, addressLocality: "Dhaka", addressRegion: lab.areaNameEn, addressCountry: "BD" },
    ...(lab.mapUrl && { hasMap: lab.mapUrl }),
  };
}

/** Renders JSON-LD. `<` is escaped so text from the database can never close the script tag. */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export type SitemapEntry = { url: string; lastModified: Date; changeFrequency: "daily" | "weekly" | "monthly"; priority: number };

/**
 * Sitemap = exactly the pages the thin-content rule publishes (same index the pages use to decide 404).
 * `slugs` maps ids → slugs; anything without a slug (deleted meanwhile) is skipped.
 */
export function buildSitemap(
  index: { tests: Map<number, { updated: number }>; testAreas: Map<string, { updated: number }>; labs: Map<number, number>; areas: Map<number, number>; updated: Map<string, number> },
  slugs: { tests: Map<number, string>; areas: Map<number, string>; labs: Map<number, string> },
  now = new Date(),
): SitemapEntry[] {
  const at = (ms: number | undefined) => new Date(ms ?? now.getTime());
  const out: SitemapEntry[] = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/tests"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/labs"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/corporate"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
  for (const [id, r] of index.tests) {
    const s = slugs.tests.get(id);
    if (s) out.push({ url: absoluteUrl(`/test/${s}`), lastModified: at(r.updated), changeFrequency: "weekly", priority: 0.9 });
  }
  for (const [key, r] of index.testAreas) {
    const [testId, areaId] = key.split(":").map(Number) as [number, number];
    const t = slugs.tests.get(testId), a = slugs.areas.get(areaId);
    if (t && a) out.push({ url: absoluteUrl(`/test/${t}/${a}`), lastModified: at(r.updated), changeFrequency: "weekly", priority: 0.8 });
  }
  for (const id of index.labs.keys()) {
    const s = slugs.labs.get(id);
    if (s) out.push({ url: absoluteUrl(`/lab/${s}`), lastModified: at(index.updated.get(`lab:${id}`)), changeFrequency: "weekly", priority: 0.6 });
  }
  for (const id of index.areas.keys()) {
    const s = slugs.areas.get(id);
    if (s) out.push({ url: absoluteUrl(`/area/${s}`), lastModified: at(index.updated.get(`area:${id}`)), changeFrequency: "weekly", priority: 0.7 });
  }
  return out;
}
