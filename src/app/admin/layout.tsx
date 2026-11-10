import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin · Test Mate", template: "%s · Admin · Test Mate" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div lang="en">{children}</div>;
}
