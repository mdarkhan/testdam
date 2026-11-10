"use client";
// Company check-up request form (/corporate). Errors sit under their fields; the honeypot and the
// rate limits are the same kind as on bookings. No company or personal data goes to analytics.
import { useRef, useState } from "react";
import { bn } from "@/i18n/bn";
import { readAttribution, track } from "@/lib/analytics";
import { createCorporateRequest } from "@/app/(public)/actions";
import type { CorporateFields } from "@/lib/corporate";

type Errors = Partial<Record<CorporateFields, string>>;

export function CorporateForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    setPending(true);
    try {
      const res = await createCorporateRequest({
        companyName: get("companyName"), contactName: get("contactName"), phone: get("phone"), email: get("email"),
        employees: get("employees"), area: get("area"), needs: get("needs"), website: get("website"), attribution: readAttribution(),
      });
      if (res.ok) {
        setDone(true);
        if (res.id) track("corporate_lead", { lead_id: res.id, employee_count: res.employees }); // server-parsed (Bangla digits too)
      } else {
        setErrors(res.fieldErrors ?? {});
        setMessage(res.message);
        // Focus the first field with an error so keyboard and screen-reader users land on it.
        const first = Object.keys(res.fieldErrors ?? {})[0];
        if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      }
    } catch {
      setMessage(bn.bookingErrors.server);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-xl border-2 border-cheapest bg-cheapest-soft p-5">
        <p className="text-lg font-semibold text-cheapest">{bn.corpDone}</p>
        <p className="mt-1">{bn.corpDoneBody}</p>
      </div>
    );
  }

  const field = "mt-1 block min-h-12 w-full rounded-lg border-2 border-slate-300 bg-white px-3 text-base focus:border-primary aria-[invalid=true]:border-danger";
  const input = (name: CorporateFields | "area", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`c-${name}`} className="block text-sm font-semibold">{label}</label>
      <input id={`c-${name}`} name={name} className={field} aria-invalid={!!errors[name as CorporateFields]}
        aria-describedby={errors[name as CorporateFields] ? `c-${name}-err` : undefined} {...props} />
      {errors[name as CorporateFields] && <p id={`c-${name}-err`} className="mt-1 text-sm text-danger">{errors[name as CorporateFields]}</p>}
    </div>
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      {message && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{message}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {input("companyName", bn.corpCompany, { autoComplete: "organization", required: true })}
        {input("contactName", bn.corpContact, { autoComplete: "name", required: true })}
        {input("phone", bn.corpPhone, { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: bn.bookingPhoneHint, required: true })}
        {input("email", bn.corpEmail, { type: "email", inputMode: "email", autoComplete: "email" })}
        {input("employees", bn.corpEmployees, { inputMode: "numeric", required: true })}
        {input("area", bn.corpArea)}
      </div>
      <div>
        <label htmlFor="c-needs" className="block text-sm font-semibold">{bn.corpNeeds}</label>
        <textarea id="c-needs" name="needs" rows={4} required aria-invalid={!!errors.needs}
          aria-describedby={errors.needs ? "c-needs-err" : "c-needs-hint"}
          className="mt-1 block w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-base focus:border-primary aria-[invalid=true]:border-danger" />
        {errors.needs
          ? <p id="c-needs-err" className="mt-1 text-sm text-danger">{errors.needs}</p>
          : <p id="c-needs-hint" className="mt-1 text-sm text-muted">{bn.corpNeedsHint}</p>}
      </div>
      {/* Honeypot: hidden from people and screen readers; bots tend to fill every field. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center rounded-lg bg-primary px-6 font-semibold text-white hover:bg-primary-hover disabled:opacity-60 sm:w-auto">
        {pending ? bn.corpSending : bn.corpSubmit}
      </button>
    </form>
  );
}
