import type { Metadata, Viewport } from "next";
import { Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { config } from "@/lib/config";
import { bn } from "@/i18n/bn";

const bangla = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "600"], display: "swap", variable: "--font-bangla" });

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: bn.siteName,
  applicationName: bn.siteName,
  formatDetection: { telephone: false }, // we render our own tel: links
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={bangla.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
