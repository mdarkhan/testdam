"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { bn } from "@/i18n/bn";
import { bnDigits } from "@/lib/format";
import { basketHref, useBasket } from "@/lib/basket-store";

const LINKS = [
  { href: "/tests", label: bn.navTests, match: (p: string) => p === "/tests" || p.startsWith("/test/") },
  { href: "/labs", label: bn.navLabs, match: (p: string) => p === "/labs" || p.startsWith("/lab/") },
];

const item = "flex min-h-12 items-center whitespace-nowrap rounded-lg px-2 font-semibold hover:bg-primary-soft sm:px-3";
const activeCls = "text-primary underline decoration-2 underline-offset-8";

export function NavLinks() {
  const path = usePathname() ?? "";
  const basket = useBasket();
  const onBasket = path === "/basket";
  return (
    <nav aria-label={bn.navLabel} className="ml-auto">
      <ul className="flex items-center gap-0.5 sm:gap-1">
        {LINKS.map((l) => {
          const active = l.match(path);
          return (
            <li key={l.href}>
              <Link href={l.href} aria-current={active ? "page" : undefined} className={`${item} ${active ? activeCls : "text-ink"}`}>
                {l.label}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href={basketHref(basket)}
            aria-current={onBasket ? "page" : undefined}
            aria-label={basket.length ? bn.navBasketCount(bnDigits(basket.length)) : undefined}
            className={`${item} gap-1 ${onBasket ? activeCls : "text-ink"}`}
          >
            {bn.navBasket}
            {basket.length > 0 && (
              <span aria-hidden className="grid min-w-5 place-items-center rounded-full bg-primary px-1 text-xs leading-5 text-white no-underline sm:min-w-6 sm:text-sm sm:leading-6">
                {bnDigits(basket.length)}
              </span>
            )}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
