import { searchTests } from "@/lib/search";

// GET /api/search?q=... → suggestions for the search box. Short shared cache: the answer only
// changes when prices change, and the catalogue index itself is refreshed every minute.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const body = await searchTests(q);
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300", "X-Robots-Tag": "noindex" },
  });
}
