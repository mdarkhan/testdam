// Booking request validation — pure, unit-tested (tests/booking.test.ts). The server action adds
// the database checks (lab + test price exists) and spam protection.
import { bn } from "@/i18n/bn";
import { addDhakaDays, dhakaDateString } from "./dates";
import { bnToAsciiDigits } from "./normalize";
import { normalizeBdMobile } from "./phone";

export const BOOKING_MAX_DAYS_AHEAD = 60;

export type BookingInput = {
  testSlug: string;
  labSlug: string;
  areaSlug?: string;
  name: string;
  phone: string;
  preferredDate: string; // YYYY-MM-DD (Dhaka)
  homeCollection: boolean;
  website?: string; // honeypot: humans never see or fill it
  attribution?: Partial<Record<"utmSource" | "utmMedium" | "utmCampaign" | "utmTerm" | "utmContent" | "referrer" | "landingPath", string>>;
};

export type BookingFields = { name: string; phone: string; preferredDate: string };

export function validateBooking(input: BookingInput, now = new Date()):
  | { ok: true; data: { name: string; phone: string; preferredDate: string } }
  | { ok: false; fieldErrors: Partial<Record<keyof BookingFields, string>> } {
  const fieldErrors: Partial<Record<keyof BookingFields, string>> = {};
  const name = (input.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) fieldErrors.name = bn.bookingErrors.name;

  const phone = normalizeBdMobile(input.phone ?? "");
  if (!phone) fieldErrors.phone = bn.bookingErrors.phone;

  const date = bnToAsciiDigits(input.preferredDate ?? "").trim();
  const today = dhakaDateString(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > addDhakaDays(today, BOOKING_MAX_DAYS_AHEAD)) fieldErrors.preferredDate = bn.bookingErrors.date;

  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return { ok: true, data: { name, phone: phone!, preferredDate: date } };
}

/** Keeps attribution strings short and drops anything that is not a plain value. */
export function cleanAttribution(a: BookingInput["attribution"]) {
  const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  return {
    utmSource: s(a?.utmSource, 200), utmMedium: s(a?.utmMedium, 200), utmCampaign: s(a?.utmCampaign, 200),
    utmTerm: s(a?.utmTerm, 200), utmContent: s(a?.utmContent, 200), referrer: s(a?.referrer, 500), landingPath: s(a?.landingPath, 300),
  };
}

export const BOOKING_STATUSES = ["NEW", "FORWARDED_TO_LAB", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;
export const COMMISSION_STATUSES = ["PENDING", "INVOICED", "PAID", "WAIVED"] as const;

// Booking codes: "TM-" + 5 characters without look-alikes (no 0/O, 1/I/L), easy to read out on
// the phone. 31^5 ≈ 28.6 million codes; the database's unique index catches the rare repeat.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateBookingCode(random: (n: number) => Uint32Array = (n) => crypto.getRandomValues(new Uint32Array(n))): string {
  return `TM-${[...random(5)].map((v) => CODE_ALPHABET[v % CODE_ALPHABET.length]).join("")}`;
}

/** Codes as people may type them back: "tm 7k3p9", "TM7K3P9" → "TM-7K3P9". */
export function normalizeBookingCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^TM([A-Z0-9]{1,8})$/.exec(s);
  return m ? `TM-${m[1]}` : null;
}
export const COMMISSION_LABEL: Record<(typeof COMMISSION_STATUSES)[number], string> = { PENDING: "Pending", INVOICED: "Invoiced", PAID: "Paid", WAIVED: "Waived" };
