"use client";
// The booking form inside the dialog, shared by single-test bookings (price cards) and basket
// bookings (several tests at one lab). The caller supplies the server call; this handles fields,
// errors, the pending state and the "sent" screen. Mount it with a new `key` per opening.
import { useState } from "react";
import { bn } from "@/i18n/bn";
import { bnDigits } from "@/lib/format";
import { addDhakaDays, dhakaDateString } from "@/lib/dates";
import type { BookingResult } from "@/app/(public)/actions";

export type BookingFormValues = { name: string; phone: string; preferredDate: string; homeCollection: boolean; website: string };
type Errors = Partial<Record<"name" | "phone" | "preferredDate", string>>;

export function BookingForm({ title, lines, homeAvailable, submit, onClose }: {
  title: string;
  lines: string[]; // shown under the title (price, list of tests…)
  homeAvailable: boolean;
  submit: (v: BookingFormValues) => Promise<BookingResult>;
  onClose: () => void;
}) {
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.currentTarget);
    setPending(true);
    try {
      const res = await submit({
        name: String(f.get("name") ?? ""), phone: String(f.get("phone") ?? ""), preferredDate: String(f.get("preferredDate") ?? ""),
        homeCollection: f.get("homeCollection") === "on", website: String(f.get("website") ?? ""),
      });
      if (res.ok) setDone(res.id ?? 0);
      else { setErrors(res.fieldErrors ?? {}); setMessage(res.message); }
    } catch {
      setMessage(bn.bookingErrors.server);
    } finally {
      setPending(false);
    }
  }

  const today = dhakaDateString(new Date());
  const field = "mt-1 block min-h-12 w-full rounded-lg border-2 border-slate-300 px-3 text-base focus:border-primary aria-[invalid=true]:border-danger";
  const err = (k: keyof Errors) => errors[k] && <p id={`b-${k}-err`} className="mt-1 text-sm text-danger">{errors[k]}</p>;

  return (
    <div className="max-h-[90dvh] overflow-y-auto p-4">
      <h2 id="booking-title" className="text-lg font-semibold">{title}</h2>
      {lines.map((l) => <p key={l} className="tabular text-sm text-muted">{l}</p>)}
      {done !== null ? (
        <div role="status" className="mt-4">
          <p className="text-lg font-semibold text-cheapest">{bn.bookingDone}</p>
          <p className="mt-1">{bn.bookingDoneBody(bnDigits(done))}</p>
          <button type="button" onClick={onClose} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-lg bg-primary font-semibold text-white">{bn.bookingClose}</button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-3 space-y-3">
          <p className="text-sm">{bn.bookingIntro}</p>
          {message && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{message}</p>}
          <label className="block text-sm font-semibold">{bn.bookingName}
            <input name="name" autoComplete="name" required aria-invalid={!!errors.name} aria-describedby={errors.name ? "b-name-err" : undefined} className={field} />
          </label>
          {err("name")}
          <label className="block text-sm font-semibold">{bn.bookingPhone}
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder={bn.bookingPhoneHint}
              aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "b-phone-err" : undefined} className={field} />
          </label>
          {err("phone")}
          <label className="block text-sm font-semibold">{bn.bookingDate}
            <input name="preferredDate" type="date" required min={today} max={addDhakaDays(today, 60)} defaultValue={addDhakaDays(today, 1)}
              aria-invalid={!!errors.preferredDate} aria-describedby={errors.preferredDate ? "b-preferredDate-err" : undefined} className={field} />
          </label>
          {err("preferredDate")}
          {homeAvailable && (
            <label className="flex min-h-12 items-center gap-3 text-base">
              <input type="checkbox" name="homeCollection" className="size-5 accent-primary" /> {bn.bookingHome}
            </label>
          )}
          {/* Honeypot: hidden from people and screen readers; bots tend to fill every field. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex min-h-12 items-center justify-center rounded-lg border-2 border-slate-300 font-semibold">{bn.bookingCancel}</button>
            <button type="submit" disabled={pending} className="flex min-h-12 items-center justify-center rounded-lg bg-primary font-semibold text-white disabled:opacity-60">
              {pending ? bn.bookingSending : bn.bookingSubmit}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
