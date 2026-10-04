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
`prisma migrate deploy` and pending data migrations (production only), then
`next build`. A failed migration fails the deploy. Preview builds skip the migration step: Preview has no
database configured, so there is nothing for it to migrate.

Two checks guard the history before it gets that far:

- `npm test` runs `tests/schema-parity.test.ts`, which fails if the two schema
  files stop describing the same models.
- CI runs `prisma migrate diff` from `prisma/hosted/migrations` to
  `prisma/hosted/schema.prisma` against a throwaway Postgres and fails if they
  differ, so a schema edit without a matching migration cannot merge.

## Making a schema change

1. Edit **both** schema files (`prisma/schema.prisma` and
   `prisma/hosted/schema.prisma`).
2. Self-hosted and local dev: `npx prisma db push` applies the SQLite schema to
   your local `dev.db`. There is no SQLite migration history to update.
3. Hosted history:

   ```bash
   DIRECT_URL="<supabase direct url>" npm run db:status:hosted  # every migration must be applied first
   DIRECT_URL="<supabase direct url>" npm run db:diff:hosted   # preview the SQL
   DIRECT_URL="<supabase direct url>" npm run db:new:hosted <change_name>
   ```

   This writes `prisma/hosted/migrations/<timestamp>_<change_name>/migration.sql`.
   Prefer `IF NOT EXISTS` forms where Postgres allows them, so a migration is safe
   to re-run. If the migration creates a table, add its row level security
   statements by hand (see [Row level security](#row-level-security)).
4. Review the generated SQL, run `npm test`, commit both schema files and the new
   migration together. If `prisma/schema.prisma` changed, also run
   `npm run db:upgrade-check`.
5. Open a pull request. `main` is protected, so the change merges only after CI
   passes, and the production deploy that follows the merge applies the migration.

`db:new:hosted` diffs against the live database rather than replaying the
migration history, because Supabase does not provide a shadow database. That is
equivalent as long as production matches the history, which the CI migration-diff
check keeps true.

## Database change rules

Self-hosted instances upgrade by pulling a newer image and restarting, from whatever release they were on. `start.sh` then applies `prisma/schema.prisma` with a plain `prisma db push` and runs pending data migrations, with no manual step. Every database change must therefore work automatically, from any earlier release to the current one.

- **Additive only (expand, then contract).** A release may add a nullable column, a column with a default, a new table or a new index. It never drops, renames or retypes a column or table. To rename or reshape, add the new column in one release, write to both and backfill, and drop the old one in a later release, only once no released code reads it.
- **Snapshot every release.** A release that changes `prisma/schema.prisma` adds a copy of it to `prisma/compat/` (see [prisma/compat/README.md](../../prisma/compat/README.md)).
- **Backfills are data migrations.** Rewriting existing rows (filling a new column from an old one, for example) goes in `scripts/data-migrations/index.mjs`, never in a manual step. Each entry runs once, in a transaction, on self-host start and on the hosted production build, and is recorded in the `AppMigration` table.
- **`npm run db:upgrade-check` is the gate.** It pushes the current schema onto a seeded database built from every snapshot, without `--accept-data-loss`, and checks the rows survive. CI runs it as the `selfhost-upgrade` job, and the Docker image is only published from a commit that passed it.
- **`PRISMA_ACCEPT_DATA_LOSS` is for recovery only.** It exists so an operator can repair a database that is already in a broken state. A release must never require it; if the upgrade check needs it to pass, the change is wrong.

On the hosted side, `scripts/vercel-build.sh` runs `node scripts/run-data-migrations.mjs`
right after `prisma migrate deploy`, on production builds only. A failed data
migration rolls back and fails the deploy, the same as a failed schema migration.

There is no manual database step in any of this, and no separate push command for
the hosted schema: the production build is the only thing that changes the hosted
database's shape.

## Row level security

Every table in the hosted database has row level security enabled with a deny-all
policy (`prisma/hosted/migrations/20261003000200_enable_rls`). The app connects as
the table owner and is unaffected; the Supabase Data API roles can read and write
nothing, so the project's public anon key exposes no data.

Every new table needs the same two statements, `ENABLE ROW LEVEL SECURITY` and the
deny-all policy, in the migration that creates it. Prisma does not diff RLS, so
neither `db:new:hosted` nor the CI migration check will add or catch a missing
policy.

## Environment

| variable | where | purpose |
|---|---|---|
| `DATABASE_URL` | Vercel | pooled connection (port 6543), app queries |
| `DIRECT_URL` | Vercel | direct connection (port 5432), DDL |
| `CRON_SECRET` | Vercel | bearer token for `/api/cron/*` and `/api/telegram/setup`; also the same value you store in the Vault (below) |
| `SESSION_SECRET` | Vercel | signs identity and participant cookies and Telegram connect codes; root of the webhook signing keys |
| `NEXT_PUBLIC_IS_HOSTED` | Vercel | `true` on the hosted site |
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
its target time (the chosen time on each chosen weekday, in the event's timezone,
daylight saving included), and each target sends at most once. It only goes out
while the event has a future time option and has not reached its minimum player
count. A session reminder goes out once per finalized session, on any run between
the chosen lead time (2 hours, 1 day or 2 days) and the session start.
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
before it is sent, so overlapping runs never post twice. Event cleanup does not use
`pg_cron`: Vercel Cron calls `/api/cron/cleanup` once a day (`vercel.json`).

## Compatibility rule

A deploy must never invalidate an admin link, a stored participant id or a live
token. People without Telegram or Discord have no recovery path, so a change
they cannot see must not lock them out. Any change to how credentials are stored
or checked keeps accepting the old form and upgrades it on first successful use
(for example, a legacy plaintext admin token is accepted and rewritten as its
hash), and never retires the old form on a timer.

Participant rows follow the same rule with a per-row marker instead of a date.
`Participant.ownerCookieIssuedAt` is set whenever the signed participant cookie is
issued for a row, and every new row is marked when it is created. Rows created
before participant cookies existed carry no marker and stay editable by stored id;
the first browser to touch such a row receives the cookie and the row is marked.
The mark is a conditional update, so when two browsers race for the same row only
one wins and the other gets the normal ownership check. There is nothing to
configure and nothing expires.

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
