# Test Mate — Phase 0 Plan

Status: **proposal, waiting for owner OK** (2026-11-10). Brief: [BRIEF.md](BRIEF.md). Schema: [../prisma/schema.prisma](../prisma/schema.prisma) (validated with Prisma 7.10.1).

## 1. Versions (pinned in Phase 1)

| Piece | Version | Note |
|---|---|---|
| Node | 22 LTS | matches local machine (22.17.1) and the Docker base image |
| Next.js | 16.4.x (App Router) | classic ISR (`revalidate` + `revalidatePath`); Cache Components left off — fewer moving parts |
| Prisma | **7.10.1** | npm's `latest` tag currently points at an 8.0 **RC**; we pin the stable 7.x line |
| Better Auth | 1.7.x | admin auth |
| Tailwind | 4.x | |
| Vitest / Playwright | current stable | |

## 2. Auth choice

**Better Auth** — actively developed, built-in email + password with a first-party Prisma adapter, and a `role` field is a one-line `additionalFields` entry (Auth.js's credentials provider is deliberately minimal and its project is now in maintenance under the Better Auth team).

Setup: email + password only, public sign-up **disabled**; users are created by the seed script (first ADMIN from env vars) and by an ADMIN in `/admin/users`. Every admin route and server action checks the session role server-side (`requireRole('DATA_ENTRY' | 'ADMIN')`). `DATA_ENTRY` can manage prices/labs/tests/bookings; only `ADMIN` can manage users and delete labs/tests.

## 3. Schema — refinements over the brief

See the schema file for fields. The changes worth reviewing:

- **Effective price and freshness are computed, never stored** — both depend on "now", so storing them would go stale silently. One module (`src/lib/pricing.ts`) owns `effectivePrice()`, `isFresh()`, `rankPrices()`, `isEligible…()`; all pages, the sitemap, and tests use it.
- **Money is `Int` taka.** Discount must be lower than regular price (validated). `discountExpiresAt` is stored as the UTC instant of the end of that day in Dhaka.
- **`reportHours Int?`** instead of free text, so the "report time" filter can work (≤ 24h "আজকেই", ≤ 48h, any). Display is generated ("৬ ঘণ্টা", "২ দিন").
- **Test names become aliases.** On save, `nameEn`, `nameBn`, `shortName` are upserted as `TestAlias` rows, so search queries one table.
- **`TestAlias.searchKey`** — the normalised, ASCII-romanised key that the trigram index runs on (why: §5).
- **`Area.neighbors`** — hand-curated self-relation for "same test in nearby areas". `Area.aliases String[]` for spellings used when parsing queries like "cbc mirpur".
- **`Lab.isFeatured`** (badge only, never in sort) and **`Lab.isActive`** (hide without deleting).
- **`PriceHistory`** keyed by lab + test (survives a deleted price row), written in the same DB transaction as any change to price fields. A verify-only update (just `verifiedAt`) is **not** a price change and is not logged.
- **`BookingRequest.priceAtRequest`** snapshots the price the visitor saw; `areaSlug` keeps the page context for reporting.
- **Auth tables** follow Better Auth's Prisma shape; in Phase 1 I run its generator and reconcile before the first migration.
- `Test.popularRank` drives "popular tests" on Home without a separate table.

## 4. Folder structure

```
prisma/
  schema.prisma
  migrations/              # first one hand-edited: CREATE EXTENSION pg_trgm
  seed.ts                  # 20 real areas, ~40 tests + aliases, "Demo Lab N" labs, fake prices
prisma.config.ts
src/
  app/
    (public)/              # GTM loaded here only; Bangla digits
      layout.tsx
      page.tsx                         # Home
      test/[slug]/page.tsx             # Test
      test/[slug]/[area]/page.tsx      # Test × area
      lab/[slug]/page.tsx
      area/[slug]/page.tsx
      search/page.tsx                  # results for "Enter" with no single match (noindex)
      not-found.tsx
    admin/                 # noindex, English digits, session-protected
      layout.tsx  login/  page.tsx (dashboard = stale prices + new bookings counts)
      labs/  labs/[id]/prices/ (price grid)  tests/  areas/  import/  bookings/  users/
    api/
      auth/[...all]/route.ts           # Better Auth handler
      search/route.ts                  # suggestions JSON
    sitemap.ts  robots.ts
  components/              # PriceCard, PriceList, Filters (client), SearchBox (client), BookingSheet (client), admin/*
  lib/
    db.ts  config.ts  auth.ts
    pricing.ts             # effective price, freshness, ranking, thin-content eligibility
    search.ts              # normalise, romanise, query
    format.ts              # Bangla digits, ৳, Asia/Dhaka dates
    phone.ts               # BD mobile validation/normalisation
    revalidate.ts          # paths affected by a price/lab/test change
    analytics.ts           # typed dataLayer push (client)
    csv.ts                 # parse + validate import rows
  i18n/bn.ts               # every UI string
  generated/prisma/        # Prisma client output (git-ignored)
tests/                     # Vitest: pricing, search, phone, csv, eligibility
e2e/                       # Playwright: search → test page → booking
Dockerfile  .env.example  PROGRESS.md  README.md (Phase 5)
```

## 5. Search with Bangla, English, synonyms and misspellings

**Normalisation (`normalize()`, shared by indexing and querying, unit-tested):**
1. Unicode NFC; Bangla digits → ASCII; lower-case; punctuation (`. - _ / ( )`) → space; collapse spaces. So `C.B.C`, `cbc`, `CBC test` line up.
2. Bangla canonicalisation of common typing variants: `য়` ↔ `য়`, `ড়/ঢ়` decomposed forms, ZWJ/ZWNJ removed, `ী→ি`, `ূ→ু` (people mix long/short vowels freely).
3. Strip filler words in both scripts: `test, টেস্ট, টেষ্ট, price, dam, daam, দাম, er, এর, koto, কত, rate, cost, fee, in, dhaka, ঢাকা, te, এ`.
4. Detect an area token (`Area.slug / nameEn / nameBn / aliases`) — removed from the test query and kept as `areaSlug` so "CBC test price Mirpur" can land on `/test/cbc/mirpur`.

**Romanised search key.** Postgres `pg_trgm` decides which characters are "word" characters from the database locale. Bangla vowel signs (ি, ু, ্ …) are combining marks, not letters, so trigrams on raw Bangla get split into one-letter fragments, and under a `C` locale Bangla letters are dropped entirely. To make fuzzy matching work regardless of FlyNode's DB locale, `searchKey = romanise(normalize(alias))` using a small fixed Bangla→Latin table (`সিবিসি → sibisi`, `লিপিড প্রোফাইল → lipid profail`). The query is romanised the same way. Bonus: Banglish queries (`lipid profail`) now land near Bangla aliases.

**Query (one SQL, `search.ts`):**
```sql
SELECT t.slug, t."nameEn", t."nameBn",
       max(greatest(similarity(a."searchKey", $1), word_similarity($1, a."searchKey"))) AS score
FROM "TestAlias" a JOIN "Test" t ON t.id = a."testId"
WHERE a."searchKey" % $1 OR a."searchKey" LIKE $1 || '%'
GROUP BY t.id ORDER BY (bool_or(a."searchKey" = $1)) DESC, score DESC LIMIT 8;
```
Exact alias match wins, then prefix, then trigram similarity (threshold tuned in tests, starting at 0.3).

**UI:** `SearchBox` (client) debounces 150 ms → `GET /api/search?q=` (tiny JSON, `Cache-Control: s-maxage=300`). Choosing a suggestion → test page (or test × area page if an area was detected and that page is eligible, otherwise test page). Enter with one strong match → redirect; otherwise `/search?q=` (noindex). Only tests with a published page are suggested.

**Acceptance tests (Vitest, against a seeded test DB):** `CBC`, `cbc test er dam`, `সিবিসি`, `সিবিসি টেস্টের দাম`, `complete blood count`, `compleet blod count`, `C.B.C`, `cbc mirpur` all resolve to `cbc` (and `mirpur`).

## 6. Freshness, ranking, thin content (all in `pricing.ts`)

- `isFresh(p, now) = now - p.verifiedAt ≤ FRESH_DAYS` (env, default 90).
- `effectivePrice(p, now)` = discount if set and (no expiry or expiry ≥ now) else regular.
- `rankPrices(rows, now)` → fresh rows sorted by effective price (tie: report time, then lab name — deterministic); then stale rows in a separate greyed "পুরনো তথ্য" group, also by price. `isFeatured` is never read by the sort (test asserts a featured expensive lab stays below a cheaper one). Only the first **fresh** row gets the "সবচেয়ে কম" highlight.
- Eligibility (shared by pages, `generateStaticParams`, sitemap, search suggestions):
  - test page: ≥ 3 active labs with a fresh price;
  - test × area: ≥ 2 active labs **in that area** with a fresh price;
  - lab page and area page: see Open question 3 (my default below);
  - not eligible → `notFound()` (real 404) and omitted from the sitemap.

## 7. URL map

| URL | Render | Index? |
|---|---|---|
| `/` | ISR | yes |
| `/test/[testSlug]` e.g. `/test/cbc` | ISR, 404 unless eligible | yes |
| `/test/[testSlug]/[areaSlug]` e.g. `/test/cbc/mirpur` | ISR, 404 unless eligible | yes |
| `/lab/[labSlug]` e.g. `/lab/demo-lab-1-mirpur-10` | ISR, 404 unless eligible | yes |
| `/area/[areaSlug]` e.g. `/area/mirpur` | ISR, 404 unless eligible | yes |
| `/search?q=` | dynamic | noindex, follow |
| `/sitemap.xml`, `/robots.txt` | ISR | — |
| `/api/search?q=` | dynamic, edge-cacheable | blocked |
| `/admin/**`, `/api/auth/**` | dynamic, auth | noindex + `Disallow` |

Slugs are ASCII, lower-case, hyphenated, and never change once published (a slug change would need a redirect — out of scope; admin UI warns).

## 8. ISR and on-demand revalidation

- Public pages: `export const revalidate = 86400` (daily) **plus** on-demand. The daily pass matters: a price crossing the 90-day line changes rankings and eligibility **without any admin edit**, so pages must re-render on their own.
- **Build without a database.** `docker build` on FlyNode has no DB, so `generateStaticParams` returns `[]` and `dynamicParams = true`: every page renders on first request, then is served from the ISR cache. A small post-deploy script (`npm run warm`) requests every sitemap URL so visitors never hit a cold page.
- **On-demand:** every admin server action that changes data calls `revalidateFor(change)` in `lib/revalidate.ts`, which computes exact paths and calls `revalidatePath()` for each:
  - price saved/deleted/verified (single, grid, CSV, bulk) → `/test/{t}`, `/test/{t}/{labArea}`, `/lab/{l}`, `/area/{labArea}`, `/`, `/sitemap.xml`; bulk operations de-duplicate the set.
  - lab edited (area/active/featured) → the lab page, its old and new area pages, and every test page it has prices on.
  - test/alias edited → that test's pages + `/`.
  - area edited → area page + its test × area pages.
- ISR cache lives on the container's filesystem. Fine for one container (the brief's target); if we ever run 2+ instances we'd need a shared cache handler — noted, not built.

## 9. Other decisions (simplest reasonable reading)

1. **"Single Docker container with PostgreSQL"** = one app container; Postgres is FlyNode's managed DB reached via `DATABASE_URL`. Migrations run at container start (`prisma migrate deploy`).
2. Bangla font: **Hind Siliguri** via `next/font/google` (self-hosted at build), weights 400 + 600 only, `display: swap`, subsets `bengali` + `latin`.
3. Colours: primary teal `#0F766E`, cheapest green `#15803D`, stale grey `#6B7280` on white — all ≥ 4.5:1 on white.
4. Stale prices show in a collapsed group below fresh ones on test pages, never in the price range, the "cheapest" highlight, meta descriptions, or `min_price` events.
5. Discount expiry is inclusive through the end of that day in Dhaka.
6. Phone validation: `^(?:\+?880|0)?1[3-9]\d{8}$`, stored as `01XXXXXXXXX`.
7. Booking `area_slug` = page's area if on a test × area page, else the lab's area.
8. Booking is a server action that returns `{ id }`; the client pushes `generate_lead` only after that. Rate limit: in-memory, 5 requests / 10 min per IP (single container), plus a honeypot field.
9. WhatsApp: `WHATSAPP_CENTRAL_NUMBER` env; empty → lab's own number.
10. Bulk "mark verified today" sets `verifiedAt = now`, `verifiedBy = me`, keeps price and source; optional source override.
11. CSV format (one lab per file, or `lab_slug` column for many): `lab_slug,test_slug,regular_price,discount_price,discount_expires,report_hours,home_collection,source,source_note`. Preview shows new / changed / unchanged / error rows; nothing is saved until "Confirm".
12. Lab page lists stale prices greyed too (a lab page is about the lab), but its "last updated" date is the newest `verifiedAt`.
13. Medical content: seed tests get `description = null`, `preparationNote = null`, `DRAFT_NEEDS_REVIEW`. Public pages render those fields only when `REVIEWED`. Admin shows a "needs review" filter.
14. Admin is English-only UI (it's for you and your helper) — only public strings go in `i18n/bn.ts`. Tell me if your helper prefers Bangla admin labels.

## 10. Open questions for you

1. **Local database for development.** This machine has no Docker and no PostgreSQL. Which should I use for Phase 1?
   (a) you install PostgreSQL 16+ locally (I'll give the one-line installer command), (b) you install Docker Desktop, or (c) a separate **dev** database on FlyNode (I'd create it via the FlyNode connector — please confirm, and confirm it has no cost).
2. **Container / DB** — confirm decision 9.1: app-only container, Postgres provided by FlyNode.
3. **Thin-content rule for lab and area pages.** The brief sets thresholds only for test pages. My default: **lab page** needs ≥ 5 fresh prices; **area page** needs ≥ 2 active labs with fresh prices and ≥ 1 eligible test × area page. OK?
4. **Domain** for canonical URLs and the sitemap (`SITE_URL`) — not blocking; I'll use `http://localhost:3000` until you tell me.
5. **GitHub** — I'll `git init` locally and commit per phase. I won't add a remote or push until you give me the repo URL and say so.
