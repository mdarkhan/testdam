import Link from "next/link";
import { bn } from "@/i18n/bn";
import { SearchBox } from "@/components/public/search-box";

export default function InnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <Link href="/" className="text-xl font-semibold text-primary">{bn.siteName}</Link>
          <div className="flex-1"><SearchBox /></div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </>
  );
}
