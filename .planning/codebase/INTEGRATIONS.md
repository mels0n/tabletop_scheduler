# External Integrations

**Analysis Date:** 2026-04-22

## APIs & External Services

**Telegram Bot API:**
- Used for: Group chat notifications (pinned dashboard messages), private DMs to participants and managers, event reminders, magic login links, event recovery, webhook mode (hosted) and long-polling fallback (local/self-hosted)
- Client: Direct `fetch` via `shared/lib/fetch.ts` (`reliableFetch` wrapper); no SDK
- API endpoint: `https://api.telegram.org/bot{TOKEN}/{method}`
- Functions in: `features/telegram/lib/telegram-client.ts` (`sendTelegramMessage`, `pinChatMessage`, `unpinChatMessage`, `editMessageText`, `deleteMessage`, `ensureWebhook`, `deleteWebhook`, `getBotUsername`)
- Auth: `TELEGRAM_BOT_TOKEN` env var
- Webhook path: `POST /api/telegram/webhook`
- Startup initialization: `instrumentation.ts` — webhook mode if `NEXT_PUBLIC_BASE_URL` is set, long-poll otherwise

**Discord Bot API v10:**
- Used for: Sending/editing/pinning channel messages, DMs to managers, fetching guild channels for channel picker, OAuth2 login
- Client: Direct `fetch` via `shared/lib/fetch.ts`; API v10 at `https://discord.com/api/v10/`
- Functions in: `features/discord/model/discord.ts` (`sendDiscordMessage`, `editDiscordMessage`, `pinDiscordMessage`, `unpinDiscordMessage`, `getGuildChannels`, `createDMChannel`, `getDiscordUser`)
- Auth: `DISCORD_BOT_TOKEN` env var (bot endpoints); `DISCORD_APP_ID` + `DISCORD_CLIENT_SECRET` (OAuth2)
- OAuth2 scopes: `identify` (login flow); `bot identify` with permissions `93184` (connect/add-bot flow)

**Ko-fi Webhook:**
- Used for: Receiving donation/subscription/commission notifications; persisting to `Donation` model; triggering ISR revalidation of landing page for "Wall of Love" display
- Integration type: Incoming webhook — Ko-fi POSTs `application/x-www-form-urlencoded` with JSON `data` field
- Webhook path: `POST /api/kofi/webhook`
- Auth: Verifies `verification_token` in payload against `KOFI_VERIFICATION_TOKEN` env var
- Idempotency: `kofiTransactionId` unique key prevents duplicate records

**Google Calendar / Outlook Calendar:**
- Used for: Deep-link "Add to Calendar" buttons after event finalization
- Integration type: Outgoing URL deep links only (no API calls)
- Implementation: `shared/lib/calendar.ts` (`googleCalendarUrl`, `outlookCalendarUrl`)
- No auth required

**ICS / iCalendar:**
- Used for: Downloadable `.ics` file for finalized events (Outlook, Apple Calendar, etc.)
- Endpoint: `GET /api/event/[slug]/ics`
- Implementation: `app/api/event/[slug]/ics/route.ts` — generates `text/calendar` response

## Data Storage

**Databases:**

Self-hosted mode:
- SQLite via Prisma ORM
- Schema: `prisma/schema.prisma`
- Connection: `DATABASE_URL` env var (e.g., `file:./dev.db` locally; `file:/app/data/scheduler.db` in Docker)
- Client: `@prisma/client` singleton at `shared/lib/prisma.ts`

Hosted mode:
- PostgreSQL via Prisma ORM
- Schema: `prisma/schema.hosted.prisma`
- Connection: `DATABASE_URL` env var (PostgreSQL connection string)
- Same client singleton; only schema/migrations differ

**Models:** `Event`, `TimeSlot`, `Participant`, `Vote`, `LoginToken`, `WebhookEvent`, `Donation`

**File Storage:**
- Local filesystem only (no cloud storage)
- Docker volume at `/app/data` for SQLite database and cron logs

**Caching:**
- Next.js ISR (Incremental Static Regeneration) via `revalidatePath('/')` in Ko-fi webhook handler
- Telegram `getBotUsername` uses Next.js `fetch` `next.revalidate: 3600` (1 hour) for bot info caching
- No Redis or external cache layer

## Authentication & Identity

**Auth Provider:**
- Custom (no third-party auth provider like Auth0, NextAuth, Clerk)

**Mechanisms:**

1. **Admin Token (Cookie-based):**
   - UUID token stored as cookie `tabletop_admin_{slug}` (HttpOnly, 400-day expiry)
   - Token is hashed before storage in DB (`Event.adminToken`); plaintext in cookie
   - Cookie helper: `shared/lib/auth-cookie.ts`; token hashing: `shared/lib/token.ts`

2. **Discord OAuth2:**
   - Flow: Authorization Code; redirects to/from `https://discord.com/oauth2/authorize`
   - Callback: `GET /api/auth/discord/callback`
   - Sets cookies: `tabletop_user_discord_id` (HttpOnly), `tabletop_user_discord_name` (public readable)
   - Token exchange at `https://discord.com/api/oauth2/token`
   - User profile at `https://discord.com/api/users/@me`

3. **Telegram Magic Link Login:**
   - User sends `/start login` to the bot
   - Bot generates UUID token → hashes it → stores hash in `LoginToken` table → sends plaintext link
   - Link: `{baseUrl}/auth/login?token={plaintextToken}`; valid 15 minutes
   - Sets cookie: `tabletop_user_chat_id`

4. **Sliding Sessions (Middleware):**
   - `middleware.ts` refreshes all auth cookies to 400-day expiry on every request
   - Route protection: `/e/[slug]/manage` requires admin cookie or global auth cookie

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, or similar)

**Logs:**
- Custom structured logger at `shared/lib/logger.ts` — `Logger` class with context prefixes and JSON data serialization
- Log levels: `debug | info | warn | error` (configured via `LOG_LEVEL` env var, default `info`)
- Outputs to `console.*` (stdout/stderr); Prisma query logging enabled when `LOG_LEVEL=debug`
- Docker: Cron loop logs written to `/app/data/cron.log`

## CI/CD & Deployment

**Hosting:**
- **Vercel** (hosted/production): Next.js deployment; Vercel Cron configured via `vercel.json` (`/api/cron/cleanup` daily at midnight)
- **Docker** (self-hosted): Multi-stage Alpine build; `Dockerfile` in root; exposed on port 3000; `start.sh` entrypoint handles migrations + internal cron loops

**CI Pipeline:**
- None detected (no GitHub Actions, CircleCI, etc.)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` — Database connection string (SQLite file path or PostgreSQL URL)
- `DISCORD_APP_ID` — Discord application/client ID for OAuth2 and bot
- `DISCORD_CLIENT_SECRET` — Discord OAuth2 client secret
- `DISCORD_BOT_TOKEN` — Discord bot token for channel messaging
- `TELEGRAM_BOT_TOKEN` — Telegram bot API token
- `NEXT_PUBLIC_BASE_URL` — Public URL of the deployment (triggers Telegram webhook mode vs polling)
- `CRON_SECRET` — Bearer token for securing cron endpoints from external callers
- `KOFI_VERIFICATION_TOKEN` — Webhook verification token from Ko-fi dashboard

**Optional env vars:**
- `TELEGRAM_BOT_USERNAME` — Bot username for invite link generation
- `LOG_LEVEL` — Logging verbosity (`debug | info | warn | error`; default `info`)
- `TZ` — Server timezone (e.g., `America/New_York`)
- `NEXT_PUBLIC_IS_HOSTED` — Enables SEO, sitemap, AEO/schema features; disables noindex
- `CLEANUP_RETENTION_DAYS_FINALIZED`, `CLEANUP_RETENTION_DAYS_DRAFT`, `CLEANUP_RETENTION_DAYS_CANCELLED` — Event retention periods before cron cleanup
- `IS_DOCKER_BUILD` — Triggers `standalone` Next.js output (set via Dockerfile only)

**Secrets location:**
- Local: `.env` file (not committed; `.env.example` provided)
- Production (Vercel): Vercel environment variables dashboard
- Production (Docker): Environment variables passed to container at runtime

## Webhooks & Callbacks

**Incoming:**
- `POST /api/kofi/webhook` — Ko-fi payment notifications (donations, subscriptions, etc.)
- `POST /api/telegram/webhook` — Telegram bot updates (messages, commands)

**Outgoing:**
- `WebhookEvent` model + `shared/lib/webhook-sender.ts` — Application fires outgoing webhooks to event `fromUrl` on state changes (participant joins, event finalized, etc.)
- Retry logic: up to ~12 attempts over ~1 hour; statuses: `PENDING → DELIVERED | FAILED`
- Processed by cron: `GET /api/cron/webhooks` (batches 50 at a time)
- Discord API calls for channel messages (send/edit/pin)
- Telegram API calls for chat messages (send/edit/pin/delete)

---

*Integration audit: 2026-04-22*
