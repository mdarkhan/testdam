"use client";
// One listener for every price card on the page: tracks call/WhatsApp taps and opens the booking
// dialog. Also fires `view_test_prices` once when a test page loads.
import { useEffect, useRef, useState } from "react";
import { bn } from "@/i18n/bn";
import { bnDigits, taka } from "@/lib/format";
import { addDhakaDays, dhakaDateString } from "@/lib/dates";
import { readAttribution, track } from "@/lib/analytics";
import { createBooking } from "@/app/(public)/actions";

type Target = { labSlug: string; labName: string; areaSlug: string; price: number; homeAvailable: boolean };
type Errors = Partial<Record<"name" | "phone" | "preferredDate", string>>;

export function PriceInteractions({ testSlug, testName, pageAreaSlug, view }: {
  testSlug?: string; testName?: string; pageAreaSlug?: string;
  view?: { labCount: number; minPrice: number };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const viewed = useRef(false);

  // view_test_prices — once per page load (StrictMode-safe).
  useEffect(() => {
    if (!view || !testSlug || viewed.current) return;
    viewed.current = true;
    track("view_test_prices", { test_slug: testSlug, area_slug: pageAreaSlug, lab_count: view.labCount, min_price: view.minPrice });
  }, [view, testSlug, pageAreaSlug]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!el) return;
      const card = el.closest<HTMLElement>("[data-price-row]") ?? el;
      const ctx = { test_slug: testSlug, lab_slug: card.dataset.lab, area_slug: pageAreaSlug ?? card.dataset.area };
      const action = el.dataset.action;
      if (action === "call") track("call_click", ctx);
      else if (action === "whatsapp") track("whatsapp_click", ctx);
      else if (action === "book" && testSlug) {
        const t: Target = {
          labSlug: card.dataset.lab ?? "", labName: card.dataset.labName ?? "", areaSlug: ctx.area_slug ?? "",
          price: Number(card.dataset.price), homeAvailable: card.dataset.home === "1",
        };
        setTarget(t);
        setErrors({}); setMessage(null); setDone(null);
        dialogRef.current?.showModal();
        track("booking_form_open", { ...ctx, price: t.price });
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [testSlug, pageAreaSlug]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!target || !testSlug || pending) return;
    const f = new FormData(e.currentTarget);
    setPending(true);
    try {
      const res = await createBooking({
        testSlug, labSlug: target.labSlug, areaSlug: target.areaSlug,
        name: String(f.get("name") ?? ""), phone: String(f.get("phone") ?? ""), preferredDate: String(f.get("preferredDate") ?? ""),
        homeCollection: f.get("homeCollection") === "on", website: String(f.get("website") ?? ""),
        attribution: readAttribution(),
      });
      if (res.ok) {
        setDone(res.id ?? 0);
        // Only after the server confirmed the saved booking. No name/phone in the event.
        if (res.id) track("generate_lead", { test_slug: testSlug, lab_slug: target.labSlug, area_slug: target.areaSlug, price: res.price, booking_id: res.id });
      } else {
        setErrors(res.fieldErrors ?? {});
        setMessage(res.message);
      }
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
    <dialog ref={dialogRef} aria-labelledby="booking-title"
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl p-0 backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:rounded-2xl">
      {target && (
        <div className="p-4">
          <h2 id="booking-title" className="text-lg font-semibold">{bn.bookingTitle(testName ?? "", target.labName)}</h2>
          <p className="tabular text-sm text-muted">{bn.bookingPrice(taka(target.price))}</p>
          {done !== null ? (
            <div role="status" className="mt-4">
              <p className="text-lg font-semibold text-cheapest">{bn.bookingDone}</p>
              <p className="mt-1">{bn.bookingDoneBody(bnDigits(done))}</p>
              <button type="button" onClick={() => dialogRef.current?.close()} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-lg bg-primary font-semibold text-white">{bn.bookingClose}</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-3 space-y-3">
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
              {target.homeAvailable && (
                <label className="flex min-h-12 items-center gap-3 text-base">
                  <input type="checkbox" name="homeCollection" className="size-5 accent-primary" /> {bn.bookingHome}
                </label>
              )}
              {/* Honeypot: hidden from people and screen readers; bots tend to fill every field. */}
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => dialogRef.current?.close()} className="flex min-h-12 items-center justify-center rounded-lg border-2 border-slate-300 font-semibold">{bn.bookingCancel}</button>
                <button type="submit" disabled={pending} className="flex min-h-12 items-center justify-center rounded-lg bg-primary font-semibold text-white disabled:opacity-60">
                  {pending ? bn.bookingSending : bn.bookingSubmit}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </dialog>
  );
}
