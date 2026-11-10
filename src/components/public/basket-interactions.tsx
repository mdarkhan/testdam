"use client";
// /basket: one listener for the lab cards (call taps, "book all these tests") and the booking
// dialog. Analytics use the same events as single bookings, with test_slug = "cbc,fbs,…".
import { useEffect, useRef, useState } from "react";
import { bn } from "@/i18n/bn";
import { bnDigits, taka } from "@/lib/format";
import { readAttribution, track } from "@/lib/analytics";
import { createBasketBooking } from "@/app/(public)/actions";
import { BookingForm } from "./booking-form";

type Target = { key: number; labSlug: string; labName: string; areaSlug: string; price: number; homeAvailable: boolean };

export function BasketInteractions({ testSlugs, testNames }: { testSlugs: string[]; testNames: string[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const testKey = testSlugs.join(",");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!el) return;
      const card = el.closest<HTMLElement>("[data-price-row]") ?? el;
      const ctx = { test_slug: testKey, lab_slug: card.dataset.lab, area_slug: card.dataset.area };
      if (el.dataset.action === "call") track("call_click", ctx);
      else if (el.dataset.action === "book-basket") {
        const t: Target = {
          key: Date.now(), labSlug: card.dataset.lab ?? "", labName: card.dataset.labName ?? "", areaSlug: card.dataset.area ?? "",
          price: Number(card.dataset.price), homeAvailable: card.dataset.home === "1",
        };
        setTarget(t);
        dialogRef.current?.showModal();
        track("booking_form_open", { ...ctx, price: t.price });
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [testKey]);

  return (
    <dialog ref={dialogRef} aria-labelledby="booking-title"
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl p-0 backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:rounded-2xl">
      {target && (
        <BookingForm
          key={target.key}
          title={bn.basketBookTitle(bnDigits(testSlugs.length), target.labName)}
          lines={[bn.basketBookTests(testNames.join(", ")), bn.basketBookTotal(taka(target.price))]}
          homeAvailable={target.homeAvailable}
          onClose={() => dialogRef.current?.close()}
          submit={async (v) => {
            const res = await createBasketBooking({ testSlugs, labSlug: target.labSlug, ...v, attribution: readAttribution() });
            if (res.ok && res.id) track("generate_lead", { test_slug: testKey, lab_slug: target.labSlug, area_slug: target.areaSlug, price: res.price, booking_id: res.id });
            return res;
          }}
        />
      )}
    </dialog>
  );
}
