import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin · TestDam", template: "%s · Admin · TestDam" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div lang="en">{children}</div>;
}
