import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { signOut } from "../actions";

const NAV = [
  ["/admin", "Dashboard"],
  ["/admin/labs", "Labs & prices"],
  ["/admin/stale", "Call list"],
  ["/admin/tests", "Tests"],
  ["/admin/areas", "Areas"],
  ["/admin/import", "CSV import / export"],
] as const;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const newBookings = await db.bookingRequest.count({ where: { status: "NEW" } });
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <Link href="/admin" className="mr-2 font-semibold text-primary">Test Mate admin</Link>
          <nav aria-label="Admin" className="flex flex-wrap gap-1 text-sm">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="rounded px-2 py-2 hover:bg-slate-100">{label}</Link>
            ))}
            <Link href="/admin/bookings" className="rounded px-2 py-2 hover:bg-slate-100">
              Bookings{newBookings > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white" aria-label={`${newBookings} new`}>{newBookings}</span>}
            </Link>
            {user.role === "ADMIN" && <Link href="/admin/web-data" className="rounded px-2 py-2 hover:bg-slate-100">Web prices</Link>}
            {user.role === "ADMIN" && <Link href="/admin/users" className="rounded px-2 py-2 hover:bg-slate-100">Users</Link>}
          </nav>
          <form action={signOut} className="ml-auto flex items-center gap-2 text-sm text-muted">
            <span>{user.email} · {user.role}</span>
            <button className="rounded px-2 py-2 underline hover:bg-slate-100">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
