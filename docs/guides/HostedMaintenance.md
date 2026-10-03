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
  schema.prisma            # sqlite   - self-hosted Docker + local dev (applied with db push, no history)
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
fails the deploy. Preview builds skip the migration step, so a preview of a branch
with a schema change will error against the shared database until it is merged.

Two checks guard the history before it gets that far:

- `npm test` runs `tests/schema-parity.test.ts`, which fails if the two schema
  files stop describing the same models.
- CI runs `prisma migrate diff` from `prisma/hosted/migrations` to
  `prisma/hosted/schema.prisma` against a scratch Postgres and fails if they
  differ, so a schema edit without a matching migration cannot merge.

## Making a schema change

1. Edit **both** schema files (`prisma/schema.prisma` and
   `prisma/hosted/schema.prisma`).
2. Self-hosted and local dev: `npx prisma db push` applies the SQLite schema to
   your local `dev.db`. There is no SQLite migration history to update.
3. Hosted history:

   ```bash
   DIRECT_URL="<supabase direct url>" npm run db:diff:hosted   # preview the SQL
   DIRECT_URL="<supabase direct url>" npm run db:new:hosted <change_name>
   ```

   This writes `prisma/hosted/migrations/<timestamp>_<change_name>/migration.sql`.
   Prefer `IF NOT EXISTS` forms where Postgres allows them, so a migration is safe
   to re-run.
4. Review the generated SQL, run `npm test`, commit both schema files and the new
   migration together.
5. Push. The production deploy applies it.

`db:new:hosted` diffs against the live database rather than replaying the
migration history, because Supabase does not provide a shadow database. That is
equivalent as long as production matches the history, which the CI migration-diff
check keeps true.

## Environment

| variable | where | purpose |
|---|---|---|
| `DATABASE_URL` | Vercel | pooled connection (port 6543), app queries |
| `DIRECT_URL` | Vercel | direct connection (port 5432), DDL |
| `CRON_SECRET` | Vercel | bearer token for `/api/cron/*`; also the same value you store in the Vault (below) |
| `SESSION_SECRET` | Vercel | signs identity cookies |
| `NEXT_PUBLIC_BASE_URL` | Vercel | public origin, used for every bot link |

The two database URLs differ in host port and query string:

```text
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

`pgbouncer=true` tells Prisma the connection is transaction-pooled (it must not use
prepared statements), and `connection_limit=1` keeps each serverless instance from
holding more than one pooled connection. Prisma Migrate cannot run through the
transaction pooler, which is why `prisma/hosted/schema.prisma` declares
`directUrl`.

## Scheduling reminders with pg_cron

Vercel's free plan runs a cron at most once a day, which is far too coarse for
reminders. Reminders and the outbound webhook queue are driven from inside
Supabase instead, using `pg_cron` to schedule HTTP calls through `pg_net`. This is
free-tier compatible and has no per-run cost.

Do this once per environment, in the Supabase SQL editor. First store the two
secrets the job needs in Supabase Vault (use the real `CRON_SECRET` value from
Vercel):

```sql
select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');
select vault.create_secret('https://tabletoptime.us', 'app_base_url');
```

Then run the contents of `scripts/sql/pg-cron-reminders.sql` in the same editor.
That script enables `pg_cron` and `pg_net`, reads both secrets from
`vault.decrypted_secrets`, and schedules two jobs:

| Job | Schedule | Calls |
|-----|----------|-------|
| `tabletop-reminders` | every 10 minutes | `<app_base_url>/api/cron/reminders` |
| `tabletop-webhooks` | every 5 minutes | `<app_base_url>/api/cron/webhooks` |

Each call is a `GET` (both routes accept only `GET`) with
`Authorization: Bearer <cron_secret>`. The secrets are looked up on every run, so
nothing needs rescheduling after a Vault update.

The script is safe to run again: `cron.schedule` with an existing job name replaces
that job in place rather than adding a second one. To remove the jobs:

```sql
select cron.unschedule('tabletop-reminders');
select cron.unschedule('tabletop-webhooks');
```

Late runs still deliver. A voting reminder goes out on any run up to 18 hours after
its target time (at most once per 18 hours), and a session reminder goes out on any
run between the chosen lead time (2 hours, 1 day or 2 days) and the session start.
The reminders endpoint returns 500 when a whole run failed (for example, the database
was unreachable), which shows up as `status_code = 500` in `net._http_response`.

To check that it is working:

```sql
select jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
select id, status_code, created from net._http_response order by created desc limit 10;
```

If you rotate `CRON_SECRET`, update the Vault entry too (`vault.update_secret`),
or the jobs will start receiving 401 responses. The GitHub Actions reminder
workflow (`.github/workflows/cron.yml`, every two hours at minute 7) remains as a
backstop; it is safe to leave running because a reminder is claimed in the database
before it is sent, so overlapping runs never post twice.

## Compatibility rule

A deploy must never invalidate an admin link, a stored participant id or a live
token. People without Telegram or Discord have no recovery path, so a change
they cannot see must not lock them out. Any change to how credentials are stored
or checked keeps accepting the old form and upgrades it on first successful use
(for example, a legacy plaintext admin token is accepted and rewritten as its
hash), and never retires the old form on a timer.

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

## Recovering from a failed migration

A failed `migrate deploy` fails the build and leaves the previous deployment
serving, so users are not affected. Fix forward: correct the migration SQL, or add
a new migration that repairs the state, and push again. If a migration partly
applied and the ledger records it as failed, resolve it explicitly with
`prisma migrate resolve --rolled-back <name>` (or `--applied <name>` if you
finished it by hand) against the direct URL, then redeploy. Take a Supabase backup
from the dashboard before any manual repair.

## Why this is automated

Applying the schema used to be a manual step. On 2026-07-23 a commit added
`LoginToken.telegramUsername` to both schemas and shipped code that wrote it; the
column was never applied to production, and every magic-link login threw for a
month behind a 500 that only Telegram's retry queue ever saw. Applying migrations
as part of the production build, and failing the build when the history and schema
disagree, removes that failure mode.
