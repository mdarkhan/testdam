"use client";
// Spreadsheet-like price editor for one lab.
// Keys: ↑/↓ or Enter move between rows in the same column, Tab moves across, Ctrl+S saves.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { btn } from "@/components/admin/styles";
import { bulkVerify, saveGrid, type GridRowInput, type GridSaveResult } from "./actions";

type Values = Omit<GridRowInput, "testId">;
export type GridRow = {
  testId: number;
  label: string;
  labelBn: string;
  slug: string;
  saved: Values | null;
  verifiedOn: string | null;
  verifiedBy: string | null;
  stale: boolean;
};

const SOURCES = [
  ["PHONE_CALL", "Phone call"],
  ["PRICE_LIST", "Price list / photo"],
  ["WEBSITE", "Lab website"],
  ["LAB_SUBMITTED", "Lab submitted"],
  ["VISIT", "Visit"],
] as const;

type TextCol = "regularPrice" | "discountPrice" | "discountExpires" | "reportHours" | "sourceNote";
const cell = "w-full rounded border border-slate-300 px-2 py-1.5 text-sm tabular focus:border-primary";

export function PriceGrid({ labId, rows, defaultHomeCollection }: { labId: number; rows: GridRow[]; defaultHomeCollection: boolean }) {
  const [edits, setEdits] = useState<Map<number, Values>>(new Map());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const [onlyPriced, setOnlyPriced] = useState(false);
  const [defaultSource, setDefaultSource] = useState<string>("PHONE_CALL");
  const [verifySource, setVerifySource] = useState("");
  const [result, setResult] = useState<GridSaveResult | null>(null);
  const [pending, startTransition] = useTransition();
  const tableRef = useRef<HTMLTableElement>(null);

  const empty: Values = { regularPrice: "", discountPrice: "", discountExpires: "", reportHours: "", homeCollection: defaultHomeCollection, source: "", sourceNote: "" };
  const valuesOf = (r: GridRow) => edits.get(r.testId) ?? r.saved ?? empty;

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => (!onlyPriced || r.saved) && (!q || `${r.label} ${r.labelBn} ${r.slug}`.toLowerCase().includes(q)));
  }, [rows, filter, onlyPriced]);

  const { toSave, toDelete } = useMemo(() => {
    const toSave: GridRowInput[] = [];
    const toDelete: number[] = [];
    for (const r of rows) {
      const e = edits.get(r.testId);
      if (!e) continue;
      if (e.regularPrice.trim() === "") {
        if (r.saved) toDelete.push(r.testId);
      } else toSave.push({ testId: r.testId, ...e });
    }
    return { toSave, toDelete };
  }, [edits, rows]);
  const dirtyCount = toSave.length + toDelete.length;

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirtyCount) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirtyCount]);

  function change(r: GridRow, field: keyof Values, value: string | boolean) {
    setEdits((prev) => {
      const next = new Map(prev);
      const base = prev.get(r.testId) ?? { ...(r.saved ?? empty), ...(field !== "source" && { source: defaultSource }) };
      next.set(r.testId, { ...base, [field]: value });
      return next;
    });
  }

  function undo(testId: number) {
    setEdits((prev) => {
      const next = new Map(prev);
      next.delete(testId);
      return next;
    });
  }

  function save() {
    if (!dirtyCount || pending) return;
    if (toDelete.length && !confirm(`Remove ${toDelete.length} price(s) whose regular price you cleared? History is kept.`)) return;
    startTransition(async () => {
      const res = await saveGrid(labId, toSave, toDelete);
      setResult(res);
      if (res.ok) setEdits(new Map());
    });
  }

  function verify() {
    if (!selected.size || pending) return;
    if (dirtyCount && !confirm("You have unsaved edits. Mark selected verified anyway? (Edits stay unsaved.)")) return;
    startTransition(async () => {
      setResult(await bulkVerify(labId, [...selected], verifySource));
      setSelected(new Set());
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTableElement>) {
    const t = e.target as HTMLElement;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
      return;
    }
    if (!(t instanceof HTMLInputElement) || t.type === "checkbox" || t.type === "date") return;
    const dir = e.key === "ArrowDown" || (e.key === "Enter" && !e.shiftKey) ? 1 : e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey) ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const r = Number(t.dataset.r) + dir;
    tableRef.current?.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${t.dataset.c}"]`)?.focus();
  }

  const selectable = visible.filter((r) => r.saved);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.testId));

  return (
    <div className="mt-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-end gap-3 rounded-t-lg border border-line bg-white p-3">
        <label className="text-sm font-semibold">Find test
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="cbc, lipid, সিবিসি…" className="mt-1 block w-48 rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyPriced} onChange={(e) => setOnlyPriced(e.target.checked)} className="size-4 accent-primary" /> Only tests with a price
        </label>
        <label className="text-sm font-semibold">Source of today&apos;s edits
          <select value={defaultSource} onChange={(e) => setDefaultSource(e.target.value)} className="mt-1 block min-h-10 rounded-md border border-slate-300 px-2">
            {SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button type="button" onClick={save} disabled={!dirtyCount || pending} className={btn()}>
          {pending ? "Saving…" : `Save ${dirtyCount || ""} change${dirtyCount === 1 ? "" : "s"}`.replace("  ", " ")}
        </button>
        <div className="ml-auto flex flex-wrap items-end gap-2 border-l border-line pl-3">
          <label className="text-sm font-semibold">Verify source
            <select value={verifySource} onChange={(e) => setVerifySource(e.target.value)} className="mt-1 block min-h-10 rounded-md border border-slate-300 px-2">
              <option value="">Keep existing</option>
              {SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <button type="button" onClick={verify} disabled={!selected.size || pending} className={btn("plain")}>
            Mark {selected.size || ""} verified today
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite">
        {result && <p className={`border-x border-line px-3 py-2 text-sm ${result.ok ? "bg-cheapest-soft text-cheapest" : "bg-danger-soft text-danger"}`}>{result.message}</p>}
      </div>

      <div className="overflow-x-auto rounded-b-lg border border-t-0 border-line bg-white">
        <table ref={tableRef} onKeyDown={onKeyDown} className="w-full min-w-[1100px] border-collapse text-sm [&_td]:border-b [&_td]:border-line [&_td]:px-1.5 [&_td]:py-1 [&_th]:border-b [&_th]:border-line [&_th]:px-1.5 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-8">
                <input type="checkbox" aria-label="Select all visible tests that have a price" checked={allSelected} disabled={!selectable.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map((r) => r.testId)) : new Set())} className="size-4 accent-primary" />
              </th>
              <th>Test</th>
              <th className="w-24">Regular ৳</th>
              <th className="w-24">Discount ৳</th>
              <th className="w-36">Discount until</th>
              <th className="w-20">Report (h)</th>
              <th className="w-14">Home</th>
              <th className="w-36">Source</th>
              <th className="w-40">Note</th>
              <th className="w-32">Verified</th>
              <th className="w-10"><span className="sr-only">Undo</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const v = valuesOf(r);
              const edited = edits.has(r.testId);
              const deleting = edited && !!r.saved && v.regularPrice.trim() === "";
              const errs = result?.errors[r.testId];
              const bg = errs ? "bg-danger-soft" : deleting ? "bg-slate-100 line-through" : edited ? "bg-warn-soft" : "";
              const input = (c: TextCol, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
                <input data-r={i} data-c={c} value={v[c]} onChange={(e) => change(r, c, e.target.value)} className={cell}
                  aria-label={`${c} for ${r.label}`} aria-invalid={!!errs} {...extra} />
              );
              return (
                <tr key={r.testId} className={bg}>
                  <td>
                    <input type="checkbox" aria-label={`Select ${r.label}`} disabled={!r.saved} checked={selected.has(r.testId)} className="size-4 accent-primary"
                      onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(r.testId); else n.delete(r.testId); return n; })} />
                  </td>
                  <td>
                    <span className="font-semibold">{r.label}</span> <span lang="bn" className="text-muted">{r.labelBn}</span>
                    {errs && <ul className="mt-1 list-disc pl-4 text-xs text-danger">{errs.map((m) => <li key={m}>{m}</li>)}</ul>}
                  </td>
                  <td>{input("regularPrice", { inputMode: "numeric", placeholder: "—" })}</td>
                  <td>{input("discountPrice", { inputMode: "numeric" })}</td>
                  <td>{input("discountExpires", { type: "date" })}</td>
                  <td>{input("reportHours", { inputMode: "numeric" })}</td>
                  <td className="text-center">
                    <input type="checkbox" checked={v.homeCollection} onChange={(e) => change(r, "homeCollection", e.target.checked)} aria-label={`Home collection for ${r.label}`} className="size-4 accent-primary" />
                  </td>
                  <td>
                    <select value={v.source} onChange={(e) => change(r, "source", e.target.value)} aria-label={`Source for ${r.label}`} className={cell}>
                      <option value="">—</option>
                      {SOURCES.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
                    </select>
                  </td>
                  <td>{input("sourceNote")}</td>
                  <td className="tabular text-xs">
                    {r.verifiedOn ? (
                      <span title={r.verifiedBy ? `by ${r.verifiedBy}` : undefined} className={r.stale ? "font-semibold text-danger" : "text-muted"}>
                        {r.verifiedOn}{r.stale && " · stale"}
                      </span>
                    ) : <span className="text-muted">—</span>}
                    {edited && !deleting && <span className="block text-amber-800">→ today on save</span>}
                    {deleting && <span className="block text-danger">will be removed</span>}
                  </td>
                  <td>
                    {edited && (
                      <button type="button" onClick={() => undo(r.testId)} className="min-h-9 rounded px-2 text-muted hover:bg-slate-200" aria-label={`Undo changes to ${r.label}`} title="Undo">↺</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && <p className="p-4 text-sm text-muted">No tests match “{filter}”.</p>}
      </div>
      <p className="mt-2 text-xs text-muted">
        Type a price and press Enter to go to the next test. Saving a row marks it verified today with the row&apos;s source.
        Clear the regular price of a saved row to remove it. Ctrl+S saves.
      </p>
    </div>
  );
}
