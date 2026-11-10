import Link from "next/link";
import Script from "next/script";
import { bn } from "@/i18n/bn";
import { config } from "@/lib/config";
import { ATTRIBUTION_SCRIPT } from "@/lib/analytics";
import { Logo } from "@/components/public/site-header";

// GTM only on public pages (never admin). The ID is validated so the env var can't inject script.
const gtmId = /^GTM-[A-Z0-9]+$/.test(config.gtmId) ? config.gtmId : null;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: ATTRIBUTION_SCRIPT }} />
      {gtmId && (
        <>
          <Script id="gtm" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});var f=document.getElementsByTagName('script')[0],j=document.createElement('script');j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id=${gtmId}';f.parentNode.insertBefore(j,f);`}
          </Script>
          <noscript>
            <iframe src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="gtm" />
          </noscript>
        </>
      )}
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">{bn.skipToContent}</a>
      <div className="flex min-h-dvh flex-col">
        {children}
        <footer className="mt-auto border-t border-line bg-slate-50">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-8 pt-12 text-sm text-muted sm:grid-cols-[2fr_1fr]">
            <div>
              <Logo />
              <p className="mt-2">{bn.tagline}</p>
              <p className="mt-2">{bn.footerNote}</p>
              <p className="mt-2">{bn.disclaimer}</p>
            </div>
            <nav aria-label={bn.footerExplore}>
              <h2 className="font-semibold text-ink">{bn.footerExplore}</h2>
              <ul className="mt-1">
                <li><Link href="/tests" className="flex min-h-12 items-center hover:text-primary">{bn.allTestsTitle}</Link></li>
                <li><Link href="/labs" className="flex min-h-12 items-center hover:text-primary">{bn.allLabsTitle}</Link></li>
              </ul>
            </nav>
          </div>
        </footer>
      </div>
    </>
  );
}
