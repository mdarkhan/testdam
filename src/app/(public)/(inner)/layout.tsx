import { SiteHeader } from "@/components/public/site-header";

export default function InnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader search />
      <main id="main" className="mx-auto w-full max-w-3xl px-4 pb-12 pt-5">{children}</main>
    </>
  );
}
