# PROGRESS — TestDam

Read this first in a new session, then [docs/BRIEF.md](docs/BRIEF.md) (requirements) and [docs/PLAN.md](docs/PLAN.md) (agreed design).

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0 — Plan | Done (2026-11-10) | Plan, schema, open questions |
| 1 — Data and admin | Done (2026-11-10) | See "Phase 1 report" below |
| 2 — Public pages | **Done, waiting for owner review** (2026-11-10) | See "Phase 2 report" below |
| 3 — Technical SEO | Not started | |
| 4 — Booking and tracking | Not started | |
| 5 — Ops and deploy | Not started | |

## How to run locally (Windows, no Docker needed)

```bash
npm install
cp .env.example .env      # then set BETTER_AUTH_SECRET and SEED_ADMIN_PASSWORD (10+ chars)
npm run db:start          # terminal 1 — PostgreSQL 18 on localhost:54329, data in ./.pgdata; leave running
npx prisma migrate deploy # terminal 2
npm run db:seed
npm run dev               # http://localhost:3000/admin — sign in with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
```
Checks: `npm run typecheck`, `npm run lint`, `npm test` (pure logic), `npm run test:db` (search against the separate `testdam_test` database — migrates and seeds it first; needs `npm run db:start`), `npx next build`.

## Phase 2 report

**Built**
- `src/lib/pricing.ts` — the only place for the rules: freshness, effective price, `rankPrices` (fresh by effective price → faster report → lab name; stale in a separate group; only the first fresh row is "cheapest"; `isFeatured` never read), `priceRange` (fresh only), `buildIndex` + `THRESHOLDS` (thin-content rule for test, test × area, lab, area pages).
- `src/lib/catalog.ts` — publishable-page index built from all prices of active labs, cached in-process for 60 s and invalidated on every admin write; page data queries.
- `src/lib/search.ts` + `GET /api/search` — pg_trgm search on romanised alias keys, area detection ("cbc mirpur", "মিরপুরে সিবিসি"), only tests with a published page, links to the test × area page when it exists.
- Pages (all ISR: `revalidate = 1 day`, rendered on first request, `generateStaticParams` returns `[]`): `/`, `/test/[slug]`, `/test/[slug]/[area]`, `/lab/[slug]`, `/area/[slug]`; `/search` (dynamic, noindex); Bangla 404.
- Components: search box (ARIA combobox, works without JS via `/search`), server-rendered price cards (price largest, cheapest in green, featured badge, discount + expiry, report time, home collection + fee, "যাচাই: date · source", stale grey with "পুরনো তথ্য — ল্যাবে ফোন করে নিশ্চিত হোন"), filters (area / report time / home collection; toggles `hidden` on server-rendered cards), plain call and WhatsApp links (tracking and booking come in Phase 4).
- `src/i18n/bn.ts` (all public strings), `src/lib/format.ts` (Bangla digits, ৳ with South Asian grouping, Dhaka dates, report time).
- Internal links: test → test × area pages and other tests; test × area → nearby areas, all-Dhaka page, area page; lab ↔ area; area → test × area pages, labs, nearby areas.

**Verified (2026-11-10)**
- `tsc` clean, ESLint clean, Vitest 50/50 (incl. ranking: featured lab never moves up; stale never cheapest; thresholds), `npm run test:db` 19/19 (CBC via `CBC`, `cbc test er dam`, `সিবিসি`, `সিবিসি টেস্টের দাম`, `complete blood count`, `compleet blod count`, `C.B.C`; lipid via Bangla/Banglish; area detection incl. Bangla case endings), `next build` succeeds with public pages as ISR.
- Clicked through at 360 px (Playwright): home, suggestions, test page, filters (11 of 24 shown, all matching), lab page, area page.
- Thin-content rule live: deactivating a lab turned `/test/cbc/mirpur` (1 lab left) and the lab's own page into 404s within the 60 s cache window; unknown slugs 404.
- Production server: first request MISS, second HIT (`x-nextjs-cache`); thin pages 404.
- Search page: clear exact hits redirect (`cbc`, `সিবিসি টেস্টের দাম`, `cbc badda` → test × area, `বাড্ডা` → area page); ambiguous queries (`sugar`, `thyroid`) show a list; no results → help text.

**Not done / not verified**
- Titles/descriptions are basic; canonical, Open Graph, structured data, sitemap, robots and Lighthouse are Phase 3.
- Booking form, dataLayer events and the Playwright e2e test (search → test page → booking) are Phase 4.
- JavaScript on a test page: 178 KB gzip in 11 files, of which ~143 KB is React + Next.js runtime; our components are a few KB. Lighthouse in Phase 3 will show whether this needs work.
- Not checked with a screen reader.

## Phase 1 report

**Built**
- Local DB: `embedded-postgres` (real PostgreSQL 18 from npm) via `scripts/dev-db.ts`; databases `testdam` and `testdam_test`.
- Prisma schema + first migration (`pg_trgm` extension + GIN trigram index on `TestAlias.searchKey`).
- Admin auth: Better Auth, email + password, public sign-up disabled, roles ADMIN / DATA_ENTRY, login rate limit 5/min.
- Admin: dashboard counts; areas (incl. nearby areas); tests (aliases, medical text with review status); labs; per-lab price grid; CSV import with preview; CSV export + template; users (ADMIN only).
- Price grid: inline editing, ↑/↓/Enter move between rows, Ctrl+S saves, per-row errors, undo per row, "source of today's edits", bulk "mark verified today" (optionally changing source), clearing a price removes it (with confirm).
- All price writes go through `src/lib/price-writes.ts` → PriceHistory (CREATED / UPDATED / DELETED, not for verify-only) + on-demand revalidation paths.
- Search key normalisation (`src/lib/normalize.ts`), BD phone validation, CSV parse/validate, Dhaka dates, freshness/effective price.
- Seed: 20 real Dhaka areas with neighbours, 41 tests with ~200 aliases, 30 "Demo Lab N" labs, random demo prices (~20 % stale), first ADMIN from env. No medical text.

**Verified (2026-11-10)**
- `tsc` clean, ESLint clean, Vitest 33/33, `next build` succeeds.
- Clicked through in Playwright: login/logout, redirect when signed out, dashboard at 360 px, grid keyboard flow (Bangla digits → 1500, Enter moves down, Ctrl+S), validation error row, undo, bulk verify, PriceHistory rows, CSV preview (alias resolution, duplicates, errors) and import, export (401 when signed out), lab form validation + create, test edit (alias dedupe, text → "needs review"), area save, DATA_ENTRY cannot reach Users.
- Search SQL against seeded data: `CBC`, `cbc test er dam`, `সিবিসি টেস্টের দাম`, `C.B.C`, `compleet blod count`, `লিপিড প্রোফাইল`, `ডেঙ্গু`, `usg` all find the right test.

**Not done / not verified**
- Login rate limit not exercised. "50 prices in 10 minutes" not timed with a real person (the flow is type → Enter per price).
- Admin pages other than the dashboard were checked at desktop width only (admin is a desktop tool; public pages get the 360 px treatment in Phase 2).
- Playwright e2e suite (search → test page → booking) belongs to Phases 2/4.

## Decisions

Phase 0: see [docs/PLAN.md §9](docs/PLAN.md). Phase 1 additions:
- Dev DB: embedded-postgres (owner chose it over a FlyNode dev DB, 2026-11-10). Production DB will be FlyNode's, created in Phase 5.
- Verified on our Postgres: `pg_trgm` returns **no trigrams for Bangla** (`show_trgm('সিবিসি') = {}`), so the romanised `searchKey` is required, not optional.
- Versions: Next 16.4.5, React 19.3, Prisma 7.10.1 (npm `latest` is an 8.0 RC), Better Auth 1.7.18, TypeScript 6.0.3 (7.0 is the new native compiler; not adopted yet), ESLint 9 (eslint-config-next 16 flat config).
- Thresholds for lab/area pages: still using the Phase 0 defaults (lab ≥ 5 fresh prices; area ≥ 2 labs with fresh prices) until the owner answers.
- Saving a grid row = verified today, with the row's source. Bulk verify keeps price and source (source optional).
- CSV `test_slug` also accepts an alias that maps to exactly one test (e.g. `CBC`, `সিবিসি`); duplicates are detected on the resolved test.
- CSV import saves valid rows and skips rows with errors (all shown in the preview first).
- Only ADMIN can: mark medical text REVIEWED, set featured, delete, manage users. Any text edit by DATA_ENTRY returns it to DRAFT_NEEDS_REVIEW.
- Delete is allowed only for records with no prices/bookings (labs: untick Active instead). Areas only when empty.
- Seed lab phones are `000-0000-NNNN` placeholders and WhatsApp is empty, so no real person can be called/messaged from demo data.
- Admin UI is English with English digits.

Phase 2 additions:
- Stale prices are shown in a collapsed "পুরনো দাম" group below the fresh list, never in ranges, titles, "cheapest" or search prices.
- Lab and area thresholds use the Phase 0 defaults (lab ≥ 5 fresh prices; area ≥ 2 labs with fresh prices and ≥ 1 published test × area page) — `THRESHOLDS` in `pricing.ts`.
- Lab page lists all its prices (fresh first, stale greyed) — it is about the lab; it still needs ≥ 5 fresh prices to exist.
- The publishable-page index is cached in memory for 60 s and cleared on every admin write. A price going stale on its own shows up within a minute in search/links and at the next daily page revalidation.
- Test display name = Bangla name + (short name or English name), e.g. "কমপ্লিট ব্লাড কাউন্ট (CBC)".
- `/search` redirects only when one test matches exactly and the next result is clearly weaker; otherwise it lists results.
- Filters work on the page without reloading (no URL parameters), so test pages stay fully cacheable; area filtering for SEO is covered by the test × area pages.
- Disclaimer sits under the price list (and in the footer) so the first price card is visible on a 360 × 780 screen.
- Seed now gives demo prices only to labs named exactly "Demo Lab N" — never to labs entered by an admin (fixed after it priced a QA lab).

## Open questions (waiting on owner)

1. Confirm: app-only container, Postgres from FlyNode.
2. Lab/area page thresholds (defaults above).
3. Production domain for `SITE_URL`.
4. GitHub repo URL (no remote/push until told).
5. Should the data-entry helper get Bangla admin labels?

## Known issues

- `next/font` sometimes fails to reach fonts.googleapis.com from this machine in dev (falls back to a system font; the production build did download it). The Docker build on FlyNode needs outbound access to Google Fonts — or we switch to `next/font/local` (self-hosted files) in Phase 3/5.
- Local DB holds extra demo prices (the seed ran twice before it was made idempotent). Reset with `npm run db:reset` (Prisma asks for confirmation) then `npm run db:seed`.
- Local QA users `qa@example.test` (ADMIN) and `qa-entry@example.test` (DATA_ENTRY) exist in the local DB only, from click-through testing. The local QA lab "Demo Lab QA" is inactive and holds 28 demo prices from the old seed behaviour.
- The home page is prerendered at build time, so `next build` currently needs the database. The Docker build on FlyNode has none — to solve in Phase 5 (build-time guard or revalidate-on-start).
- ESLint 9 is flagged "no longer supported" by npm; move to ESLint 10 once eslint-config-next supports it.
