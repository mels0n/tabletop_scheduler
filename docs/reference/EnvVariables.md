# Environment Variables

TabletopTime uses environment variables for configuration. You can set these in a `.env` file for local development or pass them to the Docker container.

## Core Configuration

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `DATABASE_URL` | **Yes** | `file:./dev.db` | Connection string for the database. For Docker, usually `file:/app/data/scheduler.db`. |
| `TZ` | No | `UTC` | Timezone for the server (e.g., `America/Chicago`). Important for log timestamps and cron job logic. |
| `NODE_ENV` | No | `development` | Set to `production` for deployed environments. |
| `LOG_LEVEL` | No | `info` | Logging verbosity. Options: `debug`, `info`, `warn`, `error`. Prisma queries are logged only in `debug`. |
| `CRON_SECRET` | No | - | Secure token to authorize external calls to `/api/cron/cleanup`. Required if triggering cleanup from outside localhost. |


## Event Retention (Cleanup)
*Control how long events stay in the database after they pass.*

| Variable | Default (Days) | Description |
|----------|:--------------:|-------------|
| `CLEANUP_RETENTION_DAYS_FINALIZED` | `1` | days to keep Finalized events after their start time. |
| `CLEANUP_RETENTION_DAYS_DRAFT` | `1` | Days to keep Draft events (calculated from last proposed slot). |
| `CLEANUP_RETENTION_DAYS_CANCELLED` | `1` | Days to keep Cancelled events. |



## Telegram Integration
*Required only if you want bot notifications.*

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `TELEGRAM_BOT_TOKEN` | No | - | The HTTP API Token from @BotFather. |
| `NEXT_PUBLIC_BASE_URL` | No | - | Public URL of the app (e.g. `https://myapp.vercel.app`). Setting this **ENABLES Webhook Mode** automatically. |
| `TELEGRAM_BOT_USERNAME` | No | `TabletopSchedulerBot` | Your bot's handle (without @). Used for generating deep links (e.g. Magic Links). Important for self-hosting! |

## Discord Integration
*Required for Discord notifications and "Recover with Discord".*

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `DISCORD_APP_ID` | Yes | - | Application ID from Discord Developer Portal. |
| `DISCORD_CLIENT_SECRET` | Yes | - | Client Secret from Discord Developer Portal (OAuth2). |
| `DISCORD_BOT_TOKEN` | Yes | - | Bot Token from Discord Developer Portal. |

## Public/Client Configuration

| Variable | Required | Default | Description |
|----------|:--------:|:-------:|-------------|
| `NEXT_PUBLIC_GOOGLE_ADSENSE_ID` | No | - | Publisher ID for Google AdSense (e.g. `ca-pub-123...`). |
| `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | No | - | Measurement ID for Google Analytics 4 (e.g. `G-XYZ...`). |
| `NEXT_PUBLIC_IS_HOSTED` | No | `false` | Set to `true` to enable "Hosted" specific features (Ads, Analytics, Sitemap). Leave unset or `false` for self-hosted privacy. |


## Example `.env` File
```env
DATABASE_URL="file:./dev.db"
TELEGRAM_BOT_TOKEN="123456789:ABCdef..."
TZ="America/New_York"
```
