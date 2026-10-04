# Deploying to Vercel

This is how the hosted version runs: Vercel for the app, Supabase Postgres for the database. Self-hosters should use the Docker image instead.

## 1. Prerequisites
- A [Vercel Account](https://vercel.com).
- A **PostgreSQL Database**. The setup below assumes Supabase, which also schedules the reminders (see step 5).
  - *Note: SQLite (file:./dev.db) does NOT work on Vercel's Serverless environment.*

## 2. Environment Variables
Configure the following in your Vercel Project Settings. [EnvVariables.md](../reference/EnvVariables.md) has the full reference.

### Core
- `DATABASE_URL`: Connection string to your Postgres DB. On Supabase this is the **pooled** string (port 6543, with `?pgbouncer=true&connection_limit=1`).
- `DIRECT_URL`: The **direct** connection string (port 5432). Required: Prisma Migrate cannot run DDL through a transaction pooler, and the build applies migrations.
- `NEXT_PUBLIC_BASE_URL`: The production URL (e.g., `https://your-project.vercel.app`). Required whenever a bot token is set.
- `SESSION_SECRET`: 32 or more random bytes. Required on production deployments; the server will not start without it.
- `CRON_SECRET`: 32 or more random bytes. Required on production deployments and whenever `NEXT_PUBLIC_IS_HOSTED=true`. Every cron route rejects requests without it.

### Integrations
- `DISCORD_APP_ID`: From Discord Developer Portal.
- `DISCORD_CLIENT_SECRET`: From Discord Developer Portal.
- `DISCORD_BOT_TOKEN`: From Discord Developer Portal.
- `TELEGRAM_BOT_TOKEN`: (Optional) If using Telegram. Webhook mode is the default and the only mode Vercel supports.
- `KOFI_VERIFICATION_TOKEN`: (Optional) Verification token from [Ko-fi Webhooks](https://ko-fi.com/manage/webhooks). Required for the donation feature. If missing, the webhook endpoint will reject all requests.

### Hosted Mode (Optional)
Only set these if running the public hosted version (tabletoptime.us):
- `NEXT_PUBLIC_IS_HOSTED`: Set to `true` to enable hosted-specific behavior (public sitemap, SEO/AEO indexing).

## 3. Database Migrations

Migrations are applied automatically. `vercel.json` sets the Build Command to
`scripts/vercel-build.sh`, which runs:

1. `prisma generate --schema=prisma/hosted/schema.prisma`
2. `prisma migrate deploy --schema=prisma/hosted/schema.prisma` (production deployments only)
3. `node scripts/run-data-migrations.mjs`, which applies pending data migrations once each (production deployments only)
4. `next build`

A failed migration fails the deploy, so the app can never ship expecting a column
the database does not have. Preview deployments skip steps 2 and 3: Preview has no
database configured (no `DATABASE_URL` on that target), so there is nothing to migrate,
and a feature branch can never apply DDL to the production schema.

**Leave the dashboard Build Command empty.** `vercel.json` takes precedence over
project settings, so a value there is ignored, but leaving one set invites someone
to edit it and wonder why nothing changes.

The hosted schema lives at `prisma/hosted/schema.prisma` with its own Postgres
migration history in `prisma/hosted/migrations/`. The SQLite schema at
`prisma/schema.prisma` belongs to the self-hosted Docker build, which applies it with
`prisma db push` and keeps no migration history. It is not used here. See [HostedMaintenance.md](./HostedMaintenance.md) for the day-to-day
workflow.

## 4. Discord Configuration
1. Go to Discord Developer Portal -> OAuth2.
2. Add your **Production Redirect URI**:
   `https://your-project.vercel.app/api/auth/discord/callback`

## 5. Scheduled Jobs

- **Cleanup** runs once a day from Vercel Cron (`vercel.json`, 00:00 UTC).
- **Reminders and the outbound webhook queue** need to run every few minutes, which Vercel's free cron cannot do. They run from Supabase `pg_cron`; the one-time setup (Vault secrets, then `scripts/sql/pg-cron-reminders.sql`) is in [HostedMaintenance.md](./HostedMaintenance.md#scheduling-reminders-with-pg_cron).
- **Reminder backstop.** `.github/workflows/cron.yml` calls the reminders route every two hours. It needs the repository secrets `DEPLOYMENT_URL` and `CRON_SECRET`.
- **Fortnightly rebuild.** `.github/workflows/fortnightly-deploy.yml` calls a Vercel deploy hook every other Thursday so blog posts scheduled for a future date get published. Create a deploy hook for `main` in the Vercel project settings and store its URL as the repository secret `VERCEL_DEPLOY_HOOK_URL`. The workflow pushes no commits.

## 6. Shipping Changes

`main` is protected: every change goes through a pull request, and the CI checks (typecheck, lint, tests, production build, dependency direction, the self-host upgrade check and the hosted migration check) must pass before it can merge. Merging to `main` triggers the production deployment, which applies any new migrations.
