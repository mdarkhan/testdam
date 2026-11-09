import { bnToAsciiDigits } from "./normalize";

/** Bangladeshi mobile → "01XXXXXXXXX", or null if invalid. Accepts +880 / 880 / 0 prefixes and Bangla digits. */
export function normalizeBdMobile(input: string): string | null {
  const digits = bnToAsciiDigits(input).replace(/[\s\-().]/g, "");
  const m = /^(?:\+?880|0)?(1[3-9]\d{8})$/.exec(digits);
  return m ? `0${m[1]}` : null;
}

/** Lab phone: a BD mobile (normalised) or a landline/hotline kept as typed (6–15 digits). */
export function normalizeLabPhone(input: string): string | null {
  const mobile = normalizeBdMobile(input);
  if (mobile) return mobile;
  const cleaned = bnToAsciiDigits(input).trim();
  const digitCount = cleaned.replace(/\D/g, "").length;
  return /^[+\d][\d\s\-()]*$/.test(cleaned) && digitCount >= 5 && digitCount <= 15 ? cleaned : null;
}
