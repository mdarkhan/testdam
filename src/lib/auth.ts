import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { config } from "./config";
import { db } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  baseURL: config.siteUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10 },
  user: { additionalFields: { role: { type: "string", input: false } } },
  session: { expiresIn: 60 * 60 * 24 * 14 }, // 14 days
  // Login brute-force protection. In-memory is fine for a single container.
  rateLimit: { enabled: true, storage: "memory", customRules: { "/sign-in/email": { window: 60, max: 5 } } },
  plugins: [nextCookies()],
});

export type Role = "ADMIN" | "DATA_ENTRY";
export type AdminUser = { id: string; name: string; email: string; role: Role };

/** Current admin-area user, or null. Cached per request. */
export const getUser = cache(async (): Promise<AdminUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string };
  return { id: u.id, name: u.name, email: u.email, role: u.role === "ADMIN" ? "ADMIN" : "DATA_ENTRY" };
});

/**
 * Call at the top of every admin page AND every admin server action.
 * DATA_ENTRY: labs, tests, areas, prices, bookings. ADMIN: also users and deletions.
 */
export async function requireUser(role: Role = "DATA_ENTRY"): Promise<AdminUser> {
  const user = await getUser();
  if (!user) redirect("/admin/login");
  // The UI hides ADMIN-only controls from DATA_ENTRY users; anyone reaching one anyway goes back to the dashboard.
  if (role === "ADMIN" && user.role !== "ADMIN") redirect("/admin");
  return user;
}
