import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, Field, Select, SubmitButton, TextArea } from "@/components/admin/form";
import { updateBooking, updateCommission } from "./actions";
import { BOOKING_STATUSES as STATUSES, COMMISSION_LABEL, COMMISSION_STATUSES, normalizeBookingCode } from "@/lib/booking";
import { normalizeBdMobile } from "@/lib/phone";
import { bpsToPercent } from "@/lib/commission";
import { btn } from "@/components/admin/styles";
import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Bookings" };

const STATUS_LABEL: Record<BookingStatus, string> = {
  NEW: "New", FORWARDED_TO_LAB: "Forwarded to lab", CONFIRMED: "Confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const STATUS_CLS: Record<BookingStatus, string> = {
  NEW: "bg-amber-100 text-amber-900", FORWARDED_TO_LAB: "bg-sky-100 text-sky-900", CONFIRMED: "bg-primary-soft text-primary",
  COMPLETED: "bg-cheapest-soft text-cheapest", CANCELLED: "bg-slate-200 text-slate-700",
};


const dt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
const d = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { status, q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 40);
  // Search by booking code ("tm 7k3p9" works too), patient phone or name; it overrides the status tabs.
  const code = q ? normalizeBookingCode(q) : null;
  const phone = q ? normalizeBdMobile(q) : null;
  const filter = (STATUSES as readonly string[]).includes(status ?? "") ? (status as BookingStatus) : undefined;
  const open = !status && !q; // default view: everything not finished
  const where: Prisma.BookingRequestWhereInput | undefined = q
    ? { OR: [...(code ? [{ code }] : []), ...(phone ? [{ phone }] : []), ...(!code && !phone ? [{ patientName: { contains: q, mode: "insensitive" as const } }] : [])] }
    : filter ? { status: filter } : open ? { status: { in: ["NEW", "FORWARDED_TO_LAB", "CONFIRMED"] } } : undefined;
  const [bookings, counts] = await Promise.all([
    db.bookingRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        test: { select: { nameEn: true, nameBn: true, shortName: true } },
        lab: { select: { id: true, name: true, branchName: true, phone: true, whatsapp: true, commissionBps: true } },
        items: { orderBy: { id: "asc" }, select: { priceAtRequest: true, test: { select: { nameEn: true, nameBn: true, shortName: true } } } },
      },
    }),
    db.bookingRequest.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: BookingStatus) => counts.find((c) => c.status === s)?._count ?? 0;

  const tab = (href: string, label: string, active: boolean) => (
    <Link key={href} href={href} className={`rounded-full px-3 py-2 text-sm ${active ? "bg-primary text-white" : "border border-line bg-white hover:border-primary"}`}>{label}</Link>
  );

  return (
    <>
      <h1 className="text-xl font-semibold">Booking requests</h1>
      <p className="mt-1 text-sm text-muted">Call the patient or forward to the lab, then update the status. Times are Dhaka time.</p>
      <nav aria-label="Status filter" className="mt-4 flex flex-wrap gap-2">
        {tab("/admin/bookings", "Open", open)}
        {STATUSES.map((s) => tab(`/admin/bookings?status=${s}`, `${STATUS_LABEL[s]} (${count(s)})`, filter === s && !q))}
      </nav>
      <form action="/admin/bookings" className="mt-3 flex max-w-md gap-2">
        <label htmlFor="bq" className="sr-only">Find a booking</label>
        <input id="bq" name="q" defaultValue={q} placeholder="Booking code (TM-…), phone or name" className="min-h-11 w-full rounded-md border border-slate-300 px-3" />
        <button className={btn("plain")}>Find</button>
      </form>
      {q && <p className="mt-2 text-sm text-muted">{bookings.length} result(s) for “{q}”. <Link href="/admin/bookings" className="text-primary underline">Clear</Link></p>}

      {!bookings.length && <p className="mt-6 rounded-lg border border-line bg-white p-4 text-sm text-muted">No booking requests here.</p>}
      <ul className="mt-4 space-y-3">
        {bookings.map((b) => {
          const test = b.test.shortName ?? b.test.nameEn;
          const lab = `${b.lab.name}${b.lab.branchName ? ` · ${b.lab.branchName}` : ""}`;
          const date = d.format(b.preferredDate);
          // Basket booking: several tests (items), priceAtRequest is their total.
          const multi = b.items.length > 0;
          const testLines = multi
            ? b.items.map((i) => `${i.test.nameEn} (${i.test.nameBn}) ৳${i.priceAtRequest}`).join("\n")
            : `${b.test.nameEn} (${b.test.nameBn})`;
          const discount = b.partnerDiscountPct ? `\nPartner discount promised: ${b.partnerDiscountPct}% with this code` : "";
          const forward = `Test Mate booking ${b.code ?? `#${b.id}`}\n${multi ? `Tests (${b.items.length}):\n` : "Test: "}${testLines}\nPatient: ${b.patientName}\nPhone: ${b.phone}\nPreferred date: ${date}\nHome collection: ${b.homeCollection ? "Yes" : "No"}\n${multi ? "Total shown" : "Price shown"}: ৳${b.priceAtRequest}${discount}`;
          return (
            <li key={b.id} className="rounded-lg border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">#{b.id}</span>
                {b.code && <span className="rounded bg-slate-100 px-2 py-0.5 font-mono font-semibold">{b.code}</span>}
                {b.partnerDiscountPct ? <span className="text-xs text-cheapest">promised {b.partnerDiscountPct}% off</span> : null}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                <span className="text-muted">{dt.format(b.createdAt)}</span>
              </div>
              <div className="mt-2 grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <p className="font-semibold">{b.patientName}</p>
                  <a href={`tel:${b.phone}`} className="tabular text-primary underline">{b.phone}</a>
                  <p className="mt-1">Wants: <strong>{date}</strong>{b.homeCollection && " · home collection"}</p>
                </div>
                <div>
                  {multi ? (
                    <>
                      <p><strong>{b.items.length} tests</strong> at {lab}</p>
                      <ul className="tabular my-1 list-disc pl-5">
                        {b.items.map((i, n) => <li key={n}>{i.test.shortName ?? i.test.nameEn}: ৳{i.priceAtRequest}</li>)}
                      </ul>
                      <p className="tabular">Total shown: ৳{b.priceAtRequest} · area: {b.areaSlug ?? "—"}</p>
                    </>
                  ) : (
                    <>
                      <p><strong>{test}</strong> at {lab}</p>
                      <p className="tabular">Price shown: ৳{b.priceAtRequest} · area: {b.areaSlug ?? "—"}</p>
                    </>
                  )}
                  <p className="mt-1 flex flex-wrap gap-3">
                    <a href={`tel:${b.lab.phone.replace(/[^\d+]/g, "")}`} className="text-primary underline">Call lab</a>
                    {b.lab.whatsapp && (
                      <a href={`https://wa.me/88${b.lab.whatsapp}?text=${encodeURIComponent(forward)}`} target="_blank" rel="noopener" className="text-primary underline">Forward on WhatsApp</a>
                    )}
                    <Link href={`/admin/labs/${b.lab.id}/prices`} className="text-primary underline">Lab prices</Link>
                  </p>
                </div>
                <div className="text-xs text-muted">
                  {(b.utmSource || b.utmMedium || b.utmCampaign) && <p>UTM: {[b.utmSource, b.utmMedium, b.utmCampaign, b.utmTerm, b.utmContent].filter(Boolean).join(" / ")}</p>}
                  {b.referrer && <p className="break-all">From: {b.referrer}</p>}
                  {b.landingPath && <p className="break-all">Landed on: {b.landingPath}</p>}
                </div>
              </div>
              {/* key: re-mount when the saved values change (e.g. a bill set the status to Completed), so the form never shows stale values. */}
              <ActionForm key={`s-${b.status}`} action={updateBooking.bind(null, b.id)} className="mt-3 border-t border-line pt-3">
                <div className="grid items-end gap-3 md:grid-cols-[14rem_1fr_auto]">
                  <Select label="Status" name="status" defaultValue={b.status}>
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </Select>
                  <TextArea label="Notes" name="notes" rows={1} defaultValue={b.notes ?? ""} />
                  <SubmitButton>Save</SubmitButton>
                </div>
              </ActionForm>
              {isAdmin && b.status !== "CANCELLED" && (
                <details open={b.billAmount != null} className="mt-3 border-t border-line pt-3">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                    Commission{b.commissionAmount != null && `: ৳${b.commissionAmount} (${COMMISSION_LABEL[b.commissionStatus ?? "PENDING"]})`}
                  </summary>
                  <ActionForm key={`c-${b.billAmount}-${b.commissionBps}-${b.commissionStatus}-${b.testedOn?.getTime()}`} action={updateCommission.bind(null, b.id)} className="mt-2">
                    <div className="grid items-end gap-3 md:grid-cols-[11rem_10rem_9rem_11rem_auto]">
                      <Field label="Test date" name="testedOn" type="date" defaultValue={b.testedOn ? b.testedOn.toISOString().slice(0, 10) : b.preferredDate.toISOString().slice(0, 10)} />
                      <Field label="Bill paid (৳)" name="billAmount" type="number" min={0} defaultValue={b.billAmount ?? ""} hint="Blank = clear" />
                      <Field label="Commission %" name="commissionPct" inputMode="decimal" defaultValue={b.commissionBps != null ? bpsToPercent(b.commissionBps) : ""}
                        placeholder={b.lab.commissionBps != null ? bpsToPercent(b.lab.commissionBps) : "—"} hint={b.lab.commissionBps != null ? "Blank = lab rate" : "Lab has no rate"} />
                      <Select label="Status" name="commissionStatus" defaultValue={b.commissionStatus ?? "PENDING"}>
                        {COMMISSION_STATUSES.map((s) => <option key={s} value={s}>{COMMISSION_LABEL[s]}</option>)}
                      </Select>
                      <SubmitButton>Save commission</SubmitButton>
                    </div>
                    {b.commissionPaidAt && <p className="mt-1 text-xs text-muted">Paid on {dt.format(b.commissionPaidAt)}</p>}
                  </ActionForm>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
