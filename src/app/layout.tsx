import type { Metadata, Viewport } from "next";
import { Hind_Siliguri } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { config } from "@/lib/config";
import { bn } from "@/i18n/bn";

const bangla = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "600"], display: "swap", variable: "--font-bangla" });
// Hind Siliguri's ১ is hard to read, so the ten Bangla digits (০–৯) come from Noto Sans Bengali instead.
// The file is a 4 KB subset (digits only, variable weight; OFL licence in ./fonts); unicode-range keeps every other character in Hind Siliguri.
const bnDigits = localFont({
  src: "./fonts/bn-digits.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-bn-digits",
  declarations: [{ prop: "unicode-range", value: "U+09E6-09EF" }],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: bn.siteName,
  applicationName: bn.siteName,
  formatDetection: { telephone: false }, // we render our own tel: links
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={`${bangla.variable} ${bnDigits.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
