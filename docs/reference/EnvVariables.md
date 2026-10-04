# Environment Variables

TabletopTime reads its configuration from environment variables. Set them in a `.env` file for local development, pass them to the Docker container, or define them in your Vercel project.

All application variables are parsed and validated once, at server boot, by `shared/config/server.ts` (browser-visible `NEXT_PUBLIC_*` values are read by `shared/config/public.ts` and inlined at build time). If anything required is missing or malformed, the server refuses to start and the error lists every problem at once, so you fix them in one pass instead of one restart per variable. `DATABASE_URL` and `DIRECT_URL` are read by Prisma, and `IS_DOCKER_BUILD` by `next.config.mjs`.

Empty values count as unset. `NODE_ENV`, `VERCEL` and `VERCEL_ENV` are set by Node, Next.js or Vercel; you do not set them yourself, but the rules below refer to them.

## Database

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `DATABASE_URL` | **Yes** | Docker: `file:/app/data/scheduler.db` when unset. Otherwise none. | Connection string. Local development: `file:./dev.db` (the file is created at `prisma/dev.db`). Self-host: a SQLite file URL; the container refuses to start with anything else, so a Postgres URL is not supported there. Hosted: the pooled Supabase URL on port 6543, ending in `?pgbouncer=true&connection_limit=1`. |
| `DIRECT_URL` | Hosted only | - | Direct (non-pooled) Postgres URL on port 5432. Prisma Migrate cannot run through the transaction pooler, so migrations use this. Not read on self-host. |
| `PRISMA_ACCEPT_DATA_LOSS` | No | unset | Self-host only, and for recovery only. `1` or `true` lets container startup apply a schema change that would drop data. Releases never need it (every release upgrades with a plain `db push`); it exists to repair a database that is already in a broken state, such as one edited by hand. Without it, startup stops and logs why. Back up `/app/data` first, and remove the variable after the one start that needs it. |

## Public and Mode

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `NEXT_PUBLIC_IS_HOSTED` | No | `false` | `true` enables hosted behavior: indexing, the sitemap, `includeSubDomains` on the HSTS header, and the `CRON_SECRET` requirement. Leave unset for self-hosted privacy defaults. Inlined at build time; the Docker image is always built with `false`. |
| `NEXT_PUBLIC_BASE_URL` | When a bot token is set | - | Public URL of the app, for example `https://scheduler.example.com`. Every link the bots send (magic logins, event links, reminders) is built from it. **Needed whenever any bot token is set**, in every Telegram mode including polling. When hosted (`NEXT_PUBLIC_IS_HOSTED=true`) or on Vercel, omitting it stops the server at boot. A self-hosted instance still starts without it, logs an error, and every bot link fails until it is set. For a self-hosted instance behind NAT, use an address your players can reach (a LAN URL is fine); polling is the self-host default. |
| `NEXT_PUBLIC_BOT_NAME` | No | `the Bot` | Display name of your Discord bot, shown in the "Action Required: Permissions" steps on the manage page when the bot cannot post in the chosen channel. Telegram links (the "Add @bot to Group" button, the "Connect Telegram" pill) use the username Telegram reports for the bot token, not this value. Inlined at build time. |

## Secrets

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `SESSION_SECRET` | On Vercel production (`VERCEL_ENV=production`), and on any non-Vercel server with `NODE_ENV=production` | `dev-session-secret` off Vercel in development and tests; on a Vercel non-production deployment, an ephemeral value (derived per deployment from `CRON_SECRET` when one is set, otherwise random per process; one warning is logged) | HMAC key that signs the identity cookies, the participant cookies and Telegram connect codes, and the root of the per-destination outbound webhook signing keys (each derived from the destination's origin, see [External Integrations](../guides/ExternalIntegrations.md)). Use 32 or more random bytes. Changing it signs everyone out, invalidates every participant cookie (voters then need a linked identity or the organizer to edit their row), and changes every webhook signing key. The Docker image generates one into `/app/data/.session-secret` on first start if you leave it unset. |
| `CRON_SECRET` | When `NEXT_PUBLIC_IS_HOSTED=true` or on Vercel production (`VERCEL_ENV=production`); not on Vercel Preview | - | Bearer token required by every `/api/cron/*` route and `/api/telegram/setup`. It is not used for webhook signatures. The Docker image generates one into `/app/data/.cron-secret` if unset, and its internal scheduler uses it automatically. Without one, every cron route rejects every request. |

## Telegram

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `TELEGRAM_BOT_TOKEN` | No | - | HTTP API token from @BotFather. Leave unset to disable Telegram. |
| `TELEGRAM_MODE` | No | derived | `webhook`, `polling`, or `off`. When unset with a token: `polling` on a self-hosted install, `webhook` when hosted or on Vercel. Without a token: `off`. Set `webhook` on a self-hosted install only when `NEXT_PUBLIC_BASE_URL` is a public HTTPS address Telegram can reach. `polling` on Vercel stops the server at boot. `NEXT_PUBLIC_BASE_URL` is needed in every mode for the links the bot sends. In webhook mode the server registers its webhook at startup only when Telegram's current registration differs. |

## Discord

All three are optional. Discord sign-in and the server-connect flow need `DISCORD_APP_ID` and `DISCORD_CLIENT_SECRET`; channel posts, dashboards and direct messages need `DISCORD_BOT_TOKEN`. Set all three for the full integration. A Discord bot token also needs `NEXT_PUBLIC_BASE_URL` (required at boot when hosted or on Vercel; logged as an error on a self-hosted install).

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
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, or `error` (case-insensitive). Logs are one JSON object per line. Prisma queries are logged only at `debug`. |

## Notifications

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `VOTE_ANNOUNCE_COOLDOWN_MINUTES` | No | `60` | Minimum minutes between two "updated their availability" posts to the group or channel for the same participant. A participant who changes their vote again inside the window does not trigger another post; the pinned dashboard is still updated on every vote. Whole number from `0` to `1440`; `0` announces every vote. |

## Event Retention (Cleanup)

*Control how long events stay in the database after they pass. Each value is a whole number of days.*

| Variable | Default (Days) | Description |
|----------|:--------------:|-------------|
| `CLEANUP_RETENTION_DAYS_FINALIZED` | `1` | Days to keep a finalized event after its finalized slot ends (one-shot) or its last scheduled session ends (campaign). |
| `CLEANUP_RETENTION_DAYS_DRAFT` | `1` | Days to keep a draft after its last proposed time ends. A draft with no proposed times is counted from its creation. Editing a draft does not extend it. |
| `CLEANUP_RETENTION_DAYS_CANCELLED` | `1` | Days to keep a cancelled event after cancellation. |

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
