// Display helpers for public pages: Bangla digits, taka, Dhaka dates. (Admin uses English digits.)
const BN = "০১২৩৪৫৬৭৮৯";
const num = new Intl.NumberFormat("bn-BD");
const date = new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "long", year: "numeric" });

export const bnDigits = (v: number | string) => String(v).replace(/\d/g, (d) => BN[Number(d)]!);

/** ৳১,২০০ (Bangla digits, South Asian grouping). */
export const taka = (n: number) => `৳${num.format(n)}`;

/** ১০ নভেম্বর, ২০২৬ — in Asia/Dhaka. */
export const bnDate = (d: Date) => date.format(d);

/** 6 → "৬ ঘণ্টা", 24 → "১ দিন", 30 → "৩০ ঘণ্টা". */
export function reportTime(hours: number | null): string | null {
  if (!hours) return null;
  if (hours >= 24 && hours % 24 === 0) return `${bnDigits(hours / 24)} দিন`;
  return `${bnDigits(hours)} ঘণ্টা`;
}
