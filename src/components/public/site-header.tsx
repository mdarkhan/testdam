import Link from "next/link";
import { bn } from "@/i18n/bn";
import { SearchBox } from "./search-box";
import { NavLinks } from "./nav-links";

/** Logo mark (the ৳ tile, same as the favicon) + wordmark. */
export function Logo() {
  return (
    <Link href="/" className="flex min-h-12 shrink-0 items-center gap-2 rounded-lg">
      <span aria-hidden className="grid size-9 place-items-center rounded-[10px] bg-primary text-xl font-semibold leading-none text-white">৳</span>
      <span className="text-xl font-semibold text-primary">{bn.siteName}</span>
    </Link>
  );
}

/** Same placement on every public page; inner pages add the compact search. */
export function SiteHeader({ search = false }: { search?: boolean }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:py-3">
        <Logo />
        {search && <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1"><SearchBox /></div>}
        <NavLinks />
      </div>
    </header>
  );
}
