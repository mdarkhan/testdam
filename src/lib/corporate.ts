// Company check-up request validation — pure, unit-tested (tests/corporate.test.ts).
import { bn } from "@/i18n/bn";
import { bnToAsciiDigits } from "./normalize";
import { normalizeBdMobile } from "./phone";

export const CORPORATE_STATUSES = ["NEW", "CONTACTED", "QUOTED", "WON", "LOST"] as const;

export type CorporateInput = {
  companyName: string; contactName: string; phone: string; email?: string; employees: string; area?: string; needs: string;
  website?: string; // honeypot
};
export type CorporateFields = "companyName" | "contactName" | "phone" | "email" | "employees" | "needs";
export type CorporateData = { companyName: string; contactName: string; phone: string; email: string | null; employees: number; area: string | null; needs: string };

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/[ \t]+/g, " ").slice(0, max) : "");

export function validateCorporate(input: CorporateInput):
  | { ok: true; data: CorporateData }
  | { ok: false; fieldErrors: Partial<Record<CorporateFields, string>> } {
  const e: Partial<Record<CorporateFields, string>> = {};
  const companyName = clean(input.companyName, 200);
  if (companyName.length < 2) e.companyName = bn.corpErrors.companyName;
  const contactName = clean(input.contactName, 120);
  if (contactName.length < 2) e.contactName = bn.corpErrors.contactName;
  const phone = normalizeBdMobile(clean(input.phone, 40));
  if (!phone) e.phone = bn.corpErrors.phone;
  const email = clean(input.email, 200).toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = bn.corpErrors.email;
  const empText = bnToAsciiDigits(clean(input.employees, 10)).replace(/,/g, "");
  const employees = /^\d{1,6}$/.test(empText) ? Number(empText) : Number.NaN;
  if (!(employees >= 1 && employees <= 100_000)) e.employees = bn.corpErrors.employees;
  const needs = clean(input.needs, 2000);
  if (needs.length < 3) e.needs = bn.corpErrors.needs;
  const area = clean(input.area, 120) || null;
  if (Object.keys(e).length) return { ok: false, fieldErrors: e };
  return { ok: true, data: { companyName, contactName, phone: phone!, email, employees, area, needs } };
}
