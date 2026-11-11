"use client";
// The compact header search, hidden on /search, where the page has its own prefilled box.
import { usePathname } from "next/navigation";
import { SearchBox } from "./search-box";

export function HeaderSearch() {
  if (usePathname() === "/search") return null;
  return <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1"><SearchBox /></div>;
}
