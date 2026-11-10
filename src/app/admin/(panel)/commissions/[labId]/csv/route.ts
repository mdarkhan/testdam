import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { statementCsv } from "@/lib/commission";
import { loadStatementRows, pickMonth } from "@/lib/statements";
import { slugify } from "@/lib/normalize";

const BOM = String.fromCharCode(0xfeff); // so Excel opens the file as UTF-8

// GET /admin/commissions/<labId>/csv?month=YYYY-MM → that lab's statement (ADMIN only).
export async function GET(req: Request, { params }: { params: Promise<{ labId: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  if (user.role !== "ADMIN") return new Response("ADMIN only", { status: 403 });
  const labId = Number((await params).labId);
  const lab = Number.isInteger(labId) ? await db.lab.findUnique({ where: { id: labId }, select: { name: true, branchName: true } }) : null;
  if (!lab) return new Response("Lab not found", { status: 404 });
  const month = pickMonth(new URL(req.url).searchParams.get("month") ?? undefined);
  const labName = `${lab.name}${lab.branchName ? ` (${lab.branchName})` : ""}`;
  const rows = (await loadStatementRows(month, labId)).map((r) => r.row);
  return new Response(BOM + statementCsv(rows, { lab: labName, month }), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="testmate-commission-${slugify(labName) || labId}-${month}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
