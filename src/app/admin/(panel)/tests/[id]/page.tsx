import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, Field, Select, SubmitButton, TextArea } from "@/components/admin/form";
import { btn } from "@/components/admin/styles";
import { TestCategory } from "@/generated/prisma/enums";
import { deleteTest, saveTest } from "../actions";

export const metadata = { title: "Edit test" };

export default async function TestEdit({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: idParam } = await params;
  const id = idParam === "new" ? null : Number(idParam);
  if (id !== null && !Number.isInteger(id)) notFound();
  const test = id ? await db.test.findUnique({ where: { id }, include: { aliases: { orderBy: { id: "asc" } }, reviewedBy: { select: { email: true } } } }) : null;
  if (id && !test) notFound();
  const names = new Set([test?.nameEn, test?.nameBn, test?.shortName].filter(Boolean));
  const aliasText = test?.aliases.filter((a) => !names.has(a.alias)).map((a) => a.alias).join("\n");

  return (
    <div className="max-w-3xl">
      <Link href="/admin/tests" className="text-sm text-primary underline">← Tests</Link>
      <h1 className="mt-2 text-xl font-semibold">{test ? `Edit ${test.nameEn}` : "Add test"}</h1>
      <ActionForm action={saveTest.bind(null, id)} className="mt-4 space-y-4 rounded-lg border border-line bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="English name" name="nameEn" defaultValue={test?.nameEn} required hint="Canonical name, e.g. Complete Blood Count" />
          <Field label="Bangla name" name="nameBn" defaultValue={test?.nameBn} required lang="bn" />
          <Field label="Short name" name="shortName" defaultValue={test?.shortName ?? ""} hint="e.g. CBC. Shown in titles when present." />
          <Field label="Slug" name="slug" defaultValue={test?.slug} hint="URL: /test/<slug>. Leave blank to generate. Don't change once published." />
          <Select label="Category" name="category" defaultValue={test?.category ?? ""} required>
            <option value="" disabled>Choose…</option>
            {Object.values(TestCategory).map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Field label="Sample type" name="sampleType" defaultValue={test?.sampleType ?? ""} hint="e.g. Blood, Urine. Leave blank if unsure." />
          <Field label="Popular rank" name="popularRank" type="number" min={1} defaultValue={test?.popularRank ?? ""} hint="1 = first on the home page. Blank = not listed as popular." />
        </div>
        <TextArea label="Search aliases" name="aliases" rows={6} defaultValue={aliasText} hint="One per line: abbreviations, Bangla spellings, common misspellings. The names above are added automatically." />

        <fieldset className="space-y-3 rounded-md border border-amber-300 bg-warn-soft p-3">
          <legend className="px-1 text-sm font-semibold">Medical text (hidden from the public until reviewed)</legend>
          <TextArea label="Description" name="description" rows={4} defaultValue={test?.description ?? ""} lang="bn" />
          <TextArea label="Preparation note" name="preparationNote" rows={3} defaultValue={test?.preparationNote ?? ""} lang="bn" hint="e.g. fasting requirements — only from a reliable source." />
          {user.role === "ADMIN" ? (
            <Select label="Review status" name="contentStatus" defaultValue={test?.contentStatus ?? "DRAFT_NEEDS_REVIEW"}>
              <option value="DRAFT_NEEDS_REVIEW">Draft — needs review (not shown publicly)</option>
              <option value="REVIEWED">Reviewed — show on public pages</option>
            </Select>
          ) : (
            <p className="text-sm">Status: <strong>{test?.contentStatus === "REVIEWED" ? "Reviewed" : "Needs review"}</strong>. Editing the text sends it back for review by an ADMIN.</p>
          )}
          {test?.reviewedAt && <p className="text-xs text-muted">Reviewed {test.reviewedAt.toISOString().slice(0, 10)} by {test.reviewedBy?.email}</p>}
        </fieldset>

        <div className="flex gap-2">
          <SubmitButton>Save test</SubmitButton>
          <Link href="/admin/tests" className={btn("plain")}>Cancel</Link>
        </div>
      </ActionForm>
      {test && user.role === "ADMIN" && (
        <ActionForm action={deleteTest.bind(null, test.id)} className="mt-6">
          <ConfirmButton message={`Delete ${test.nameEn}? This cannot be undone.`}>Delete test</ConfirmButton>
          <p className="mt-1 text-xs text-muted">Only possible when no lab has a price or booking for it.</p>
        </ActionForm>
      )}
    </div>
  );
}
