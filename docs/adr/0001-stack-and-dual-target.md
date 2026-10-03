# ADR 0001: Stack and dual database target

- Status: Accepted
- Date: 2026-10-02

## Context

TabletopTime has two audiences that want opposite things from the same code.

The hosted version at tabletoptime.us has to be cheap to run (it is a free community project), scale to zero when nobody is voting, and stay online without me tending it. The self-hosted version is for people who run a home server and want one container, one volume, and no database to administer.

A scheduling poll is a small, bursty, request-response workload: a page of votes, a form post, a push to a chat bot. There is no long-lived connection, no heavy computation, and the data is short-lived by design (events are deleted soon after they happen).

## Decision

**Framework.** Next.js with the App Router and TypeScript, in a single codebase that serves pages and the HTTP API. One deployable unit keeps the self-host story to a single container, and server components let the event page render without shipping data access code to the browser. API routes are thin: they authenticate, validate with zod, call a feature module, and map errors to a response in one place.

**ORM.** Prisma, for typed queries and a schema file that doubles as documentation of the data model.

**Two database targets from one codebase.**

- Self-hosted and local development use **SQLite**, schema in `prisma/schema.prisma`. The container applies it on every start with `prisma db push`. There is no SQLite migration history.
- The hosted version uses **Postgres on Supabase**, schema in `prisma/hosted/schema.prisma`, with a real migration history in `prisma/hosted/migrations/`. The Vercel build runs `prisma migrate deploy` for production builds only.
- The two schema files must declare the same models. A test (`tests/schema-parity.test.ts`) fails if they diverge, and CI checks that the hosted migration history reproduces the hosted schema.

**Why `db push` for self-host.** A self-hoster upgrades by pulling a new image. They should not have to know that a migration tool exists, and I cannot support a migration history across every version someone might skip. `db push` makes the database match the schema in the image. It refuses changes that would delete data unless the operator opts in with `PRISMA_ACCEPT_DATA_LOSS=1`, so the failure mode is "the container stops and says why", not silent loss.

**Why migrations for hosted.** The hosted database holds real users' data and I need an audit trail, a reviewable SQL diff for every change, and a failed deploy when a migration fails. A migration applied by the production build means code and schema cannot drift apart: a deploy that needs a column does not go live without it.

**Scheduled work.** Reminders and the outbound webhook queue are driven by Supabase `pg_cron` calling the app's cron routes over HTTP on the hosted side, and by a small loop inside the container on the self-host side. Both call the same authenticated routes.

## Alternatives considered

- **Postgres for everyone.** One schema and one migration history would remove the parity test and the duplication. It lost because it asks every self-hoster to run and back up a database server, which is the opposite of the one-container promise. A single SQLite file on a volume is something a hobbyist already knows how to copy.
- **SQLite for everyone, including hosted.** Simplest of all, but a serverless platform has no durable local disk, and a hosted SQLite service would add a vendor and a failure mode for no gain over managed Postgres.
- **Migrations for SQLite too.** Rejected for the reasons above: it pushes migration-state management onto people least equipped for it, and a half-applied history on a home server is harder to recover than a re-push.
- **Pages Router.** Mature, but the App Router's server components and route handlers fit this app better, and new work on the framework lands there.
- **A separate backend service (Express, Fastify, Nest).** More moving parts to deploy for an app of this size, and it would break the single-container, single-deploy property that both audiences rely on.
- **A different ORM or query builder (Drizzle, Kysely).** Viable. Prisma was already in place and its dual-provider support is what the two-schema approach rests on. The cost of switching outweighed the benefit.
- **Vercel Cron for reminders.** The free plan runs at most one job per day, far too coarse for "remind everyone two hours before the session". `pg_cron` is free and runs every few minutes.

## Consequences

- Every schema change touches two files and one hosted migration. This is a real cost, kept small by the parity test and the CI diff check.
- Self-hosted databases have no history to roll back to. Operators should back up the SQLite file before upgrading across a release that changes the schema.
- Preview deployments share the production database but never apply migrations, so a preview of a branch with a schema change will fail until the change is merged. This is deliberate: it keeps feature branches from altering the live schema.
- SQLite and Postgres differ (case sensitivity, `JSON` handling, concurrency). Code that depends on a database-specific behavior must be tested against both or avoided.
