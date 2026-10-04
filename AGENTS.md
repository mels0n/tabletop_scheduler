# Working in tabletop_scheduler

This file is for anyone (or any tool) making changes to this repository: how to
build and check the code, and where things live. [CONTRIBUTING.md](CONTRIBUTING.md)
covers local setup in more detail.

## Build, test, lint

Node 22 (see `.nvmrc`). Every command runs from the repository root.

- Install: `npm ci` then `npx prisma generate`
- Local database (SQLite): `cp .env.example .env`, then `npx prisma db push` (never `prisma migrate dev`; the SQLite schema has no migration history)
- Dev server: `npm run dev`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint` (zero warnings allowed)
- Tests: `npm test` (unit and integration; `npm run test:integration` runs only the SQLite integration tests)
- Layer rules: `npm run depcruise`
- Self-host upgrade check: `npm run db:upgrade-check` (needed when `prisma/schema.prisma` changes)
- Production build: `npm run build` (regenerates the blog module first)

CI runs all of these on every pull request, plus a check that
`prisma/hosted/migrations` produces exactly `prisma/hosted/schema.prisma`.
`main` is protected and only accepts pull requests that pass them.
A change is ready when every one of them passes locally.

## Layout

Next.js App Router. Source is arranged as layers, top to bottom:

- `app/` - routes: pages, layouts and API route handlers
- `components/` - page-level UI blocks shared by several routes
- `features/` - one slice per business domain (`auth`, `event-management`,
  `notifications`, `telegram`, `integrations/discord`, `integrations/webhooks`)
- `entities/` - business nouns and their rules (`donation`,
  `notification-preference`, `participant`)
- `shared/` - config, errors, logger, Prisma client and generic helpers

Imports only point downward through this list. `app/` and `components/` reach a
feature through its `index.ts`. The one exception is a client component calling
a server action: it imports the `"use server"` module directly, because a slice
index also re-exports server-only code that must not enter a browser bundle.
`.dependency-cruiser.cjs` enforces the direction rule and fails CI on an upward
import, a cycle or an unresolvable import; a feature reaching into another
feature's internals is reported as a warning.

Other folders: `prisma/` (two schemas plus per-release snapshots in `prisma/compat/`, see below), `content/blog/` (blog posts),
`docs/` (guides, reference, ADRs), `scripts/` (build and maintenance scripts),
`tests/` (cross-cutting and integration tests). Unit tests sit next to the file
they test as `*.test.ts` or `*.test.tsx`.

## Conventions

- Two database targets share one data model. A schema change edits both
  `prisma/schema.prisma` (SQLite, self-host) and `prisma/hosted/schema.prisma`
  (Postgres, hosted) and adds a hosted migration with `npm run db:new:hosted <name>`.
  `npm test` fails if the two schemas diverge.
- Self-host schema changes are additive only and must upgrade every snapshot in
  `prisma/compat/` with a plain `db push`; backfills go in
  `scripts/data-migrations/index.mjs`. A new hosted table needs row level
  security statements in its migration. See CONTRIBUTING.md.
- A deploy must never invalidate an admin link, a stored participant id or a
  live token: accept the old form and upgrade it on first use.
- Validate every request body, query and route param with a zod schema before use.
- Pages and client components receive DTOs, never Prisma rows.
- Read configuration through `shared/config`, never `process.env` directly. A
  new variable is added to `docs/reference/EnvVariables.md` and `.env.example`.
- Throw the typed errors from `shared/errors`; route handlers map them to a
  response with `toResponse`.
- Log with `shared/lib/logger`, not `console.*`.
- Escape user text (titles, names, locations) with `shared/lib/escape` before it
  goes into a Telegram or Discord message.

## Decisions

Non-obvious choices are recorded in `docs/adr/`. Read the relevant ADR before
proposing an approach that a past decision may already have rejected.
