import Link from "next/link";
import { bn } from "@/i18n/bn";
import { SearchBox } from "./search-box";
import { NavLinks } from "./nav-links";

/** Logo mark (the ৳ tile, same as the favicon) + wordmark. */
export function Logo() {
  return (
    <Link href="/" className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-lg sm:gap-2">
      <span aria-hidden className="grid size-8 place-items-center rounded-[9px] bg-primary text-lg font-semibold leading-none text-white sm:size-9 sm:rounded-[10px] sm:text-xl">৳</span>
      <span className="whitespace-nowrap text-lg font-semibold text-primary sm:text-xl">{bn.siteName}</span>
    </Link>
  );
}

/** Same placement on every public page; inner pages add the compact search. */
export function SiteHeader({ search = false }: { search?: boolean }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-6 px-4 py-2 sm:py-3">
        <Logo />
        {search && <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1"><SearchBox /></div>}
        <NavLinks />
      </div>
    </header>
  );
}
