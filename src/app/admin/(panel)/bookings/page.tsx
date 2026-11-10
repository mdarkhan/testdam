import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, Select, SubmitButton, TextArea } from "@/components/admin/form";
import { updateBooking } from "./actions";
import { BOOKING_STATUSES as STATUSES } from "@/lib/booking";
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

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser();
  const { status } = await searchParams;
  const filter = (STATUSES as readonly string[]).includes(status ?? "") ? (status as BookingStatus) : undefined;
  const open = !status; // default view: everything not finished
  const [bookings, counts] = await Promise.all([
    db.bookingRequest.findMany({
      where: filter ? { status: filter } : open ? { status: { in: ["NEW", "FORWARDED_TO_LAB", "CONFIRMED"] } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        test: { select: { nameEn: true, nameBn: true, shortName: true } },
        lab: { select: { id: true, name: true, branchName: true, phone: true, whatsapp: true } },
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
        {STATUSES.map((s) => tab(`/admin/bookings?status=${s}`, `${STATUS_LABEL[s]} (${count(s)})`, filter === s))}
      </nav>

      {!bookings.length && <p className="mt-6 rounded-lg border border-line bg-white p-4 text-sm text-muted">No booking requests here.</p>}
      <ul className="mt-4 space-y-3">
        {bookings.map((b) => {
          const test = b.test.shortName ?? b.test.nameEn;
          const lab = `${b.lab.name}${b.lab.branchName ? ` · ${b.lab.branchName}` : ""}`;
          const date = d.format(b.preferredDate);
          const forward = `Test Mate booking #${b.id}\nTest: ${b.test.nameEn} (${b.test.nameBn})\nPatient: ${b.patientName}\nPhone: ${b.phone}\nPreferred date: ${date}\nHome collection: ${b.homeCollection ? "Yes" : "No"}\nPrice shown: ৳${b.priceAtRequest}`;
          return (
            <li key={b.id} className="rounded-lg border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">#{b.id}</span>
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
                  <p><strong>{test}</strong> at {lab}</p>
                  <p className="tabular">Price shown: ৳{b.priceAtRequest} · area: {b.areaSlug ?? "—"}</p>
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
              <ActionForm action={updateBooking.bind(null, b.id)} className="mt-3 border-t border-line pt-3">
                <div className="grid items-end gap-3 md:grid-cols-[14rem_1fr_auto]">
                  <Select label="Status" name="status" defaultValue={b.status}>
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </Select>
                  <TextArea label="Notes" name="notes" rows={1} defaultValue={b.notes ?? ""} />
                  <SubmitButton>Save</SubmitButton>
                </div>
              </ActionForm>
            </li>
          );
        })}
      </ul>
    </>
  );
}
