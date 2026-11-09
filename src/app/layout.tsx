import type { Metadata, Viewport } from "next";
import { Hind_Siliguri } from "next/font/google";
import "./globals.css";

const bangla = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "600"], display: "swap", variable: "--font-bangla" });

export const metadata: Metadata = { title: "TestDam" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={bangla.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
