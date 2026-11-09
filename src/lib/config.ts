// All runtime configuration, read from environment variables in one place.
const int = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  siteUrl: (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  freshDays: int(process.env.FRESH_DAYS, 90),
  gtmId: process.env.NEXT_PUBLIC_GTM_ID ?? "",
  whatsappCentralNumber: process.env.WHATSAPP_CENTRAL_NUMBER ?? "",
};
