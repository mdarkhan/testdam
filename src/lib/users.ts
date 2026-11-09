import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { Role } from "@/generated/prisma/client";

/**
 * Creates an admin-area user with an email + password login.
 * Public sign-up is disabled, so this (seed script and /admin/users) is the only way users are created.
 * Mirrors what Better Auth stores for a credential account: a user row + an account row holding the hash.
 */
export async function createUser(input: { name: string; email: string; password: string; role: Role }) {
  const id = randomUUID();
  const email = input.email.trim().toLowerCase();
  return db.user.create({
    data: {
      id,
      name: input.name.trim(),
      email,
      emailVerified: true,
      role: input.role,
      accounts: {
        create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(input.password) },
      },
    },
  });
}

export async function setPassword(userId: string, password: string) {
  await db.account.updateMany({
    where: { userId, providerId: "credential" },
    data: { password: await hashPassword(password) },
  });
  await db.session.deleteMany({ where: { userId } }); // sign out everywhere
}
