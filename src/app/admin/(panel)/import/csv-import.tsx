"use client";
import { useState, useTransition } from "react";
import { btn, tableCls } from "@/components/admin/styles";
import { importCsv, previewCsv, type PreviewResult } from "./actions";

const STATUS_LABEL = { new: "New", changed: "Price changed", verify_only: "Same price — re-verify" } as const;

export function CsvImport({ labs, initialLab }: { labs: Array<{ slug: string; label: string }>; initialLab: string }) {
  const [text, setText] = useState("");
  const [lab, setLab] = useState(initialLab);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [done, setDone] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const reset = () => { setPreview(null); setDone(null); };

  async function onFile(f: File | undefined) {
    if (!f) return;
    setText(await f.text());
    reset();
  }

  const valid = preview ? preview.rows.length : 0;

  return (
    <section className="mt-4 space-y-4 rounded-lg border border-line bg-white p-4">
      <h2 className="font-semibold">Import</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Lab for rows without <code>lab_slug</code>
          <select value={lab} onChange={(e) => { setLab(e.target.value); reset(); }} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-2">
            <option value="">— none (file has a lab_slug column) —</option>
            {labs.map((l) => <option key={l.slug} value={l.slug}>{l.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">CSV file
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="mt-1 block min-h-11 w-full text-sm" />
        </label>
      </div>
      <label className="block text-sm font-semibold">…or paste CSV
        <textarea value={text} onChange={(e) => { setText(e.target.value); reset(); }} rows={8} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs" />
      </label>
      <button type="button" disabled={!text.trim() || pending} className={btn()} onClick={() => start(async () => { setDone(null); setPreview(await previewCsv(text, lab)); })}>
        {pending && !preview ? "Checking…" : "Check file (nothing is saved yet)"}
      </button>

      <div role="status" aria-live="polite">
        {preview?.fatal && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{preview.fatal}</p>}
        {done && <p className={`rounded-md px-3 py-2 text-sm ${done.ok ? "bg-cheapest-soft text-cheapest" : "bg-danger-soft text-danger"}`}>{done.message}</p>}
      </div>

      {preview && !preview.fatal && !done && (
        <div className="space-y-3">
          <p className="text-sm">
            <strong>{valid}</strong> valid row(s): {preview.counts.new} new, {preview.counts.changed} price changed, {preview.counts.verify_only} same price (re-verify).
            {preview.errors.length > 0 && <> <strong className="text-danger">{preview.errors.length} row(s) with errors will be skipped.</strong></>}
          </p>
          {preview.errors.length > 0 && (
            <div className="max-h-64 overflow-auto rounded border border-danger">
              <table className={tableCls}>
                <thead className="bg-danger-soft"><tr><th>Line</th><th>Lab</th><th>Test</th><th>Problem</th></tr></thead>
                <tbody>{preview.errors.map((e) => <tr key={e.line}><td className="tabular">{e.line}</td><td>{e.labSlug}</td><td>{e.testSlug}</td><td className="text-danger">{e.errors.join("; ")}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {valid > 0 && (
            <div className="max-h-96 overflow-auto rounded border border-line">
              <table className={tableCls}>
                <thead className="sticky top-0 bg-slate-50"><tr><th>Line</th><th>Lab</th><th>Test</th><th>Status</th><th>Price ৳</th><th>Was ৳</th></tr></thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.line} className={r.status === "changed" ? "bg-warn-soft" : ""}>
                      <td className="tabular">{r.line}</td><td>{r.lab}</td><td>{r.test}</td><td>{STATUS_LABEL[r.status]}</td>
                      <td className="tabular">{r.price}</td><td className="tabular text-muted">{r.was ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {valid > 0 && (
            <button type="button" disabled={pending} className={btn()} onClick={() => start(async () => setDone(await importCsv(text, lab)))}>
              {pending ? "Importing…" : `Import ${valid} valid row(s)`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
