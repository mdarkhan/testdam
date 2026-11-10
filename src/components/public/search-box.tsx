"use client";
// Search with instant suggestions (ARIA combobox). Without JS it still works: the form GETs /search.
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bn } from "@/i18n/bn";
import { taka } from "@/lib/format";
import type { SearchResponse } from "@/lib/search";
import { track } from "@/lib/analytics";

export function SearchBox({ size = "sm", initial = "" }: { size?: "sm" | "lg"; initial?: string }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(initial);
  const [fetched, setData] = useState<SearchResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const data = q.trim().length >= 2 ? fetched : null; // short queries show no suggestions

  type Item = { href: string; label: string; sub: string };
  const items: Item[] = [
    ...(data?.results ?? []).map((r) => ({ href: r.href, label: `${r.nameBn} (${r.shortName ?? r.nameEn})`, sub: bn.searchFrom(taka(r.minPrice)) })),
    ...(data?.area?.href ? [{ href: data.area.href, label: bn.searchInArea(data.area.nameBn), sub: "" }] : []),
  ];

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) { setData(await res.json()); setActive(-1); setOpen(true); }
      } catch { /* aborted or offline: the form submit still works */ }
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // `search` event: a suggestion chosen or the form submitted.
  const trackSearch = () => track("search", { search_term: q.trim().slice(0, 100), results_count: data?.results.length ?? 0 });

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); trackSearch(); router.push(items[active]!.href); setOpen(false); }
  }

  const lg = size === "lg";
  const listId = `${id}-list`;
  return (
    <div ref={boxRef} className="relative w-full">
      <form action="/search" role="search" className="flex gap-2" onSubmit={(e) => {
        // Client-side navigation keeps the page (and dataLayer) alive so GTM can send the event.
        // Without JavaScript the form still GETs /search.
        const term = q.trim();
        if (!term) return;
        e.preventDefault();
        trackSearch();
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(term)}`);
      }}>
        <label htmlFor={`${id}-q`} className="sr-only">{bn.searchLabel}</label>
        <input
          id={`${id}-q`} name="q" type="search" value={q} autoComplete="off" enterKeyHint="search"
          onChange={(e) => setQ(e.target.value)} onFocus={() => data && setOpen(true)} onKeyDown={onKeyDown}
          placeholder={bn.searchPlaceholder}
          role="combobox" aria-expanded={open && items.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className={`min-w-0 flex-1 rounded-lg border-2 border-slate-300 bg-white px-3 focus:border-primary ${lg ? "h-14 text-lg" : "h-12 text-base"}`}
        />
        <button className={`shrink-0 rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary-hover ${lg ? "h-14 text-lg" : "h-12"}`}>{bn.searchButton}</button>
      </form>
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-lg">
          {items.map((it, i) => (
            <li key={it.href} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <a href={it.href} onClick={(e) => { e.preventDefault(); trackSearch(); setOpen(false); router.push(it.href); }}
                className={`flex min-h-12 items-center justify-between gap-3 px-3 py-2 ${i === active ? "bg-primary-soft" : "hover:bg-slate-50"}`}>
                <span className="font-semibold">{it.label}</span>
                <span className="shrink-0 text-sm text-muted">{it.sub}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
