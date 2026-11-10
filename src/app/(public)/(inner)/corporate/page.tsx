import type { Metadata } from "next";
import { bn } from "@/i18n/bn";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/public/price-section";
import { CorporateForm } from "@/components/public/corporate-form";

// Static copy + a client form: no database at build time.
export const metadata: Metadata = pageMetadata({ title: `${bn.corpTitle} | ${bn.siteName}`, description: bn.corpIntro, path: "/corporate" });

export default function CorporatePage() {
  return (
    <>
      <Breadcrumbs path="/corporate" items={[{ name: bn.home, href: "/" }, { name: bn.corpNav }]} />
      <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{bn.corpTitle}</h1>
      <p className="mt-2 text-lg text-muted">{bn.corpIntro}</p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {bn.corpPoints.map((p) => (
          <li key={p.title} className="border-l-4 border-primary pl-3">
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-1 text-sm text-muted">{p.body}</p>
          </li>
        ))}
      </ul>

      <section className="mt-8 rounded-2xl bg-primary-soft p-4 sm:p-6">
        <h2 className="mb-4 text-xl font-semibold">{bn.corpFormTitle}</h2>
        <CorporateForm />
      </section>
    </>
  );
}
