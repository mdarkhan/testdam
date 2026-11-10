// "পার্টনার ল্যাব" badge + the discount it gives for a Test Mate booking code. A label only:
// ranking code never reads isPartner (src/lib/pricing.ts), so partners never move up the list.
import { bn } from "@/i18n/bn";
import { bnDigits } from "@/lib/format";

type PartnerLab = { isPartner: boolean; partnerDiscountPct: number | null };

export function PartnerBadge({ lab }: { lab: PartnerLab }) {
  if (!lab.isPartner) return null;
  return <span className="rounded-full bg-primary-soft px-3 py-0.5 text-primary ring-1 ring-primary/30">{bn.partner}</span>;
}

export function PartnerDiscount({ lab, className = "" }: { lab: PartnerLab; className?: string }) {
  if (!lab.isPartner || !lab.partnerDiscountPct) return null;
  return <p className={`text-sm font-semibold text-cheapest ${className}`}>{bn.partnerDiscount(bnDigits(lab.partnerDiscountPct))}</p>;
}
