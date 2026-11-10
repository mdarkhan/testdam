import { defineConfig } from "vitest/config";
import path from "node:path";

const TEST_DB = "postgresql://testdam:testdam@localhost:54329/testdam_test";

// `npm test`        → pure logic, no database.
// `npm run test:db` → tests/db/*, against the local `testdam_test` database (needs `npm run db:start`).
export default defineConfig(({ mode }) => {
  const dbMode = mode === "db";
  return {
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts"),
      },
    },
    test: {
      include: dbMode ? ["tests/db/**/*.test.ts"] : ["tests/*.test.ts"],
      globalSetup: dbMode ? ["tests/db/setup.ts"] : [],
      env: dbMode ? { DATABASE_URL: TEST_DB } : {},
      testTimeout: 20_000,
      hookTimeout: 180_000,
    },
  };
});
