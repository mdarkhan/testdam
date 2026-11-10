// Migrates and seeds the separate `testdam_test` database (never the dev database).
import { execSync } from "node:child_process";

export default function setup() {
  const env = { ...process.env, DATABASE_URL: "postgresql://testdam:testdam@localhost:54329/testdam_test" };
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
}
