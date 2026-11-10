import Link from "next/link";
import Script from "next/script";
import { bn } from "@/i18n/bn";
import { config } from "@/lib/config";
import { ATTRIBUTION_SCRIPT } from "@/lib/analytics";

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
      {children}
      <footer className="mt-12 border-t border-line bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted">
          <p><Link href="/" className="font-semibold text-primary">{bn.siteName}</Link> — {bn.tagline}</p>
          <p className="mt-2">{bn.footerNote}</p>
          <p className="mt-2">{bn.disclaimer}</p>
        </div>
      </footer>
    </>
  );
}
