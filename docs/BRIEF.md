# TestDam — Project Brief (source of truth)

> Copied from the owner's original brief on 2026-11-10. Obvious punctuation lost in the paste (slashes, colons) has been restored; wording is otherwise unchanged. If this file and a later instruction from the owner disagree, the owner's instruction wins — record it under Decisions in `PROGRESS.md`.

Working name: **TestDam** (টেস্টদাম). Rename freely later. **Renamed to Test Mate (টেস্ট মেট) by the owner on 2026-11-10** — the rest of this brief keeps the original wording.

## Your role

You are the lead engineer building TestDam: a fast, SEO-first website that lets people in Dhaka compare diagnostic test prices across labs and send a booking request. You build it in phases and stop for my review at the end of each phase.

## Why this exists (read first — it explains most of the decisions below)

In Dhaka, the same diagnostic test can cost very different amounts at different labs — sometimes nearly double. Patients usually have no way to know this, so they pay whatever the nearest or doctor-referred lab charges. People already search Google for things like "CBC test price Dhaka" and "সিবিসি টেস্টের দাম", and the answers they find are scattered, outdated, or missing.

TestDam answers that search with a trustworthy comparison: test → labs in your area → price, report time, home collection, and when the price was last verified.

The whole business rests on two things, so protect them in every decision:
1. **Trust in the data.** Every price shows its source and when it was last verified. Stale prices are clearly marked. Sponsored placement never changes the price ranking.
2. **Organic search traffic.** Pages must be fast, indexable, and genuinely useful — not thin auto-generated pages.

Later we'll earn money from booking commissions and clearly labelled featured listings. The MVP only needs to capture booking requests and track them properly.

## Who uses it

- **Visitors** (patients and their families): mostly on cheap Android phones over mobile data. They search in Bangla, in English, or mixed ("CBC test er dam"). Many are worried or in a hurry. → Fast pages, clear prices, one tap to WhatsApp or call.
- **Me and a data-entry helper** (admin): we collect prices by phone calls, lab price lists, and price-board photos, and enter hundreds of prices. → Data entry must be fast: a grid view, CSV import, and bulk "mark verified".

## Success criteria for the MVP

- Searching any common test (in Bangla, English, a synonym, or a common misspelling) finds the right test page.
- A test page lists labs sorted by price, each showing its last-verified date. The cheapest verified price is highlighted.
- Test pages, test × area pages, lab pages, and area pages are statically generated or ISR, score 90+ on Lighthouse mobile performance and SEO, and appear in `sitemap.xml`.
- No page is published with too little real data to be useful (see thin-content rule below).
- A visitor can send a booking request or tap WhatsApp/call in two taps. Each of these actions fires a dataLayer event with test, lab, and area parameters.
- An admin can enter or update 50 prices for a lab in under 10 minutes.
- Everything runs in a single Docker container with PostgreSQL, configured only via environment variables.

## Tech stack (decided — ask me before swapping any of these)

- Next.js (App Router) + TypeScript (strict), using static generation / ISR for public pages.
- PostgreSQL + Prisma. Use `pg_trgm` for fuzzy search over test names and synonyms.
- Tailwind CSS.
- Auth for admin only: pick one maintained library (e.g. Auth.js or Better Auth) and justify it in one line in Phase 0. Roles: `ADMIN`, `DATA_ENTRY`. The public site has no login.
- Analytics: Google Tag Manager, with the container ID from an env var. Push a clean `dataLayer` (event spec below). Don't hardcode GA4 tags — I configure GA4 inside GTM myself.
- Tests: Vitest for logic (search normalization, price ranking, thin-content rule); Playwright for search → test page → booking.
- Deploy: a Dockerfile. I deploy from GitHub to my own hosting platform (FlyNode), which provides the PostgreSQL database.
- Time: store UTC, display in Asia/Dhaka.

## Domain model (starting point — refine it in Phase 0)

- **Test** — canonical name (English), Bangla name, slug, category (blood, urine, imaging, cardiac, hormone, …), sample type, preparation note (e.g. fasting), and a `contentStatus` flag (see medical content rule).
- **TestAlias** — synonyms, abbreviations, Bangla spellings, and common misspellings, all used for search (e.g. CBC, Complete Blood Count, সিবিসি).
- **Area** — Dhaka neighbourhood: name (Bangla + English), slug. Start with about 20 areas.
- **Lab** — name, branch name, area, address, phone, WhatsApp number, opening hours, home-collection available (yes/no) and fee, map link, slug.
- **LabTestPrice** — lab + test, regular price (BDT), optional discounted price with an expiry date, report delivery time, home collection available for this test, `source` (`PHONE_CALL`, `PRICE_LIST`, `WEBSITE`, `LAB_SUBMITTED`, `VISIT`), optional `sourceNote` or photo URL, `verifiedAt`, `verifiedBy`.
- **PriceHistory** — append-only log of every price change, used later for "price went up" insights.
- **BookingRequest** — test, lab, patient name, phone, preferred date, home collection yes/no, status (`NEW`, `FORWARDED_TO_LAB`, `CONFIRMED`, `COMPLETED`, `CANCELLED`), notes, UTM / referrer.
- **User** — admin users.

## Data and trust rules

- **Freshness:** a price is fresh if verified within the last 90 days. Older prices still show, but are greyed out with "পুরনো তথ্য — ল্যাবে ফোন করে নিশ্চিত হোন" and are never highlighted as cheapest. Put the 90-day threshold in config.
- **Ranking:** sort by the effective price (an unexpired discount, otherwise the regular price). Sponsored or featured labs may get a labelled badge, but never change the sort order. Write a test for this.
- **Show the source:** every price row shows "যাচাই: <date>" and a short label for the source.
- **Disclaimer:** every price page shows a short line that prices can change and should be confirmed with the lab.
- **Thin-content rule:**
  - Generate a test × area page only if at least 2 labs in that area have a fresh price for that test.
  - Generate a test page only if at least 3 labs have a fresh price for it.
  - Any other page returns 404 and is left out of the sitemap.
  - This protects our search ranking, so treat it as a hard rule.

## Medical content rule (important)

Do not write medical descriptions, preparation instructions, or explanations of what a test is for from your own knowledge and publish them as fact. Wrong medical information can hurt people and destroys trust.

- You may create placeholder text, but any test description or preparation note you draft must be saved with `contentStatus = DRAFT_NEEDS_REVIEW`.
- Public pages show only content marked `REVIEWED`.
- Keep the test pages useful even without descriptions: price table, report time, home collection, sample type.

## Pages

1. **Home:** a large search box (Bangla/English, instant suggestions), popular tests, and a list of areas.
2. **Test page** `/test/[slug]`: all labs with fresh prices, sorted by price. Shows the price range (৳৩০০ – ৳৬৫০), the cheapest one highlighted, filters (area, home collection, report time), and a booking / WhatsApp / call button on each row.
3. **Test × area page** `/test/[slug]/[area]`: the same, filtered to that area. These pages are the main SEO target (e.g. "CBC test price Mirpur").
4. **Lab page** `/lab/[slug]`: lab details, all its test prices, and a "last updated" date.
5. **Area page** `/area/[slug]`: labs in the area and popular tests with their price ranges.
6. **Admin:**
   - Labs, tests, aliases, areas.
   - A per-lab price grid: spreadsheet-like inline editing with keyboard navigation.
   - CSV import and export with a validation preview before saving.
   - Bulk "mark verified today".
   - A stale-price dashboard showing which labs to call next.
   - A booking requests inbox with statuses.

On a 360px screen, show comparison results as cards, not wide tables.

## Booking flow (manual behind the scenes for now)

- Each lab row has a "বুক করুন" button that opens a short form: name, phone, preferred date, home collection yes/no. The form saves a BookingRequest and shows a confirmation. I forward requests to the lab by hand from the admin inbox.
- The WhatsApp button opens WhatsApp with a pre-filled Bangla message naming the test and the lab. Use the lab's own number until I switch it to a central number via config.
- The "কল করুন" button is a `tel:` link.
- Validate Bangladeshi mobile numbers (01XXXXXXXXX, with or without +880). Add basic spam protection on the form (honeypot + rate limit). No CAPTCHA for now.

## Tracking spec (dataLayer)

Push these events with snake_case parameters. Don't include personal data (name or phone) in any event.

| Event | Fires when | Parameters |
|---|---|---|
| `search` | a search is submitted or a suggestion is chosen | `search_term`, `results_count` |
| `view_test_prices` | a test or test × area page loads | `test_slug`, `area_slug` (if any), `lab_count`, `min_price` |
| `booking_form_open` | the booking form is opened | `test_slug`, `lab_slug`, `area_slug`, `price` |
| `generate_lead` | a booking request is saved successfully (after the server confirms) | `test_slug`, `lab_slug`, `area_slug`, `price`, `booking_id` |
| `whatsapp_click` | WhatsApp is tapped | `test_slug`, `lab_slug`, `area_slug` |
| `call_click` | call is tapped | `test_slug`, `lab_slug`, `area_slug` |

Also save UTM parameters and the referrer on each BookingRequest.

## SEO requirements

- Static generation / ISR with on-demand revalidation whenever a price is saved in the admin.
- For each page: a unique `<title>` and meta description in Bangla that includes the test name, the area, and the current price range. Add a canonical URL and Open Graph tags.
- An auto-generated `sitemap.xml` (respecting the thin-content rule) and `robots.txt`. The admin area must be `noindex` and blocked in robots.
- Structured data:
  - `MedicalClinic` / `LocalBusiness` on lab pages.
  - `BreadcrumbList` on all pages.
  - `ItemList` on test pages.
  - Only mark up data that is actually visible on the page. Don't add review or rating markup — we don't have reviews.
- Internal links: test ↔ lab ↔ area, plus "same test in nearby areas".
- Keep JavaScript small on public pages. Use server components by default and add client components only for search suggestions, filters, and the booking form.

## Design

- Clean, trustworthy, price-focused.
- White background, teal or blue primary color, green for cheapest, grey for stale data. High contrast (WCAG AA).
- Bangla font: Hind Siliguri or Noto Sans Bengali, loaded via `next/font`.
- Not an editorial look: no cream backgrounds, no serif display fonts, no terracotta.
- Prices are the most prominent element on every row.
- Minimum tap target: 48px. Test every page at 360px width.
- If a `ui-ux-pro-max` skill (or similar UI skill) is available in this environment, read it before building any UI.

## Language

- UI in Bangla, with English test names shown alongside the Bangla names (that's how people search).
- Keep all UI strings in one dictionary file so a full English version can be added later.
- Use Bangla digits for prices on public pages; the admin area uses English digits.

## Out of scope for the MVP — do not build

Online payment, a self-service portal for labs, user accounts for patients, reviews or ratings, doctor listings, a native app, an AI chatbot, and scraping of other websites. Don't add these even if they seem helpful; I'll ask for them later.

## How we work

- **Phases.** Stop after each phase. Report what was built, how to run and test it, what is not done, and any decisions you made. Commit at the end of each phase with a clear message.
  - **Phase 0 — Plan.** Read this file. Propose the final Prisma schema, folder structure, URL map, auth library choice (one-line reason), how search with Bangla synonyms will work, how ISR revalidation will be triggered, and your open questions for me. Only scaffolding, no app code. Wait for my OK.
  - **Phase 1 — Data and admin.** Database, admin auth, CRUD for labs / tests / aliases / areas, the per-lab price grid, CSV import with a validation preview, bulk verify, and a seed script.
    - Seed data must be clearly fake: lab names like "Demo Lab 1". Use 20 real Dhaka area names and about 40 common test names with aliases, but no real prices and no medical descriptions.
  - **Phase 2 — Public pages.** Home with search, test, test × area, lab, and area pages, with ranking, freshness, and thin-content rules, and tests for them.
  - **Phase 3 — Technical SEO.** Metadata, structured data, sitemap, robots, on-demand revalidation, and Lighthouse checks (report the actual scores).
  - **Phase 4 — Booking and tracking.** Booking form, WhatsApp and call buttons, admin booking inbox, the dataLayer events, and UTM capture.
  - **Phase 5 — Ops and deploy.** Stale-price dashboard, price history, Dockerfile, `.env.example`, a README with deploy steps, and a short guide for my data-entry helper.
- **Verify before saying done.** Run typecheck, lint, and tests. For UI phases, run the app and click through it at 360px width. Check dataLayer pushes in the browser console. Report the actual results; if something fails or you couldn't test it, say so plainly.
- **Ask me first** before adding any paid service, changing the stack, deleting data or editing migrations that have already been applied, pushing to a git remote, or fetching data from any external website.
- **Ambiguity.** If a requirement is unclear, choose the simplest reasonable reading, write it under Decisions in your phase report, and continue. Only stop to ask when a wrong guess would be expensive to undo.
- **Keep it simple.** No extra abstraction layers, no features beyond this file, prefer fewer files. Once you've chosen an approach, commit to it; change course only if new information contradicts it.
- Keep `PROGRESS.md` up to date with phase status, decisions, and known issues, so a fresh session can pick up where the last one stopped.
