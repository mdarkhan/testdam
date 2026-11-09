// Placeholder until Phase 2 builds the public home page.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { robots: { index: false } };

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">টেস্টদাম</h1>
      <p className="mt-2 text-muted">Public pages arrive in Phase 2.</p>
      <Link href="/admin" className="mt-4 inline-block text-primary underline">Admin</Link>
    </main>
  );
}
