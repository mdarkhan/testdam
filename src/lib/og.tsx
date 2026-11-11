import "server-only";
// Share images (Open Graph, 1200×630) drawn with next/og. Text is English + digits on purpose:
// the renderer cannot shape Bangla script (vowel signs and conjuncts come out wrong). The price
// spread bar mirrors the site's own (components/public/price-spread.tsx).
import { ImageResponse } from "next/og";
import { OG_FONT_400, OG_FONT_600 } from "./og-font-data";

export const OG_SIZE = { width: 1200, height: 630 };

const C = { ink: "#0f172a", muted: "#475569", primary: "#0f766e", soft: "#f0fdfa", cheapest: "#15803d", line: "#e2e8f0" };
const fonts = [
  { name: "Hind", data: Buffer.from(OG_FONT_400, "base64"), weight: 400 as const, style: "normal" as const },
  { name: "Hind", data: Buffer.from(OG_FONT_600, "base64"), weight: 600 as const, style: "normal" as const },
];
export const tk = (n: number) => `৳${n.toLocaleString("en-IN")}`;

type Card = {
  title: string; // e.g. "CBC (Complete Blood Count)"
  subtitle: string; // e.g. "Test price in Mirpur, Dhaka"
  prices?: number[]; // ascending fresh prices → range + spread bar
  note?: string; // bottom line, e.g. "13 labs. Every price shows the date it was checked."
  headline?: string; // big line instead of a price range, e.g. "60 tests, from ৳200"
  decorative?: boolean; // draw an unlabeled spread bar (brand motif, no data) when there are no prices
};

const DECOR = [0, 18, 24, 31, 37, 45, 52, 58, 66, 73, 81, 100]; // evenly-ish spread dots, positions in %

export function ogCard({ title, subtitle, prices, note, headline, decorative }: Card) {
  const min = prices?.[0], max = prices?.[prices.length - 1];
  const span = min != null && max != null ? max - min : 0;
  const at = (p: number) => (span ? ((p - min!) / span) * 100 : 50);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fff", padding: "56px 72px", fontFamily: "Hind", color: C.ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: C.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 600 }}>৳</div>
          <div style={{ fontSize: 36, fontWeight: 600, color: C.primary }}>Test Mate</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
          <div style={{ fontSize: title.length > 34 ? 52 : 64, fontWeight: 600, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 32, color: C.muted, marginTop: 12 }}>{subtitle}</div>
        </div>
        {min != null && max != null && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 20, fontSize: 88, fontWeight: 600 }}>
              <span style={{ color: C.cheapest }}>{tk(min)}</span>
              {max > min && <div style={{ width: 40, height: 8, borderRadius: 4, background: C.muted, alignSelf: "center" }} />}
              {max > min && <span>{tk(max)}</span>}
            </div>
            {prices!.length > 1 && (
              <div style={{ display: "flex", position: "relative", height: 36, marginTop: 16, marginLeft: 14, marginRight: 14 }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: 13, height: 10, borderRadius: 5, background: C.line }} />
                {prices!.map((p, i) => (
                  <div key={i} style={{ position: "absolute", left: `${at(p)}%`, top: 6, width: 24, height: 24, marginLeft: -12, borderRadius: 12, background: C.primary, opacity: 0.45 }} />
                ))}
                <div style={{ position: "absolute", left: `${at(min)}%`, top: 2, width: 32, height: 32, marginLeft: -16, borderRadius: 16, background: C.cheapest, border: "4px solid #fff" }} />
              </div>
            )}
          </div>
        )}
        {min == null && headline && (
          <div style={{ display: "flex", marginTop: "auto", fontSize: 72, fontWeight: 600 }}>{headline}</div>
        )}
        {min == null && decorative && (
          <div style={{ display: "flex", position: "relative", height: 36, marginTop: "auto", marginLeft: 14, marginRight: 14 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 13, height: 10, borderRadius: 5, background: C.line }} />
            {DECOR.map((p, i) => (
              <div key={i} style={{ position: "absolute", left: `${p}%`, top: 6, width: 24, height: 24, marginLeft: -12, borderRadius: 12, background: C.primary, opacity: 0.45 }} />
            ))}
            <div style={{ position: "absolute", left: "0%", top: 2, width: 32, height: 32, marginLeft: -16, borderRadius: 16, background: C.cheapest, border: "4px solid #fff" }} />
          </div>
        )}
        {note && <div style={{ display: "flex", fontSize: 28, color: C.muted, marginTop: min != null || headline || decorative ? 20 : "auto" }}>{note}</div>}
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
