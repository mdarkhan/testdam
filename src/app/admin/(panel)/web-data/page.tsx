import { requireUser } from "@/lib/auth";
import { WEB_DATA, webDataStatus } from "@/lib/web-import";
import { ActionForm, Field, SubmitButton } from "@/components/admin/form";
import { tableCls } from "@/components/admin/styles";
import { runImport, runRemove } from "./actions";

export const metadata = { title: "Web-collected prices" };

export default async function WebDataPage() {
  await requireUser("ADMIN");
  const status = await webDataStatus();
  const count = new Map<string, number>();
  for (const p of WEB_DATA.prices) count.set(p.lab, (count.get(p.lab) ?? 0) + 1);
  const tests = new Set(WEB_DATA.prices.map((p) => p.test)).size;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Web-collected prices</h1>
        <p className="mt-1 text-sm text-muted">
          {WEB_DATA.prices.length} prices for {tests} tests at {WEB_DATA.labs.length} Dhaka labs, read from each lab&apos;s own website
          on {WEB_DATA.collectedOn}. They are <strong>not confirmed by phone</strong>: source is &ldquo;Lab website&rdquo; and the
          verified date is the day they were read, so they turn stale (grey) by themselves after the freshness period.
        </p>
      </div>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">Now in the database</h2>
        <p className="mt-1 text-sm">
          {status.prices} imported price(s) at {status.labs} imported lab(s).
          {status.handConfirmed > 0 && ` ${status.handConfirmed} price(s) at these labs were saved or verified by a person and count as your own data.`}
        </p>
        <ActionForm action={runImport} className="mt-3">
          <p className="mb-2 text-sm text-muted">Adds the labs, any missing tests/areas, and the prices. Safe to run again; prices you entered yourself are never overwritten.</p>
          <SubmitButton>{status.prices ? "Import again" : "Import web-collected prices"}</SubmitButton>
        </ActionForm>
      </section>

      <section className="rounded-lg border border-danger bg-white p-4">
        <h2 className="font-semibold text-danger">Remove all imported data</h2>
        <p className="mt-1 text-sm text-muted">
          Deletes every price still marked as imported, its history, and the imported labs. Kept: any price you typed, saved or
          verified yourself (and its lab), every booking request (and its lab), all tests and areas. Cannot be undone — but you
          can import again.
        </p>
        <ActionForm action={runRemove} className="mt-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Type REMOVE to confirm" name="confirm" autoComplete="off" />
            <SubmitButton variant="danger">Remove imported data</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section>
        <h2 className="font-semibold">Sources</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
          <table className={tableCls}>
            <thead><tr><th>Lab</th><th>Area</th><th>Prices</th><th>Source page</th></tr></thead>
            <tbody>
              {WEB_DATA.labs.map((l) => (
                <tr key={l.slug}>
                  <td>{l.name}{l.branchName ? ` · ${l.branchName}` : ""}</td>
                  <td>{l.area}</td>
                  <td className="tabular">{count.get(l.slug) ?? 0}</td>
                  <td><a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">{l.sourceUrl}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
