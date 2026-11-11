"use client";
// "Add to my list" on test pages (with the hint and a link to the list) and, compact, in the
// rows of a lab page. Toggles the test in the basket.
import Link from "next/link";
import { bn } from "@/i18n/bn";
import { bnDigits } from "@/lib/format";
import { BASKET_MAX } from "@/lib/pricing";
import { basketHref, setBasket, useBasket } from "@/lib/basket-store";

export function BasketToggle({ slug, className = "" }: { slug: string; className?: string }) {
  const basket = useBasket();
  const inBasket = basket.includes(slug);
  const full = !inBasket && basket.length >= BASKET_MAX;
  return (
    <button
      type="button"
      aria-pressed={inBasket}
      disabled={full}
      title={full ? bn.basketFull(bnDigits(BASKET_MAX)) : undefined}
      onClick={() => setBasket(inBasket ? basket.filter((s) => s !== slug) : [...basket, slug])}
      className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
        inBasket ? "border-primary bg-primary-soft text-primary" : "border-primary text-primary hover:bg-primary-soft"
      } ${className}`}
    >
      <svg aria-hidden viewBox="0 0 20 20" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {inBasket ? <path d="M4 10.5l4 4 8-9" /> : <path d="M10 4v12M4 10h12" />}
      </svg>
      {inBasket ? bn.basketAdded : bn.basketAdd}
    </button>
  );
}

export function BasketButton({ slug }: { slug: string }) {
  const basket = useBasket();
  const full = !basket.includes(slug) && basket.length >= BASKET_MAX;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <BasketToggle slug={slug} />
        {basket.length > 0 && (
          <Link href={basketHref(basket)} className="flex min-h-12 items-center rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary-hover">
            {bn.basketView(bnDigits(basket.length))}
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{full ? bn.basketFull(bnDigits(BASKET_MAX)) : bn.basketAddHint}</p>
    </div>
  );
}
