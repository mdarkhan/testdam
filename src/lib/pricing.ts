// Single source of truth for freshness and effective price.
// Ranking and thin-content eligibility are added here in Phase 2.
import { config } from "./config";
import { daysBetween } from "./dates";

export type PriceLike = {
  regularPrice: number;
  discountPrice: number | null;
  discountExpiresAt: Date | null;
  verifiedAt: Date;
};

export function isFresh(p: Pick<PriceLike, "verifiedAt">, now = new Date(), freshDays = config.freshDays): boolean {
  return daysBetween(p.verifiedAt, now) <= freshDays;
}

export function hasActiveDiscount(p: PriceLike, now = new Date()): boolean {
  return p.discountPrice != null && p.discountPrice < p.regularPrice && (p.discountExpiresAt == null || p.discountExpiresAt >= now);
}

export function effectivePrice(p: PriceLike, now = new Date()): number {
  return hasActiveDiscount(p, now) ? (p.discountPrice as number) : p.regularPrice;
}

/** Prices verified before this instant are stale (for database queries). */
export function staleCutoff(now = new Date(), freshDays = config.freshDays): Date {
  return new Date(now.getTime() - freshDays * 86_400_000);
}
