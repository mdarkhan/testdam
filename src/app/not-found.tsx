import Link from "next/link";
import { bn } from "@/i18n/bn";
import { Logo } from "@/components/public/site-header";

// Also what thin pages return (thin-content rule): a real 404, with a way back.
export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="flex justify-center"><Logo /></div>
      <h1 className="mt-6 text-2xl font-semibold">{bn.notFoundTitle}</h1>
      <p className="mt-2 text-muted">{bn.notFoundBody}</p>
      <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-primary px-5 font-semibold text-white">{bn.backHome}</Link>
    </main>
  );
}
