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
differs. `tests/schema-parity.test.ts` enforces that.

## How changes reach production

Production deploys apply migrations themselves. `vercel.json` points the Build
Command at `scripts/vercel-build.sh`, which runs `prisma generate`, then
`prisma migrate deploy` (production only), then `next build`. A failed migration
fails the deploy.

`npm test` covers schema parity: `tests/schema-parity.test.ts` fails if the two
schema files stop describing the same models.
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
| `DIRECT_URL` | Vercel | direct connection (port 5432), DDL |

Prisma Migrate cannot run through the transaction pooler, which is why
`prisma/hosted/schema.prisma` declares `directUrl`.

## Adopting the pre-existing database (one time)

Production predates this setup: created with `prisma db push`, no
`_prisma_migrations` ledger. `migrate deploy` refuses to touch a non-empty database
that has no ledger and fails with **P3005** before executing any SQL, so the
baseline has to be recorded rather than run:

```bash
DIRECT_URL="<supabase direct url>" npm run db:baseline:hosted
```

That is `migrate resolve --applied 0_init`: it writes the ledger and marks the
baseline applied without touching a table. Every later migration then applies
normally on deploy. Run once, ever.
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
