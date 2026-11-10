// The site's signature graphic: one line from the cheapest to the dearest fresh price of a test,
// with a dot for every lab. The cheapest dot is green (brief: green = cheapest). Decorative for
// screen readers — the same numbers are always printed as text next to it (spreadSr / labels).
import { bn } from "@/i18n/bn";
import { bnDigits, taka } from "@/lib/format";

type Props = { prices: number[]; size?: "md" | "lg"; labels?: boolean };

export function PriceSpread({ prices, size = "md", labels = true }: Props) {
  if (prices.length === 0) return null;
  const min = prices[0]!, max = prices[prices.length - 1]!;
  const span = max - min;
  const at = (p: number) => (span ? ((p - min) / span) * 100 : 50);
  const lg = size === "lg";
  const dot = lg ? "size-3.5" : "size-2.5";

  return (
    <div>
      <p className="sr-only">{bn.spreadSr(bnDigits(prices.length), taka(min), taka(max))}</p>
      <div aria-hidden className={`relative ${lg ? "mx-2 h-7" : "mx-1.5 h-5"}`}>
        <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-line ${lg ? "h-2" : "h-1.5"}`} />
        {prices.map((p, i) => (
          <span
            key={i}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${dot} ${p === min ? "z-10 bg-cheapest" : "bg-primary/40"}`}
            style={{ left: `${at(p)}%` }}
          />
        ))}
        {/* The cheapest dot again on top, a size larger, so it reads even when other dots overlap. */}
        <span
          className={`absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cheapest shadow-sm ${lg ? "size-5" : "size-3.5"}`}
          style={{ left: `${at(min)}%` }}
        />
      </div>
      {labels && (
        <div aria-hidden className={`mt-1 flex items-baseline justify-between gap-2 tabular ${lg ? "text-base" : "text-sm"}`}>
          <span className="font-semibold text-cheapest">{taka(min)}{lg && <span className="ml-1 text-sm font-normal text-muted">{bn.lowest}</span>}</span>
          <span className="text-muted">{lg && <span className="mr-1 text-sm">{bn.highest}</span>}<span className="font-semibold text-ink">{taka(max)}</span></span>
        </div>
      )}
    </div>
  );
}
