# TestDam

Start every session by reading `PROGRESS.md` (status, decisions, open questions), then `docs/BRIEF.md` (requirements — source of truth) and `docs/PLAN.md` (agreed design).

Hard rules from the brief, easy to forget:
- Phased work: stop for owner review at the end of each phase; commit per phase; update `PROGRESS.md`.
- Never publish medical text you wrote: save it as `contentStatus = DRAFT_NEEDS_REVIEW`; public pages render only `REVIEWED`.
- Thin-content and freshness rules live only in `src/lib/pricing.ts`; featured labs never change sort order.
- Ask before: paid services, stack changes, deleting data, editing applied migrations, pushing to a remote, fetching external websites.
- Windows dev machine; no Docker/Postgres installed locally (see PROGRESS.md).
