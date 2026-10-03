# Working in tabletop_scheduler

This file is for anyone (or any tool) making changes to this repository: how to
build and check the code, and where things live. [CONTRIBUTING.md](CONTRIBUTING.md)
covers local setup in more detail.

## Build, test, lint

Node 22 (see `.nvmrc`). Every command runs from the repository root.

- Install: `npm ci` then `npx prisma generate`
- Local database (SQLite): `npx prisma db push`
- Dev server: `npm run dev`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint` (zero warnings allowed)
- Unit tests: `npm test`
- Integration tests (SQLite): `npm run test:integration`
- Layer rules: `npm run depcruise`
- Production build: `npx next build`

CI runs all of these on every pull request, plus a check that
`prisma/hosted/migrations` produces exactly `prisma/hosted/schema.prisma`.
A change is ready when every one of them passes locally.

## Layout

Next.js App Router. Source is arranged as layers, top to bottom:

- `app/` - routes: pages, layouts and API route handlers
- `components/` - page-level UI blocks shared by several routes
- `features/` - one slice per business domain (`auth`, `event-management`,
  `notifications`, `telegram`, `integrations/discord`, `integrations/webhooks`)
- `entities/` - business nouns and their rules (`donation`)
- `shared/` - config, errors, logger, Prisma client and generic helpers

Imports only point downward through this list. `app/` and `components/` reach a
feature through its `index.ts`. The one exception is a client component calling
a server action: it imports the `"use server"` module directly, because a slice
index also re-exports server-only code that must not enter a browser bundle.
`.dependency-cruiser.cjs` enforces the direction rule and fails CI on an upward
import, a cycle or an unresolvable import; a feature reaching into another
feature's internals is reported as a warning.

Other folders: `prisma/` (two schemas, see below), `content/` (blog posts),
`docs/` (guides, reference, ADRs), `scripts/` (build and maintenance scripts),
`tests/` (cross-cutting and integration tests). Unit tests sit next to the file
they test as `*.test.ts` or `*.test.tsx`.

## Conventions

- Two database targets share one data model. A schema change edits both
  `prisma/schema.prisma` (SQLite, self-host) and `prisma/hosted/schema.prisma`
  (Postgres, hosted) and adds a hosted migration with `npm run db:new:hosted <name>`.
  `npm test` fails if the two schemas diverge.
- Validate every request body, query and route param with a zod schema before use.
- Pages and client components receive DTOs, never Prisma rows.
- Read configuration through `shared/config`, never `process.env` directly.
- Throw the typed errors from `shared/errors`; route handlers map them to a
  response with `toResponse`.
- Log with `shared/lib/logger`, not `console.*`.
- Escape user text (titles, names, locations) with `shared/lib/escape` before it
  goes into a Telegram or Discord message.

## Decisions

Non-obvious choices are recorded in `docs/adr/`. Read the relevant ADR before
proposing an approach that a past decision may already have rejected.
