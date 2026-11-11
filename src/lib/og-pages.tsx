import "server-only";
// Share images for test and lab pages (opengraph-image routes call these).
import { db } from "./db";
import { getAreaBySlug, getCatalogIndex, getTestBySlug, getTestPrices } from "./catalog";
import { effectivePrice, isFresh, rankPrices } from "./pricing";
import { ogCard, tk } from "./og";

const fallback = () => ogCard({ title: "Same test. Different price at every lab.", subtitle: "Compare diagnostic test prices in Dhaka", decorative: true });
const testTitle = (t: { shortName: string | null; nameEn: string }) => (t.shortName && t.shortName !== t.nameEn ? `${t.shortName} (${t.nameEn})` : t.nameEn);

export async function testShareImage(slug: string, areaSlug?: string) {
  const [test, index, area] = await Promise.all([getTestBySlug(slug), getCatalogIndex(), areaSlug ? getAreaBySlug(areaSlug) : null]);
  if (!test || !index.tests.has(test.id) || (areaSlug && !area)) return fallback();
  const rows = await getTestPrices(test.id, area?.id);
  const prices = rankPrices(rows.map((r) => ({ ...r, labName: r.lab.name }))).fresh.map((r) => r.effective).sort((a, b) => a - b);
  if (!prices.length) return fallback();
  const labs = prices.length;
  return ogCard({
    title: testTitle(test),
    subtitle: area ? `Test price in ${area.nameEn}, Dhaka` : "Test price in Dhaka",
    prices,
    note: `${labs} lab${labs === 1 ? "" : "s"} compared. Every price shows the date it was checked.`,
  });
}

export async function labShareImage(slug: string) {
  const [lab, index] = await Promise.all([
    db.lab.findUnique({ where: { slug }, select: { id: true, name: true, branchName: true, isActive: true, area: { select: { nameEn: true } }, prices: true } }),
    getCatalogIndex(),
  ]);
  if (!lab || !lab.isActive || !index.labs.has(lab.id)) return fallback();
  const now = new Date();
  const fresh = lab.prices.filter((p) => isFresh(p, now)).map((p) => effectivePrice(p, now));
  return ogCard({
    title: lab.branchName ? `${lab.name}, ${lab.branchName}` : lab.name,
    subtitle: `${lab.area.nameEn}, Dhaka`,
    headline: `${fresh.length} tests, from ${tk(Math.min(...fresh))}`,
    note: "Compare each price with other labs on Test Mate.",
  });
}
