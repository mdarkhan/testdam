import Link from "next/link";
import { bn } from "@/i18n/bn";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
