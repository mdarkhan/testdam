"use client";
// Picks the tests on /basket. The list lives in the URL (?t=a,b,c: shareable, server-rendered
// totals) and is mirrored to this browser's basket so the header count and test pages agree.
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bn } from "@/i18n/bn";
import { bnDigits } from "@/lib/format";
import { searchKey } from "@/lib/normalize";
import { BASKET_MAX } from "@/lib/pricing";
import { basketHref, readBasket, setBasket } from "@/lib/basket-store";

export type PickerTest = { slug: string; label: string; keys: string[] };

export function BasketPicker({ tests, selected, popular, fromUrl }: {
  tests: PickerTest[]; selected: string[]; popular: string[]; fromUrl: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const bySlug = useMemo(() => new Map(tests.map((t) => [t.slug, t])), [tests]);

  // A shared link (?t=…) becomes this browser's list; with no ?t=, show the stored list.
  useEffect(() => {
    const saved = readBasket();
    if (fromUrl) { if (saved.join(",") !== selected.join(",")) setBasket(selected); }
    else if (saved.length) router.replace(basketHref(saved), { scroll: false });
    // Only on arrival: later changes go through `update`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(next: string[]) {
    setBasket(next);
    startTransition(() => router.replace(basketHref(next), { scroll: false }));
  }

  const key = searchKey(q);
  const full = selected.length >= BASKET_MAX;
  const matches = key
    ? tests.filter((t) => !selected.includes(t.slug) && t.keys.some((k) => k.includes(key))).slice(0, 8)
    : popular.filter((s) => !selected.includes(s)).map((s) => bySlug.get(s)!).filter(Boolean).slice(0, selected.length ? 4 : 8);

  return (
    <div className="mt-4 rounded-xl border border-line p-3 sm:p-4">
      {selected.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">{bn.basketSelected(bnDigits(selected.length))}</h2>
            <button type="button" onClick={() => update([])} className="flex min-h-12 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold text-danger hover:bg-danger-soft">
              {bn.basketClear}
            </button>
          </div>
          <ul className="mt-1 flex flex-wrap gap-2">
            {selected.map((s) => {
              const label = bySlug.get(s)?.label ?? s;
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => update(selected.filter((x) => x !== s))}
                    aria-label={bn.basketRemove(label)}
                    className="flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-primary-soft py-1 pl-4 pr-3 text-left font-semibold text-primary hover:bg-primary/15"
                  >
                    {label}
                    <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className={selected.length ? "mt-4" : ""}>
        <label htmlFor={`${id}-q`} className="font-semibold">{bn.basketPickLabel}</label>
        <input
          id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} disabled={full}
          placeholder={bn.basketPickPlaceholder} autoComplete="off" enterKeyHint="search"
          className="mt-1 block min-h-12 w-full rounded-lg border-2 border-line bg-white px-3 text-base focus:border-primary disabled:opacity-50"
        />
        {full ? (
          <p className="mt-2 text-sm text-muted">{bn.basketFull(bnDigits(BASKET_MAX))}</p>
        ) : (
          <>
            {!key && matches.length > 0 && <p className="mt-3 text-sm text-muted">{bn.basketPickPopular}</p>}
            {key && matches.length === 0 && <p className="mt-2 text-sm text-muted">{bn.basketPickNone}</p>}
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {matches.map((t) => (
                <li key={t.slug}>
                  <button
                    type="button"
                    onClick={() => { update([...selected, t.slug]); setQ(""); }}
                    className="flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-left hover:border-primary"
                  >
                    <svg aria-hidden viewBox="0 0 20 20" className="size-5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>
                    <span className="font-semibold">{t.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <p role="status" className="sr-only">{pending ? "…" : ""}</p>
    </div>
  );
}
