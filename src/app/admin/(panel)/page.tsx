import Link from "next/link";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { staleCutoff } from "@/lib/pricing";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  await requireUser();
  const staleBefore = staleCutoff();
  const [labs, tests, prices, stale, needsReview, newBookings] = await Promise.all([
    db.lab.count({ where: { isActive: true } }),
    db.test.count(),
    db.labTestPrice.count(),
    db.labTestPrice.count({ where: { verifiedAt: { lt: staleBefore } } }),
    db.test.count({ where: { contentStatus: "DRAFT_NEEDS_REVIEW", OR: [{ description: { not: null } }, { preparationNote: { not: null } }] } }),
    db.bookingRequest.count({ where: { status: "NEW" } }),
  ]);
  const cards: Array<[string, number, string]> = [
    ["New booking requests", newBookings, "/admin/bookings?status=NEW"],
    ["Active labs", labs, "/admin/labs"],
    ["Tests", tests, "/admin/tests"],
    ["Prices", prices, "/admin/labs"],
    [`Stale prices (> ${config.freshDays} days)`, stale, "/admin/stale"],
    ["Test texts awaiting review", needsReview, "/admin/tests?filter=review"],
  ];
  return (
    <>
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, n, href]) => (
          <li key={label}>
            <Link href={href} className="block rounded-lg border border-line bg-white p-4 hover:border-primary">
              <span className="tabular block text-2xl font-semibold">{n.toLocaleString("en-US")}</span>
              <span className="text-sm text-muted">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
      
    </>
  );
}
