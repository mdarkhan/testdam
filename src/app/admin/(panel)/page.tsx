import Link from "next/link";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { staleCutoff } from "@/lib/pricing";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  await requireUser();
  const staleBefore = staleCutoff();
  const [labs, tests, prices, stale, needsReview] = await Promise.all([
    db.lab.count({ where: { isActive: true } }),
    db.test.count(),
    db.labTestPrice.count(),
    db.labTestPrice.count({ where: { verifiedAt: { lt: staleBefore } } }),
    db.test.count({ where: { contentStatus: "DRAFT_NEEDS_REVIEW", OR: [{ description: { not: null } }, { preparationNote: { not: null } }] } }),
  ]);
  const cards: Array<[string, number, string]> = [
    ["Active labs", labs, "/admin/labs"],
    ["Tests", tests, "/admin/tests"],
    ["Prices", prices, "/admin/labs"],
    [`Stale prices (> ${config.freshDays} days)`, stale, "/admin/labs?sort=stale"],
    ["Test texts awaiting review", needsReview, "/admin/tests?filter=review"],
  ];
  return (
    <>
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, n, href]) => (
          <li key={label}>
            <Link href={href} className="block rounded-lg border border-line bg-white p-4 hover:border-primary">
              <span className="tabular block text-2xl font-semibold">{n.toLocaleString("en-US")}</span>
              <span className="text-sm text-muted">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">Stale-price call list and booking inbox arrive in later phases.</p>
    </>
  );
}
