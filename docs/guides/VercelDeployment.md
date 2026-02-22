# Deploying to Vercel

## 1. Prerequisites
- A [Vercel Account](https://vercel.com).
- A **PostgreSQL Database** (Vercel Storage, Neon, Supabase, etc.).
  - *Note: SQLite (file:./dev.db) does NOT work on Vercel's Serverless environment.*

## 2. Environment Variables
Configure the following in your Vercel Project Settings:

### Core
- `DATABASE_URL`: Connection string to your Postgres DB (e.g., `postgres://user:pass@host/db`).
- `NEXT_PUBLIC_BASE_URL`: The production URL (e.g., `https://your-project.vercel.app`).
- `TZ`: `America/New_York` (or your preferred timezone).

### Integrations
- `DISCORD_APP_ID`: From Discord Developer Portal.
- `DISCORD_CLIENT_SECRET`: From Discord Developer Portal.
- `DISCORD_BOT_TOKEN`: From Discord Developer Portal.
- `TELEGRAM_BOT_TOKEN`: (Optional) If using Telegram.

### Hosted Mode (Optional)
Only set these if running the public hosted version (tabletoptime.us):
- `NEXT_PUBLIC_IS_HOSTED`: Set to `true` to enable hosted-specific behavior (public sitemap, SEO/AEO indexing).

## 3. Database Migration
Since you validated with SQLite locally, you must switch to Postgres for production.

1. **Update Schema**: Ensure `provider = "postgresql"` in `prisma/schema.prisma`.
   *(Or use Vercel's specific Prisma setups if using their storage)*.

2. **Run Migrations**:
   Add this to your "Build Command" in Vercel or run strictly during build:
   `npx prisma generate && npx prisma migrate deploy`

## 4. Discord Configuration
1. Go to Discord Developer Portal -> OAuth2.
2. Add your **Production Redirect URI**:
   `https://your-project.vercel.app/api/auth/discord/callback`
