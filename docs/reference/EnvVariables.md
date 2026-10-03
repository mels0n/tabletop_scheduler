# Environment Variables

TabletopTime reads its configuration from environment variables. Set them in a `.env` file for local development, pass them to the Docker container, or define them in your Vercel project.

All variables are parsed and validated once, at server boot, by `shared/config/server.ts`. If anything required is missing or malformed, the server refuses to start and the error lists every problem at once, so you fix them in one pass instead of one restart per variable.

## Database

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `DATABASE_URL` | **Yes** | `file:./dev.db` (local) | Connection string. Self-host: a SQLite path such as `file:/app/data/scheduler.db`. Hosted: the pooled Supabase URL on port 6543, ending in `?pgbouncer=true&connection_limit=1`. |
| `DIRECT_URL` | Hosted only | - | Direct (non-pooled) Postgres URL on port 5432. Prisma Migrate cannot run through the transaction pooler, so migrations use this. Not read on self-host. |
| `PRISMA_ACCEPT_DATA_LOSS` | No | unset | Self-host only. Set to `1` to let container startup apply a schema change that would drop data. Without it, startup stops and logs why. Remove it after the one start that needs it. |

## Public and Mode

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `NEXT_PUBLIC_IS_HOSTED` | No | `false` | `true` enables hosted behavior (indexing, sitemap). Leave unset for self-hosted privacy defaults. Inlined at build time. |
| `NEXT_PUBLIC_BASE_URL` | When a bot token is set | - | Public URL of the app, for example `https://scheduler.example.com`. Every link the bots send (magic logins, event links, reminders) is built from it. **Required whenever any bot token is set**, with one exception: Telegram polling mode on a self-hosted instance. Omitting it otherwise stops the server at boot. |
| `NEXT_PUBLIC_BOT_NAME` | No | - | Telegram bot username (without `@`), used to build the "Add Bot to Group" link in the manage page. Inlined at build time. |

## Secrets

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `SESSION_SECRET` | In production | `dev-session-secret` outside production | HMAC key that signs the identity cookies and Telegram connect codes. Use 32 or more random bytes. Changing it signs everyone out. The Docker image generates one into `/app/data/.session-secret` on first start if you leave it unset. |
| `CRON_SECRET` | On hosted | - | Bearer token required by every `/api/cron/*` route and `/api/telegram/setup`, and the key for the outbound webhook signature. The Docker image generates one into `/app/data/.cron-secret` if unset, and its internal scheduler uses it automatically. On a self-hosted install without one, cron routes accept only loopback requests. |

## Telegram

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `TELEGRAM_BOT_TOKEN` | No | - | HTTP API token from @BotFather. Leave unset to disable Telegram. |
| `TELEGRAM_MODE` | No | derived | `webhook`, `polling`, or `off`. When unset: `webhook` if a token and `NEXT_PUBLIC_BASE_URL` are set, `polling` if a token is set without a base URL (never on Vercel), otherwise `off`. |

## Discord

All three are optional, but Discord features need all three together.

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `DISCORD_BOT_TOKEN` | No | - | Bot token from the Discord Developer Portal. |
| `DISCORD_APP_ID` | No | - | Application ID. |
| `DISCORD_CLIENT_SECRET` | No | - | OAuth2 client secret, used for "Recover with Discord" and the server-connect flow. |

## Ko-fi

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `KOFI_VERIFICATION_TOKEN` | No | - | Verification token from your Ko-fi webhook settings. Without it, `/api/kofi/webhook` rejects every request. |

## Logging

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, or `error`. Logs are one JSON object per line. Prisma queries are logged only at `debug`. |

## Event Retention (Cleanup)

*Control how long events stay in the database after they pass.*

| Variable | Default (Days) | Description |
|----------|:--------------:|-------------|
| `CLEANUP_RETENTION_DAYS_FINALIZED` | `1` | Days to keep a finalized event after its finalized slot (one-shot) or its last scheduled session (campaign). |
| `CLEANUP_RETENTION_DAYS_DRAFT` | `30` | Days to keep a draft with no activity. |
| `CLEANUP_RETENTION_DAYS_CANCELLED` | `7` | Days to keep a cancelled event. |

## Build

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `IS_DOCKER_BUILD` | No | `false` | Build-time only. The Dockerfile sets it to `true`, which switches Next.js to `standalone` output. |

## Example `.env` File

```env
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
TELEGRAM_BOT_TOKEN="123456789:ABCdef..."
TELEGRAM_MODE="polling"
```
