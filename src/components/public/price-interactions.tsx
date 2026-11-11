"use client";
// One listener for every price card on the page: tracks call/WhatsApp taps and opens the booking
// dialog. Also fires `view_test_prices` once when a test page loads.
import { useEffect, useRef, useState } from "react";
import { bn } from "@/i18n/bn";
import { taka } from "@/lib/format";
import { readAttribution, track } from "@/lib/analytics";
import { createBooking } from "@/app/(public)/actions";
import { BookingForm } from "./booking-form";

type Target = { key: number; testSlug: string; testName: string; labSlug: string; labName: string; areaSlug: string; price: number; homeAvailable: boolean };

export function PriceInteractions({ testSlug, testName, pageAreaSlug, view }: {
  testSlug?: string; testName?: string; pageAreaSlug?: string;
  view?: { labCount: number; minPrice: number };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<Target | null>(null);
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
      // Test pages pass the test; a lab page lists many tests, so each row names its own (data-test).
      const rowTest = testSlug ?? card.dataset.test;
      const ctx = { test_slug: rowTest, lab_slug: card.dataset.lab, area_slug: pageAreaSlug ?? card.dataset.area };
      const action = el.dataset.action;
      if (action === "call") track("call_click", ctx);
      else if (action === "whatsapp") track("whatsapp_click", ctx);
      else if (action === "book" && rowTest) {
        const t: Target = {
          key: Date.now(), testSlug: rowTest, testName: testName ?? card.dataset.testName ?? "", labSlug: card.dataset.lab ?? "", labName: card.dataset.labName ?? "", areaSlug: ctx.area_slug ?? "",
          price: Number(card.dataset.price), homeAvailable: card.dataset.home === "1",
        };
        setTarget(t);
        dialogRef.current?.showModal();
        track("booking_form_open", { ...ctx, price: t.price });
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [testSlug, testName, pageAreaSlug]);

  return (
    <dialog ref={dialogRef} aria-labelledby="booking-title"
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl p-0 backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:rounded-2xl">
      {target && (
        <BookingForm
          key={target.key}
          title={bn.bookingTitle(target.testName, target.labName)}
          lines={[bn.bookingPrice(taka(target.price))]}
          homeAvailable={target.homeAvailable}
          onClose={() => dialogRef.current?.close()}
          submit={async (v) => {
            const res = await createBooking({ testSlug: target.testSlug, labSlug: target.labSlug, areaSlug: target.areaSlug, ...v, attribution: readAttribution() });
            // Only after the server confirmed the saved booking. No name/phone in the event.
            if (res.ok && res.id) track("generate_lead", { test_slug: target.testSlug, lab_slug: target.labSlug, area_slug: target.areaSlug, price: res.price, booking_id: res.id });
            return res;
          }}
        />
      )}
    </dialog>
  );
}
