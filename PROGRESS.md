# PROGRESS — TestDam

Read this first in a new session, then [docs/BRIEF.md](docs/BRIEF.md) (requirements) and [docs/PLAN.md](docs/PLAN.md) (agreed design).

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0 — Plan | **Done, waiting for owner OK** | Plan, Prisma schema (validated on Prisma 7.10.1), folder layout, open questions |
| 1 — Data and admin | Not started | Blocked on open question 1 (local DB) |
| 2 — Public pages | Not started | |
| 3 — Technical SEO | Not started | |
| 4 — Booking and tracking | Not started | |
| 5 — Ops and deploy | Not started | |

## Decisions

See [docs/PLAN.md §9](docs/PLAN.md). Key ones:
- Auth: Better Auth (email + password, sign-up disabled, roles ADMIN / DATA_ENTRY).
- Prisma pinned to 7.10.1 — npm `latest` points to an 8.0 RC.
- Search runs `pg_trgm` on a romanised ASCII `searchKey`, because trigram word-splitting breaks on Bangla vowel signs and depends on the DB locale.
- Docker build has no DB → `generateStaticParams` returns `[]`; pages render on first hit and are cached (ISR), with a post-deploy warm-up script.
- Pages also revalidate daily, because prices go stale (90 days) without any admin edit.

## Open questions (waiting on owner)

1. Local dev database: local Postgres, Docker Desktop, or a FlyNode dev DB?
2. Confirm: app-only container, Postgres from FlyNode.
3. Lab/area page thresholds (default: lab ≥ 5 fresh prices; area ≥ 2 labs with fresh prices and ≥ 1 eligible test × area page).
4. Production domain for `SITE_URL`.
5. GitHub repo URL (no remote/push until told).

## Known issues

- None yet. Local machine has no Docker or PostgreSQL (Node 22.17.1, npm 10.9.2, git 2.52 available).
