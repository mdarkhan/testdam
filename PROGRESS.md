# PROGRESS — Test Mate (formerly TestDam)

Read this first in a new session, then [docs/BRIEF.md](docs/BRIEF.md) (requirements) and [docs/PLAN.md](docs/PLAN.md) (agreed design).

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0 — Plan | Done (2026-11-10) | Plan, schema, open questions |
| 1 — Data and admin | Done (2026-11-10) | See "Phase 1 report" below |
| 2 — Public pages | Done (2026-11-10) | See "Phase 2 report" below |
| 3 — Technical SEO | Done (2026-11-10) | See "Phase 3 report" below |
| 4 — Booking and tracking | Done (2026-11-10) | See "Phase 4 report" below |
| 5 — Ops and deploy | **Done, deployed** (2026-11-10) — live on FlyNode, waiting for owner review | See "Phase 5 report" below |

**Live:** https://dh4cqjc1w1ip6lyydphgqrkz.flynode.io (FlyNode app `testdam`, builds `main` of github.com/mdarkhan/testdam from the Dockerfile).

**Next steps (owner):** sign in at `/admin/login`, then delete `SEED_ADMIN_PASSWORD` from the FlyNode variables. Enter real labs and prices (pages appear once the thin-content rule is met). Turn on FlyNode database backups. Set the production domain + `SITE_URL` when ready. Once pages exist: Lighthouse and Google Rich Results Test against the live URL, GTM Preview with the real container.

## How to run locally (Windows, no Docker needed)

```bash
npm install
cp .env.example .env      # then set BETTER_AUTH_SECRET and SEED_ADMIN_PASSWORD (10+ chars)
npm run db:start          # terminal 1 — PostgreSQL 18 on localhost:54329, data in ./.pgdata; leave running
npx prisma migrate deploy # terminal 2
npm run db:seed
npm run dev               # http://localhost:3000/admin — sign in with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
```
Checks: `npm run typecheck`, `npm run lint`, `npm test` (pure logic), `npm run test:db` (search against the separate `testdam_test` database — migrates and seeds it first; needs `npm run db:start`), `npm run test:e2e` (Playwright: seeds `testdam_test`, builds into `.next-e2e`, serves on :3200, uses the installed Chrome; needs `npm run db:start`), `npx next build`.

## Phase 5 report

**Built**
- **Call list** `/admin/stale`: labs ordered by stale prices, then "due" (stale within 14 days), then oldest check; tap-to-call phone; offers ending within 7 days; "Open grid" opens the price grid filtered to stale/due rows. `freshness()` (fresh/due/stale) lives in `pricing.ts` with a test.
- **Price history** `/admin/labs/[id]/history` (button in the grid): the append-only log, newest first, filter by test, effective price and ▲/▼ change vs. the previous entry, who and when.
- **Build without a database:** home and `sitemap.xml` render per request from the in-memory catalogue index (test/test × area/lab/area pages stay ISR). Verified: `next build` succeeds with `DATABASE_URL` pointing at a closed port.
- **First-start bootstrap** (`src/instrumentation.ts` → `src/lib/bootstrap.ts`): on an empty database loads the 20 areas + neighbours and 41 tests + aliases (no labs, no prices, no medical text) and creates the first ADMIN from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`; no-op afterwards. The demo seed now reuses the same catalogue data.
- **Dockerfile** (multi-stage, node:22-bookworm-slim, standalone output, non-root user, `HEALTHCHECK`), `.dockerignore`; start command = `prisma migrate deploy` (small Prisma CLI in `/migrator`) then `node server.js`. `GET /api/health` checks the database.
- `NEXT_PUBLIC_GTM_ID` is read at **runtime** (Next inlined it at build time, even through a constant string concatenation — found by inspecting the compiled output; now read via a dynamic key and verified).
- **README.md** (local setup, scripts, env table, FlyNode deploy steps, GTM event table, operations) and **docs/DATA-ENTRY-GUIDE.md** (daily call routine, grid, CSV, bookings, rules, quick answers).

**Verified (2026-11-10)**
- `tsc` clean, ESLint clean, Vitest 66/66, `npm run test:db` 19/19, Playwright e2e 3/3.
- Simulated container start on this machine (no Docker here): build with no database → `prisma migrate deploy` on a brand-new empty database → standalone `node server.js` with env vars only: log shows `[bootstrap] Loaded 20 areas and 41 tests.` and `Created ADMIN user …`; `/api/health` `{"ok":true}`; robots/sitemap/home 200; test and area pages 404 (no prices yet — thin-content rule); GTM snippet present from the runtime env var; the bootstrapped admin signs in (200 + session cookie) and opens `/admin`. Second start: bootstrap did nothing. Temporary database dropped afterwards.
- Lighthouse 13.6 mobile on the standalone build: `/` 100/100/100/100 (LCP 0.7 s, server 20 ms — now rendered per request), `/test/cbc` 100/100/100/100.
- Clicked through: call list, filtered grid, price history (CBC 130 → 110 shows ▼ 20 with user and time).

**Deployed (2026-11-10)**
- Pushed to github.com/mdarkhan/testdam (`main`). FlyNode app `testdam` with a FlyNode PostgreSQL database wired as `DATABASE_URL`.
- First build failed: FlyNode injects app variables (`NODE_ENV=production`) into build steps, so `npm ci` skipped devDependencies (`@tailwindcss/postcss`). Fixed with `npm ci --include=dev` (ff447c2).
- Runtime log: migration applied (`pg_trgm` created), `[bootstrap] Loaded 20 areas and 41 tests.`, then after the owner set the variables via FlyNode's secure form: `Created ADMIN user`. Docker `HEALTHCHECK` passes.
- Live smoke test: `/api/health` `{"ok":true}`; `/`, `/admin/login`, robots.txt, sitemap.xml 200; canonical, `og:url`, robots `Sitemap:` and sitemap `<loc>` all use the live URL; admin sends `X-Robots-Tag: noindex`; `/test/cbc` and `/area/mirpur` 404 as expected (no prices yet). No demo data in production.

**Not done / not verified**
- Owner signed in to the live admin (2026-11-10). The first password was mangled by FlyNode (a dollar sign in a variable value is treated as a variable reference), so `ADMIN_RESET_PASSWORD` start-up recovery was added (e9ade8e) and used. Owner to remove `ADMIN_RESET_PASSWORD` and `SEED_ADMIN_PASSWORD` from FlyNode.
- Lighthouse / Rich Results / GTM Preview on the live URL: wait until real prices make test pages exist.
- Backups: not configured (FlyNode side) — README says what to do.

## Phase 4 report

**Built**
- Booking: every price card has a large "বুক করুন" button → bottom-sheet dialog (name, mobile, preferred date [default tomorrow, today…+60 days, Dhaka], home collection when the lab offers it for this test). Server action `createBooking` re-reads the price from the database (never trusts the browser), stores `BookingRequest` (status NEW, price snapshot, area, UTM + referrer + landing path), and returns the id. Confirmation shows the request number.
- Validation (`src/lib/booking.ts`): BD mobile (with/without +880, Bangla digits OK), name 2–80 chars, date window; Bangla error messages shown next to each field.
- Spam protection (no CAPTCHA): hidden honeypot field (bot submissions get a fake success and nothing is stored), in-memory rate limits 5 requests / 10 min per IP and 3 / day per phone.
- Call (`tel:`) and WhatsApp (pre-filled Bangla message naming the test and lab; `WHATSAPP_CENTRAL_NUMBER` overrides each lab's number) — tracked.
- dataLayer (`src/lib/analytics.ts`): `search`, `view_test_prices`, `booking_form_open`, `generate_lead` (only after the server confirms, with `booking_id`), `whatsapp_click`, `call_click` — snake_case, typed, and filtered through an allow-list so name/phone can never be pushed. One listener per page handles all cards (cards stay server components).
- GTM: loaded on public pages only when `NEXT_PUBLIC_GTM_ID` is set (format-checked `GTM-XXXX`), `afterInteractive`, plus the `<noscript>` iframe. No GA4 tags in code.
- UTM capture: a tiny inline script stores `utm_*`, external referrer and landing path in sessionStorage on the landing page (first touch per session); sent with the booking.
- Admin inbox `/admin/bookings`: open / per-status tabs with counts, patient name + tap-to-call phone, test, lab (call lab, "Forward on WhatsApp" with the booking details pre-filled, link to lab prices), preferred date, home collection, price shown, attribution; status + notes form. "Bookings" nav badge and dashboard card show NEW count.

**Verified (2026-11-10)**
- `tsc` clean, ESLint clean, Vitest 65/65 (new: booking validation incl. Dhaka "today" and Bangla digits, attribution cleaning, dataLayer allow-list drops name/phone, rate limiter), `npm run test:db` 19/19, `next build` OK.
- **Playwright e2e 3/3 at 360 px** (production build, test DB): Bangla search → suggestion → CBC page → cards (no tables, cheapest marked) → booking form → empty submit shows field errors → valid submit → confirmation; dataLayer contains `search` (term সিবিসি), `view_test_prices`, `booking_form_open`, `generate_lead` (numeric booking id, lab and area) in order, and no name/phone anywhere; the stored booking has status NEW, server price = event price, and the landing UTM (`e2e/test/phase4`). Call and WhatsApp taps push `call_click` / `whatsapp_click`. Unknown test → 404.
- Manually at 360 px: card buttons, booking sheet, a real booking on the dev DB (dataLayer shown above in the session: 3 events, no personal data), admin inbox, status change to "Forwarded to lab" (badge cleared, counts updated), console clean.
- GTM: with a dummy ID the public HTML contains `gtm.js?id=…` and the noscript iframe; admin pages contain no GTM.

**Not done / not verified**
- GTM/GA4 not tested with your real container (no ID yet) — once set, check events in GTM Preview.
- Rate limits are per container process (reset on restart; not shared across several containers).
- No SMS/email notification for new bookings — check the inbox (badge). Out of scope per the brief.
- The booking needs JavaScript; without JS visitors can still call.

## Phase 3 report

**Built**
- `src/lib/seo.tsx`: `pageMetadata` (title, Bangla description, canonical, Open Graph `bn_BD`, Twitter card), JSON-LD builders (`breadcrumbLd`, `priceListLd`, `labLd`), `JsonLd` renderer (escapes `<`), `buildSitemap`.
- Titles/descriptions carry test name, area and the current fresh price range, e.g. `বাড্ডা এলাকায় কমপ্লিট ব্লাড কাউন্ট (CBC) টেস্টের দাম ৳১৩০ – ৳২৪০ | টেস্টদাম`. Lab and area descriptions include their price range too.
- Structured data, only for visible content: BreadcrumbList on test, test × area, lab and area pages (rendered by the visible breadcrumb component); ItemList (labs in shown order with price) on test and test × area pages; MedicalClinic on lab pages (name, address, phone, map link). No review/rating markup (tested).
- `sitemap.xml` from the same index that decides 404s; `lastModified` = newest fresh verification behind each page; hourly + on-demand regeneration.
- `robots.txt`: disallows `/admin`, `/api/`, `/search`; points to the sitemap. Admin has `noindex` metadata plus an `X-Robots-Tag: noindex, nofollow` header on `/admin/**` and `/api/**`.
- `metadataBase` from `SITE_URL`; SVG app icon (৳ on teal).

**Verified (2026-11-10)**
- `tsc` clean, ESLint clean, Vitest 57/57 (new: sitemap = published pages only, lastmod, JSON-LD escaping, no rating markup, canonical/OG), `npm run test:db` 19/19, `next build` OK.
- Production server: robots and sitemap (301 URLs) correct; admin returns `X-Robots-Tag`; every JSON-LD block parses.
- On-demand revalidation, end to end in production: changed Demo Lab 13's CBC discount 130 → 110 in the price grid → `/test/cbc`, `/test/cbc/badda`, `/lab/demo-lab-13-badda`, `/` and `/sitemap.xml` re-rendered immediately (cache MISS) with ৳১১০ in the title and page.
- **Lighthouse 13.6 (mobile, simulated throttling), production build on localhost:**

  | Page | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
  |---|---|---|---|---|---|---|---|
  | `/` | 100 | 100 | 100 | 100 | 0.8 s | 30 ms | 0 |
  | `/test/cbc` | 100 | 100 | 100 | 100 | 0.8 s | — | 0 |
  | `/test/cbc/badda` | 100 | 100 | 100 | 100 | 0.8 s | — | 0 |
  | `/lab/demo-lab-1-mirpur` | 100 | 100 | 100 | 100 | 0.8 s | 30 ms | 0 |
  | `/area/badda` | 100 | 100 | 100 | 100 | 0.8 s | 80 ms | 0 |

  First run had test pages at 99 accessibility (`heading-order`: cards were `h3` without an `h2`); fixed with a "ল্যাব অনুযায়ী দাম" heading and re-run → 100. Test pages before the fix: TBT 110 ms / 50 ms.

**Not done / not verified**
- Scores are from localhost: real Dhaka mobile networks add latency the simulation only approximates. Re-run against the deployed site in Phase 5.
- No Open Graph image (no brand artwork yet). Home has no BreadcrumbList (it shows no breadcrumb; the brief's "visible only" rule wins).
- Not checked in Google's Rich Results Test (that needs a public URL — Phase 5).
- Lighthouse "unused/legacy JavaScript" hints remain (framework code); scores are unaffected.
- My local `.next` build was made with `SITE_URL=http://localhost:3100` for the Lighthouse run; any new build uses `.env`.

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

Phase 0: see [docs/PLAN.md §9](docs/PLAN.md).

**Web-collected prices (2026-11-10, owner asked):** the owner asked for real prices collected online, removable in one go before entering verified data. Sources are only labs' **own** websites with a public price list (owner chose "official sites only, Dhaka only" when asked to cover every lab): Popular Diagnostic Centre (8 Dhaka branches; prices differ by branch), Healthcare Diagnostics Center (Shyamoli, pathology + radiology pages), Monowara Orthopedic & General Hospital (Kamalapur), Aalok Healthcare (Mirpur 10; its rate list also gives report times), BMU Super Specialized Hospital (Shahbag; no phone published, so no call button), NILMRC (government lab, Sher-e-Bangla Nagar; official PDF rate list). 768 prices, 65 tests, 13 labs. ~55 other Dhaka hospital/lab sites were checked (Ibn Sina, Labaid, Square, Evercare, United, Medinova, Green Life, BRB, Bangladesh Specialized, Asgar Ali, Impulse, Praava, icddr,b, Padma, PDCL, DMCH/govt institutes…): no per-test price list on their own site, site down, or only packages. Older PDFs (DCH 2024, Heart Foundation 2019, Samorita on a bank's site) were skipped as out of date or not the lab's own site. Government/public-university rates (NILMRC, BMU) are exempt from the "too low" outlier check. Aggregator sites (medtestbd, hospitalbangla, arogga, sasthyaseba…) were not used: their figures conflict and it is their collected data. Ibn Sina, Labaid, Praava, Square, Evercare, United and others publish no per-test price list on their own sites. One price skipped as a likely typo on the source (Monowara creatinine ৳4,000 vs ৳400 elsewhere). 24 common tests and the areas "Puran Dhaka", "Shahbag" and "Sher-e-Bangla Nagar" were added to the catalogue (names and search aliases only). Schema: nullable `importBatch` on Lab, LabTestPrice and PriceHistory (migration `web_import_batch`, additive). Imported prices hide the home-collection line on public cards (unknown, not "no"). The download/matching script stayed out of the repo (one-off, not a scraping feature).

**Rename (2026-11-10, owner):** the product is **Test Mate**. The public site shows "Test Mate" (`bn.siteName`, used in every title, header and Open Graph tag); Bangla sentences spell it "টেস্ট মেট". Internal names left as `testdam` on purpose: the local dev database/user (renaming would orphan `.pgdata`), the GitHub repo and the FlyNode app (owner can rename those; the deploy keeps working either way). Changing the public domain later only needs `SITE_URL`.

Phase 1 additions:
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

Phase 3 additions:
- Breadcrumb JSON-LD is emitted by the same component that draws the visible breadcrumb, so markup and page cannot drift apart.
- ItemList lists fresh prices only (the stale group is collapsed and not "the list").
- `/search` is disallowed in robots and `noindex` — search result pages are thin by nature.
- Sitemap `lastModified` = newest fresh verification behind the page (honest dates, not "now").
- Canonical/OG URLs depend on `SITE_URL`; until the domain is set they point at localhost.

Phase 4 additions:
- Booking allowed on stale prices too (the visitor may still want that lab); such bookings get an admin note "Price was stale … confirm with the lab".
- `area_slug` in events/bookings = the page's area on test × area pages, otherwise the lab's area.
- `generate_lead.price` and the stored `priceAtRequest` come from the server, not the card.
- Attribution is first-touch per browser session (sessionStorage), so a later click with other UTMs in the same session doesn't overwrite it.
- Search suggestions and the search form navigate client-side, so the `search` event isn't lost to a full page load (found by the e2e test).
- e2e runs against a production build in `.next-e2e` (dev-mode recompiles reloaded the page mid-test).
- e2e uses a placeholder central WhatsApp number (01300000000) only inside its own build so WhatsApp buttons exist; the test blocks the link.
- **Bangla digits (2026-11-11, owner):** Hind Siliguri's ১ was hard to read, so ০–৯ come from a 4 KB digits-only subset of Noto Sans Bengali (`src/app/fonts`, OFL), loaded with `unicode-range` ahead of Hind Siliguri.
- **Home redesign (2026-11-11, owner chose it from the improvement list):** the signature element is the price-spread bar (`price-spread.tsx`): one line from the cheapest to the dearest fresh price, a dot per lab, cheapest in green. It shows in the home hero (the popular test compared at the most labs), on every popular test, and in the range box on test pages. New shared header (৳ logo tile, Tests/Labs menu with the current page marked) and footer pinned to the bottom. New index pages `/tests` (by category) and `/labs` (by area), both following the thin-content rule and listed in the sitemap. The home facts (labs, tests, prices) and the "save up to ৳…" line are computed from fresh prices in the index (`spreads`, `totals` in `buildIndex`), never typed in.

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
- ~~`next build` needed the database~~ — fixed in Phase 5 (home and sitemap render per request).
- `next build` downloads the Bangla font from Google Fonts — the build machine needs internet access.
- `next start` warns that it doesn't fit `output: "standalone"`; production uses `node server.js` (Dockerfile). The e2e test still uses `next start` on its own build — harmless.
- ESLint 9 is flagged "no longer supported" by npm; move to ESLint 10 once eslint-config-next supports it.
