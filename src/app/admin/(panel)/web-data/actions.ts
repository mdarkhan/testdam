"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { importWebData, removeWebData } from "@/lib/web-import";
import type { FormState } from "@/components/admin/form";

export async function runImport(): Promise<FormState> {
  await requireUser("ADMIN");
  try {
    const r = await importWebData();
    revalidatePath("/admin/web-data");
    return {
      ok: true,
      message: `Imported: ${r.labsCreated} new lab(s), ${r.created} new price(s), ${r.updated} refreshed.` +
        (r.keptHandEntered ? ` ${r.keptHandEntered} price(s) you entered yourself were left as they are.` : ""),
    };
  } catch (e) {
    console.error("[web-import] import failed", e);
    return { message: "Import failed — nothing was saved. See the server log." };
  }
}

export async function runRemove(_: FormState, data: FormData): Promise<FormState> {
  await requireUser("ADMIN");
  if (String(data.get("confirm") ?? "").trim() !== "REMOVE") return { message: 'Type REMOVE (capital letters) to confirm.' };
  try {
    const r = await removeWebData();
    revalidatePath("/admin/web-data");
    return {
      ok: true,
      message: `Removed ${r.prices} imported price(s), ${r.history} history row(s) and ${r.labsRemoved} lab(s).` +
        (r.labsKept.length ? ` Kept (they have your own data): ${r.labsKept.join("; ")}.` : ""),
    };
  } catch (e) {
    console.error("[web-import] remove failed", e);
    return { message: "Removal failed — nothing was deleted. See the server log." };
  }
}
