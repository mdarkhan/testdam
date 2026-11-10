import { defineConfig } from "@playwright/test";

// `npm run test:e2e` — migrates + seeds the separate `testdam_test` database, builds the app into
// .next-e2e and serves it on :3200 (production mode: no dev-server recompiles/reloads mid-test).
// Needs `npm run db:start`. Uses the installed Chrome (no browser download).
const DATABASE_URL = "postgresql://testdam:testdam@localhost:54329/testdam_test";
process.env.DATABASE_URL = DATABASE_URL; // for the test process itself (DB assertions)

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: "http://localhost:3200",
    channel: "chrome",
    viewport: { width: 360, height: 780 },
    locale: "bn-BD",
    navigationTimeout: 120_000,
  },
  webServer: {
    command: "npx tsx e2e/prepare.ts && npx next build && npx next start -p 3200",
    url: "http://localhost:3200/robots.txt",
    timeout: 600_000,
    reuseExistingServer: false,
    env: { DATABASE_URL, SITE_URL: "http://localhost:3200", NEXT_PUBLIC_GTM_ID: "", NEXT_DIST_DIR: ".next-e2e",
      // Placeholder central number so WhatsApp buttons exist; the test blocks the link, nothing is opened.
      WHATSAPP_CENTRAL_NUMBER: "01300000000" },
  },
});
