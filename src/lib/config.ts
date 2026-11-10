// All runtime configuration, read from environment variables in one place.
const int = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Reads an env var by a dynamic name, so the bundler cannot replace it with its build-time value. */
function runtimeEnv(name: string): string | undefined {
  return process.env[name];
}

export const config = {
  siteUrl: (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  freshDays: int(process.env.FRESH_DAYS, 90),
  // Next inlines `process.env.NEXT_PUBLIC_*` at BUILD time (even a constant like "NEXT_PUBLIC_" + "GTM_ID"
  // gets folded), but the Docker image is built without it. A dynamic key is only read at runtime,
  // so setting NEXT_PUBLIC_GTM_ID on FlyNode is enough. Verified in the compiled standalone output.
  gtmId: runtimeEnv(["NEXT_PUBLIC", "GTM", "ID"].join("_")) ?? "",
  whatsappCentralNumber: process.env.WHATSAPP_CENTRAL_NUMBER ?? "",
};
