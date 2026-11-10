import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { bpsToPercent, statementTotals } from "@/lib/commission";
import { COMMISSION_LABEL } from "@/lib/booking";
import { loadStatementRows, pickMonth } from "@/lib/statements";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { btn, tableCls } from "@/components/admin/styles";
import { PrintButton } from "@/components/admin/print-button";
import { markStatement } from "../actions";

export const metadata = { title: "Commission statement" };

const monthName = (ym: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));
const tk = (n: number) => `৳${n.toLocaleString("en-IN")}`;

export default async function StatementPage({ params, searchParams }: { params: Promise<{ labId: string }>; searchParams: Promise<{ month?: string }> }) {
  await requireUser("ADMIN");
  const labId = Number((await params).labId);
  if (!Number.isInteger(labId)) notFound();
  const month = pickMonth((await searchParams).month);
  const lab = await db.lab.findUnique({ where: { id: labId }, select: { name: true, branchName: true, address: true, commissionBps: true, partnerDiscountPct: true } });
  if (!lab) notFound();
  const rows = (await loadStatementRows(month, labId)).map((r) => ({ id: r.id, ...r.row }));
  const t = statementTotals(rows);
  const labName = `${lab.name}${lab.branchName ? ` (${lab.branchName})` : ""}`;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/admin/commissions?month=${month}`} className="text-sm text-primary underline">← All labs, {monthName(month)}</Link>
        <span className="ml-auto flex flex-wrap gap-2">
          <PrintButton />
          <a href={`/admin/commissions/${labId}/csv?month=${month}`} className={btn("plain")}>Download CSV</a>
        </span>
      </div>

      <header>
        <h1 className="text-xl font-semibold">Test Mate commission statement</h1>
        <p className="mt-1"><strong>{labName}</strong>, {lab.address}</p>
        <p className="text-sm text-muted">
          {monthName(month)} · agreed rate {lab.commissionBps != null ? `${bpsToPercent(lab.commissionBps)}%` : "not set"}
          {lab.partnerDiscountPct ? ` · patient discount ${lab.partnerDiscountPct}% with a Test Mate booking code` : ""}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-4 text-sm text-muted">No bills entered for this lab in {monthName(month)}.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className={tableCls}>
              <thead>
                <tr><th>Code</th><th>Test date</th><th>Patient</th><th>Tests</th><th className="text-right">Bill</th><th className="text-right">Rate</th><th className="text-right">Commission</th><th>Status</th></tr>
              </thead>
              <tbody className="tabular">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono">{r.code}</td>
                    <td>{r.testedOn}</td>
                    <td>{r.patient}</td>
                    <td>{r.tests}</td>
                    <td className="text-right">{tk(r.bill)}</td>
                    <td className="text-right">{bpsToPercent(r.bps)}%</td>
                    <td className="text-right font-semibold">{tk(r.commission)}</td>
                    <td>{COMMISSION_LABEL[r.status]}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="tabular font-semibold">
                <tr><td colSpan={4}>Total ({t.count})</td><td className="text-right">{tk(t.bill)}</td><td /><td className="text-right">{tk(t.commission)}</td><td /></tr>
              </tfoot>
            </table>
          </div>
          <dl className="grid max-w-md grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt>Due (pending + invoiced)</dt><dd className="tabular text-right text-lg font-semibold">{tk(t.due)}</dd>
            <dt>Already paid</dt><dd className="tabular text-right">{tk(t.paid)}</dd>
            {t.waived > 0 && <><dt>Waived</dt><dd className="tabular text-right">{tk(t.waived)}</dd></>}
          </dl>
          <div className="flex flex-wrap gap-3 print:hidden">
            <ActionForm action={markStatement.bind(null, labId, month, "INVOICED")}>
              <SubmitButton variant="plain">Mark pending as invoiced</SubmitButton>
            </ActionForm>
            <ActionForm action={markStatement.bind(null, labId, month, "PAID")}>
              <SubmitButton>Mark all due as paid</SubmitButton>
            </ActionForm>
          </div>
        </>
      )}
    </div>
  );
}
