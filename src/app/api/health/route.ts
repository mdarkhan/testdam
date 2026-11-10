import { db } from "@/lib/db";

// GET /api/health — for the hosting platform's health check: the app is up and the database answers.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "database unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
