"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { bn } from "@/i18n/bn";

const LINKS = [
  { href: "/tests", label: bn.navTests, match: (p: string) => p === "/tests" || p.startsWith("/test/") },
  { href: "/labs", label: bn.navLabs, match: (p: string) => p === "/labs" || p.startsWith("/lab/") },
];

export function NavLinks() {
  const path = usePathname() ?? "";
  return (
    <nav aria-label={bn.navLabel} className="ml-auto">
      <ul className="flex items-center gap-1">
        {LINKS.map((l) => {
          const active = l.match(path);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center rounded-lg px-3 font-semibold hover:bg-primary-soft ${active ? "text-primary underline decoration-2 underline-offset-8" : "text-ink"}`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
