# Deploying to Vercel

## 1. Prerequisites
- A [Vercel Account](https://vercel.com).
- A **PostgreSQL Database** (Vercel Storage, Neon, Supabase, etc.).
  - *Note: SQLite (file:./dev.db) does NOT work on Vercel's Serverless environment.*

## 2. Environment Variables
Configure the following in your Vercel Project Settings:

### Core
- `DATABASE_URL`: Connection string to your Postgres DB (e.g., `postgres://user:pass@host/db`). On Supabase this is the **pooled** string (port 6543).
- `DIRECT_URL`: The **direct** connection string (port 5432). Required: Prisma Migrate cannot run DDL through a transaction pooler, and the build applies migrations.
- `NEXT_PUBLIC_BASE_URL`: The production URL (e.g., `https://your-project.vercel.app`).
- `TZ`: `America/New_York` (or your preferred timezone).

### Integrations
- `DISCORD_APP_ID`: From Discord Developer Portal.
- `DISCORD_CLIENT_SECRET`: From Discord Developer Portal.
- `DISCORD_BOT_TOKEN`: From Discord Developer Portal.
- `TELEGRAM_BOT_TOKEN`: (Optional) If using Telegram.
- `KOFI_VERIFICATION_TOKEN`: (Optional) Verification token from [Ko-fi Webhooks](https://ko-fi.com/manage/webhooks). Required for the donation social proof feature. If missing, the webhook endpoint will reject all requests.

### Hosted Mode (Optional)
Only set these if running the public hosted version (tabletoptime.us):
- `NEXT_PUBLIC_IS_HOSTED`: Set to `true` to enable hosted-specific behavior (public sitemap, SEO/AEO indexing).

## 3. Database Migrations

Migrations are applied automatically. `vercel.json` sets the Build Command to
`scripts/vercel-build.sh`, which runs:

1. `prisma generate --schema=prisma/hosted/schema.prisma`
2. `prisma migrate deploy --schema=prisma/hosted/schema.prisma` (production deployments only)
3. `next build`

A failed migration fails the deploy, so the app can never ship expecting a column
the database does not have. Preview deployments skip step 2 -- they share the
production `DATABASE_URL`, so letting a feature branch apply DDL would mutate the
live schema.

**Do not set a Build Command in the Vercel dashboard.** `vercel.json` is the source
of truth; a dashboard value would override it and silently drop the migration step.

The hosted schema lives at `prisma/hosted/schema.prisma` with its own Postgres
migration history in `prisma/hosted/migrations/`. The SQLite schema and
`prisma/migrations/` at the top level belong to the self-hosted Docker build and are
not used here. See [HostedMaintenance.md](./HostedMaintenance.md) for the day-to-day
workflow.

## 4. Discord Configuration
1. Go to Discord Developer Portal -> OAuth2.
2. Add your **Production Redirect URI**:
   `https://your-project.vercel.app/api/auth/discord/callback`
