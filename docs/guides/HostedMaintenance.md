# Hosted Version Maintenance Guide

For maintainers of the **hosted** version of TabletopTime (Vercel + Supabase).
Not relevant to self-hosted users.

## Layout

The project ships two Prisma targets from one codebase. They are fully separate
on disk so each can keep its own migration history (Prisma resolves a migrations
directory as a sibling of its schema file, and a history is locked to one
provider).

```
prisma/
  schema.prisma            # sqlite   - self-hosted Docker + local dev
  migrations/              # sqlite history (applied by start.sh via db push)
  hosted/
    schema.prisma          # postgres - Vercel + Supabase
    migrations/            # postgres history (applied by the Vercel build)
```

Both schema files must declare an identical data model; only the datasource block
differs. `tests/schema-parity.test.ts` enforces that and runs in CI.

## How changes reach production

Production deploys apply migrations themselves. `vercel.json` points the Build
Command at `scripts/vercel-build.sh`, which runs `prisma generate`, then
`prisma migrate deploy` (production only), then `next build`. A failed migration
fails the deploy.

Three jobs in `.github/workflows/db-drift.yml` back that up:

- **schema-parity** - the two schema files still describe the same models.
- **migrations-cover-schema** - replays `prisma/hosted/migrations/` into a
  throwaway Postgres service container and diffs the result against
  `prisma/hosted/schema.prisma`. This is the one that matters: it catches a
  schema edit that shipped without a migration, which is the failure mode that
  caused the outage. It needs no credentials.
- **prod-drift** *(optional)* - compares the live database against the schema,
  catching hand-edits made in the Supabase console. Skipped with a notice unless
  a `DIRECT_URL` repository secret is configured, so putting production
  credentials in GitHub stays a deliberate choice.
## Making a schema change

1. Edit **both** schema files (`prisma/schema.prisma` and
   `prisma/hosted/schema.prisma`).
2. Self-hosted history: `npx prisma migrate dev --name <change>` (writes to
   `prisma/migrations/`, applies to your local `dev.db`).
3. Hosted history:

   ```bash
   DIRECT_URL="<supabase direct url>" npm run db:diff:hosted   # preview the SQL
   DIRECT_URL="<supabase direct url>" npm run db:new:hosted <change_name>
   ```

   This writes `prisma/hosted/migrations/<timestamp>_<change_name>/migration.sql`.
4. Review the generated SQL, run `npm test`, commit both migrations with the
   schema edits.
5. Push. The production deploy applies it.

`db:new:hosted` diffs against the live database rather than replaying the
migration history, because Supabase does not provide a shadow database. That is
equivalent as long as production matches the history -- which the prod-drift job
verifies on every push to `main`.

## Environment

| variable | where | purpose |
|---|---|---|
| `DATABASE_URL` | Vercel | pooled connection (port 6543), app queries |
| `DIRECT_URL` | Vercel (GitHub secret optional) | direct connection (port 5432), DDL |

Prisma Migrate cannot run through the transaction pooler, which is why
`prisma/hosted/schema.prisma` declares `directUrl`.

## How the pre-existing database was adopted

Production predates this setup: it was created with `prisma db push` and had no
`_prisma_migrations` ledger, so a plain `migrate deploy` would have tried to
`CREATE TABLE` on tables that already existed and failed.

Rather than require a manual `migrate resolve --applied` step, `0_init` is written
to be **idempotent**: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
and `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` for foreign keys. It therefore
applies cleanly to both an empty database (creating everything) and the existing
production database (creating nothing), and applying it is what writes the ledger.

Every migration after `0_init` is ordinary generated SQL and does not need to be
idempotent.

## Escape hatch

`npm run db:push:hosted` still exists for emergencies. It syncs the whole schema
with no history and leaves the ledger stale, so if you use it, follow up with
`npm run db:diff:hosted` to confirm the result and add a matching migration.

## Why this is automated now

It used to be deliberately manual, to keep the live database decoupled from CI
during rapid open-source development. That tradeoff had one failure mode with no
detection: nothing noticed when a human skipped the step. On 2026-07-23 a commit
added `LoginToken.telegramUsername` to both schemas and shipped code that wrote
it; the column was never applied to production. Every magic-link login -- Telegram
and Discord -- threw for a month behind a 500 that only Telegram's retry queue
ever saw. Automating the apply and gating on drift removes that failure mode
entirely.
