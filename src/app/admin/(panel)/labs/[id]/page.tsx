import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, Checkbox, ConfirmButton, Field, Select, SubmitButton } from "@/components/admin/form";
import { btn } from "@/components/admin/styles";
import { deleteLab, saveLab } from "../actions";

export const metadata = { title: "Edit lab" };

export default async function LabEdit({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: idParam } = await params;
  const id = idParam === "new" ? null : Number(idParam);
  if (id !== null && !Number.isInteger(id)) notFound();
  const lab = id ? await db.lab.findUnique({ where: { id } }) : null;
  if (id && !lab) notFound();
  const areas = await db.area.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true } });

  return (
    <div className="max-w-3xl">
      <Link href="/admin/labs" className="text-sm text-primary underline">← Labs</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{lab ? `Edit ${lab.name}${lab.branchName ? ` · ${lab.branchName}` : ""}` : "Add lab"}</h1>
        {lab && <Link href={`/admin/labs/${lab.id}/prices`} className={btn("plain")}>Edit prices →</Link>}
      </div>
      <ActionForm action={saveLab.bind(null, id)} className="mt-4 space-y-4 rounded-lg border border-line bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lab name" name="name" defaultValue={lab?.name} required hint="Brand name, e.g. Demo Lab 1" />
          <Field label="Bangla name" name="nameBn" defaultValue={lab?.nameBn ?? ""} lang="bn" />
          <Field label="Branch" name="branchName" defaultValue={lab?.branchName ?? ""} hint="e.g. Mirpur 10 branch" />
          <Select label="Area" name="areaId" defaultValue={lab?.areaId ?? ""} required>
            <option value="" disabled>Choose…</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nameEn}</option>)}
          </Select>
          <div className="sm:col-span-2"><Field label="Address" name="address" defaultValue={lab?.address} required /></div>
          <Field label="Phone" name="phone" type="tel" defaultValue={lab?.phone} required hint="Mobile, landline or hotline" />
          <Field label="WhatsApp" name="whatsapp" type="tel" defaultValue={lab?.whatsapp ?? ""} hint="01XXXXXXXXX. Blank = no WhatsApp button." />
          <Field label="Opening hours" name="openingHours" defaultValue={lab?.openingHours ?? ""} lang="bn" hint="Shown as written, e.g. প্রতিদিন সকাল ৮টা – রাত ১০টা" />
          <Field label="Map link" name="mapUrl" type="url" defaultValue={lab?.mapUrl ?? ""} hint="Google Maps share link (https://…)" />
          <Field label="Slug" name="slug" defaultValue={lab?.slug} hint="URL: /lab/<slug>. Leave blank to generate. Don't change once published." />
          <Field label="Home collection fee (৳)" name="homeCollectionFee" type="number" min={0} defaultValue={lab?.homeCollectionFee ?? ""} hint="0 = free, blank = unknown" />
        </div>
        <div className="flex flex-wrap gap-x-6">
          <Checkbox label="Offers home collection" name="homeCollection" defaultChecked={lab?.homeCollection ?? false} />
          <Checkbox label="Active (shown on the public site)" name="isActive" defaultChecked={lab?.isActive ?? true} />
          {user.role === "ADMIN" ? (
            <Checkbox label="Featured (badge only — never changes price order)" name="isFeatured" defaultChecked={lab?.isFeatured ?? false} />
          ) : lab?.isFeatured ? <span className="flex min-h-11 items-center text-sm">Featured (set by an ADMIN)</span> : null}
        </div>
        <div className="flex gap-2">
          <SubmitButton>Save lab</SubmitButton>
          <Link href="/admin/labs" className={btn("plain")}>Cancel</Link>
        </div>
      </ActionForm>
      {lab && user.role === "ADMIN" && (
        <ActionForm action={deleteLab.bind(null, lab.id)} className="mt-6">
          <ConfirmButton message={`Delete ${lab.name}? This cannot be undone.`}>Delete lab</ConfirmButton>
          <p className="mt-1 text-xs text-muted">Only possible for a lab with no prices and no bookings. Otherwise untick “Active”.</p>
        </ActionForm>
      )}
    </div>
  );
}
