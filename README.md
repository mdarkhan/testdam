# TestDam (টেস্টদাম)

Compare diagnostic test prices across labs in Dhaka, with the date each price was last verified, and send a booking request.
Public site in Bangla, admin in English. One Docker container + PostgreSQL, configured only through environment variables.

- Requirements: [docs/BRIEF.md](docs/BRIEF.md) · Design: [docs/PLAN.md](docs/PLAN.md) · Status, decisions, known issues: [PROGRESS.md](PROGRESS.md)
- Guide for the data-entry helper: [docs/DATA-ENTRY-GUIDE.md](docs/DATA-ENTRY-GUIDE.md)

**Stack:** Next.js 16 (App Router, ISR) · TypeScript · PostgreSQL + Prisma 7 (`pg_trgm` search) · Tailwind 4 · Better Auth (admin only) · Google Tag Manager · Vitest + Playwright.

---

## Run it locally (Windows/macOS/Linux, no Docker needed)

Requires Node.js 22.

```bash
npm install
cp .env.example .env          # set BETTER_AUTH_SECRET and SEED_ADMIN_PASSWORD (10+ characters)
npm run db:start              # terminal 1: PostgreSQL 18 from npm on localhost:54329 (data in ./.pgdata) — leave it running
npx prisma migrate deploy     # terminal 2
npm run db:seed               # demo data: 20 areas, 41 tests, 30 "Demo Lab N" labs with FAKE prices
npm run dev                   # http://localhost:3000 — admin at /admin
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:start` | Local PostgreSQL (embedded-postgres), databases `testdam` and `testdam_test` |
| `npm run db:seed` | Catalogue + demo labs/prices (local only — never run against production) |
| `npm run db:migrate` | Create a new migration while developing (`prisma migrate dev`) |
| `npm run typecheck` · `lint` | TypeScript, ESLint |
| `npm test` | Unit tests (ranking, freshness, thin-content rule, search normalisation, CSV, booking, SEO) |
| `npm run test:db` | Search acceptance tests against `testdam_test` (needs `db:start`) |
| `npm run test:e2e` | Playwright: Bangla search → test page → booking at 360 px, dataLayer checks (needs `db:start` and Google Chrome) |

## Environment variables

| Variable | Required | Example / default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://user:pass@host:5432/testdam` | PostgreSQL 14+ with the `pg_trgm` extension available (the first migration creates it). |
| `BETTER_AUTH_SECRET` | yes | 64 random hex chars | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SITE_URL` | yes | `https://testdam.example` | Public origin, no trailing slash. Used for canonical URLs, sitemap, Open Graph and admin login. |
| `SEED_ADMIN_EMAIL` | first start | `you@example.com` | Creates the first ADMIN **only when no user exists**. |
| `SEED_ADMIN_PASSWORD` | first start | 10+ characters | Remove it after the first login (it is ignored once a user exists). |
| `NEXT_PUBLIC_GTM_ID` | no | `GTM-XXXXXXX` | Empty = no GTM. Read at runtime — no rebuild needed. |
| `FRESH_DAYS` | no | `90` | Days a price stays "fresh". |
| `WHATSAPP_CENTRAL_NUMBER` | no | `01XXXXXXXXX` | Empty = each lab's own WhatsApp number. |
| `PORT` | no | `3000` | Set by the Docker image. |

## Deploy to FlyNode (Docker)

The `Dockerfile` builds **without a database**. On start the container:
1. runs `prisma migrate deploy` (applies pending migrations),
2. starts the Next.js standalone server,
3. on an **empty** database, loads the 20 areas and 41 tests with search aliases (no labs, no prices) and creates the first ADMIN from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. On later starts this does nothing.

Steps:
1. Push this repository to GitHub (private is fine).
2. In FlyNode, create an app from the repository. FlyNode builds the `Dockerfile`; the app listens on port **3000**.
3. Add a **PostgreSQL** database to the app. Make sure the app gets it as `DATABASE_URL` (if FlyNode names the variable differently, add `DATABASE_URL` with the same value).
4. Set the variables from the table above — at least `BETTER_AUTH_SECRET`, `SITE_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`. Use FlyNode's secret form; never commit them.
5. Deploy. In the logs you should see `[bootstrap] Loaded 20 areas and 41 tests.` and `Created ADMIN user …`.
6. Open `https://<your-domain>/api/health` → `{"ok":true}`. Sign in at `/admin/login`, then delete `SEED_ADMIN_PASSWORD` from the variables.
7. Add labs and prices (see the data-entry guide). Pages appear automatically once the thin-content rule is met: a test page needs 3 labs with a fresh price, a test × area page 2 labs in that area, a lab page 5 fresh prices, an area page 2 labs with fresh prices.
8. Point your domain at the app, set `SITE_URL` to it and redeploy. Then submit `https://<domain>/sitemap.xml` in Google Search Console.

**Health check:** `GET /api/health` (200 when the app and database are fine, 503 otherwise). The image also has a Docker `HEALTHCHECK`.

**Updating:** push to GitHub and redeploy. New migrations are applied automatically on start. Never edit a migration that has already been applied — create a new one with `npm run db:migrate`.

### Google Tag Manager setup (inside GTM, not in code)

The site pushes these events to `dataLayer` (no personal data):

| Event | Parameters |
|---|---|
| `search` | `search_term`, `results_count` |
| `view_test_prices` | `test_slug`, `area_slug` (test × area pages), `lab_count`, `min_price` |
| `booking_form_open` | `test_slug`, `lab_slug`, `area_slug`, `price` |
| `generate_lead` | `test_slug`, `lab_slug`, `area_slug`, `price`, `booking_id` (fires only after the server saved the booking) |
| `whatsapp_click` / `call_click` | `test_slug`, `lab_slug`, `area_slug` |

In GTM create Data Layer Variables for the parameters, a Custom Event trigger per event, and GA4 Event tags. Check them in GTM Preview mode.

## Operations

- **Backups:** the database holds all prices, price history and booking requests. Turn on FlyNode's database backups if available, or schedule `pg_dump` (daily is enough).
- **Single container on purpose:** the ISR page cache, the login rate limit and the booking spam limits live in the container. Running several copies would need a shared cache (not built).
- **Freshness happens by itself:** pages re-render daily, so prices that pass 90 days turn grey and drop out of rankings without anyone editing them. Use the admin **Call list** to re-check them before that.
- **On-demand updates:** every save in the admin refreshes the affected public pages immediately.
- **Fonts:** the Bangla font (Hind Siliguri) is downloaded from Google Fonts during the build, so the build needs internet access (normal on FlyNode).
- **Medical text:** test descriptions and preparation notes show on the public site only after an ADMIN marks them "Reviewed".

## Project layout

```
prisma/            schema, migrations, demo seed
src/app/(public)/  home, /test/[slug], /test/[slug]/[area], /lab/[slug], /area/[slug], /search, booking action
src/app/admin/     admin (labs, price grid, tests, areas, CSV, call list, bookings, users)
src/lib/           pricing rules, search, catalogue index, SEO, booking, analytics, auth, bootstrap
src/i18n/bn.ts     every public UI string
tests/ e2e/        Vitest and Playwright
```
