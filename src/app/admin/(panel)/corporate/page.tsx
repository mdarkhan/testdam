import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CORPORATE_STATUSES as STATUSES } from "@/lib/corporate";
import { ActionForm, Select, SubmitButton, TextArea } from "@/components/admin/form";
import type { CorporateStatus } from "@/generated/prisma/enums";
import { updateCorporate } from "./actions";

export const metadata = { title: "Company requests" };

const LABEL: Record<CorporateStatus, string> = { NEW: "New", CONTACTED: "Contacted", QUOTED: "Quote sent", WON: "Won", LOST: "Lost" };
const CLS: Record<CorporateStatus, string> = {
  NEW: "bg-amber-100 text-amber-900", CONTACTED: "bg-sky-100 text-sky-900", QUOTED: "bg-primary-soft text-primary",
  WON: "bg-cheapest-soft text-cheapest", LOST: "bg-slate-200 text-slate-700",
};
const dt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });

export default async function CorporatePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser();
  const { status } = await searchParams;
  const filter = (STATUSES as readonly string[]).includes(status ?? "") ? (status as CorporateStatus) : undefined;
  const open = !status;
  const [reqs, counts] = await Promise.all([
    db.corporateRequest.findMany({
      where: filter ? { status: filter } : open ? { status: { in: ["NEW", "CONTACTED", "QUOTED"] } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.corporateRequest.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: CorporateStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const tab = (href: string, label: string, active: boolean) => (
    <Link key={href} href={href} className={`rounded-full px-3 py-2 text-sm ${active ? "bg-primary text-white" : "border border-line bg-white hover:border-primary"}`}>{label}</Link>
  );

  return (
    <>
      <h1 className="text-xl font-semibold">Company check-up requests</h1>
      <p className="mt-1 text-sm text-muted">From the public page /corporate. Call the contact, collect prices from labs (the test list helps), send a quote, then update the status.</p>
      <nav aria-label="Status filter" className="mt-4 flex flex-wrap gap-2">
        {tab("/admin/corporate", "Open", open)}
        {STATUSES.map((s) => tab(`/admin/corporate?status=${s}`, `${LABEL[s]} (${count(s)})`, filter === s))}
      </nav>

      {!reqs.length && <p className="mt-6 rounded-lg border border-line bg-white p-4 text-sm text-muted">No requests here.</p>}
      <ul className="mt-4 space-y-3">
        {reqs.map((r) => (
          <li key={r.id} className="rounded-lg border border-line bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">#{r.id}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CLS[r.status]}`}>{LABEL[r.status]}</span>
              <span className="text-muted">{dt.format(r.createdAt)}</span>
            </div>
            <div className="mt-2 grid gap-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-base font-semibold">{r.companyName}</p>
                <p>{r.employees} employees{r.area && `, ${r.area}`}</p>
              </div>
              <div>
                <p className="font-semibold">{r.contactName}</p>
                <a href={`tel:${r.phone}`} className="tabular text-primary underline">{r.phone}</a>
                {r.email && <p><a href={`mailto:${r.email}`} className="break-all text-primary underline">{r.email}</a></p>}
              </div>
              <div className="text-xs text-muted">
                {(r.utmSource || r.utmMedium || r.utmCampaign) && <p>UTM: {[r.utmSource, r.utmMedium, r.utmCampaign, r.utmTerm, r.utmContent].filter(Boolean).join(" / ")}</p>}
                {r.referrer && <p className="break-all">From: {r.referrer}</p>}
                {r.landingPath && <p className="break-all">Landed on: {r.landingPath}</p>}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{r.needs}</p>
            <ActionForm action={updateCorporate.bind(null, r.id)} className="mt-3 border-t border-line pt-3">
              <div className="grid items-end gap-3 md:grid-cols-[14rem_1fr_auto]">
                <Select label="Status" name="status" defaultValue={r.status}>
                  {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                </Select>
                <TextArea label="Notes" name="notes" rows={1} defaultValue={r.notes ?? ""} />
                <SubmitButton>Save</SubmitButton>
              </div>
            </ActionForm>
          </li>
        ))}
      </ul>
    </>
  );
}
