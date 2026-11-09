import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, ConfirmButton, Field, SubmitButton, TextArea } from "@/components/admin/form";
import { btn } from "@/components/admin/styles";
import { deleteArea, saveArea } from "../actions";

export const metadata = { title: "Edit area" };

export default async function AreaEdit({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: idParam } = await params;
  const id = idParam === "new" ? null : Number(idParam);
  if (id !== null && !Number.isInteger(id)) notFound();
  const area = id ? await db.area.findUnique({ where: { id }, include: { neighbors: { select: { id: true } }, _count: { select: { labs: true } } } }) : null;
  if (id && !area) notFound();
  const all = await db.area.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true } });
  const neighborIds = new Set(area?.neighbors.map((n) => n.id));

  return (
    <div className="max-w-2xl">
      <Link href="/admin/areas" className="text-sm text-primary underline">← Areas</Link>
      <h1 className="mt-2 text-xl font-semibold">{area ? `Edit ${area.nameEn}` : "Add area"}</h1>
      <ActionForm action={saveArea.bind(null, id)} className="mt-4 space-y-4 rounded-lg border border-line bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="English name" name="nameEn" defaultValue={area?.nameEn} required />
          <Field label="Bangla name" name="nameBn" defaultValue={area?.nameBn} required lang="bn" />
        </div>
        <Field label="Slug" name="slug" defaultValue={area?.slug} hint="Used in URLs, e.g. /test/cbc/mirpur. Leave blank to generate. Changing it later breaks existing links." />
        <TextArea label="Other spellings" name="aliases" rows={2} defaultValue={area?.aliases.join(", ")} hint="Comma-separated. Used to recognise the area in searches like “cbc mirpur 10”." />
        <fieldset>
          <legend className="text-sm font-semibold">Nearby areas</legend>
          <p className="text-xs text-muted">Used for “same test in nearby areas” links. Saved both ways.</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            {all.filter((a) => a.id !== id).map((a) => (
              <label key={a.id} className="flex min-h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="neighbors" value={a.id} defaultChecked={neighborIds.has(a.id)} className="size-4 accent-primary" /> {a.nameEn}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <SubmitButton>Save area</SubmitButton>
          <Link href="/admin/areas" className={btn("plain")}>Cancel</Link>
        </div>
      </ActionForm>
      {area && user.role === "ADMIN" && (
        <ActionForm action={deleteArea.bind(null, area.id)} className="mt-6">
          <ConfirmButton message={`Delete ${area.nameEn}? This cannot be undone.`}>Delete area</ConfirmButton>
          <p className="mt-1 text-xs text-muted">Only possible when no labs are in this area ({area._count.labs} now).</p>
        </ActionForm>
      )}
    </div>
  );
}
