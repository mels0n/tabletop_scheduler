# TabletopTime

> **Ditch the group chat chaos.** A scheduling tool for tabletop gamers, hosted for the community or self-hosted on your own server.

[![CI](https://img.shields.io/github/actions/workflow/status/mels0n/tabletop_scheduler/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/mels0n/tabletop_scheduler/actions/workflows/ci.yml)
[![Docker image](https://img.shields.io/badge/docker-ghcr.io-2496ed?logo=docker&logoColor=white&style=flat-square)](https://github.com/mels0n/tabletop_scheduler/pkgs/container/tabletop_scheduler)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-lightgrey?style=flat-square)](LICENSE)
[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-support%20the%20project-ff5e5b?logo=ko-fi&logoColor=white&style=flat-square)](https://ko-fi.com/N4N11VDWCU)

**Live on [tabletoptime.us](https://tabletoptime.us/) right now:**
[![Events active](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Ftabletoptime.us%2Fapi%2Fstats&query=%24.eventsActive&label=events%20active&color=34d399&style=flat-square&cacheSeconds=3600)](https://tabletoptime.us/)
[![Voting open](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Ftabletoptime.us%2Fapi%2Fstats&query=%24.votingOpen&label=voting%20open&color=60a5fa&style=flat-square&cacheSeconds=3600)](https://tabletoptime.us/)
[![Players active](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Ftabletoptime.us%2Fapi%2Fstats&query=%24.playersActive&label=players%20active&color=c084fc&style=flat-square&cacheSeconds=3600)](https://tabletoptime.us/)
[![Games locked in](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Ftabletoptime.us%2Fapi%2Fstats&query=%24.gamesLockedIn&label=games%20locked%20in&color=fbbf24&style=flat-square&cacheSeconds=3600)](https://tabletoptime.us/)

## What it is

TabletopTime helps your gaming group find the best time to meet. A host proposes time slots, everyone votes without making an account, and the host finalizes a slot. The hosted version runs at [tabletoptime.us](https://tabletoptime.us/). The same code ships as a Docker image for home servers (Synology, Unraid, Raspberry Pi) and integrates with Telegram and Discord for real-time coordination.

### Key Features
- **Host**: Create, edit, and delete time slots dynamically. Manage quorum rules (min players) and capacity limits (max players). Remove accepted participants to trigger waitlist auto-promotion.
- **Vote & Suggest**: No login required. Simple "Yes", "If Needed", or "No" voting. Attendees can also suggest new time slots if none work.
- **Waitlist**: Automatic waitlist management with First-Come-First-Serve promotion when spots open up. "If Needed" players are seated automatically only when the table is below its minimum, "Yes" voters whenever a seat is open; a waitlisted player can switch to "Yes" to claim an open seat.
- **Finalize**: Select a host/location and generate calendar invites (.ics / Google Calendar). Once finalized, slot management is locked.
- **Telegram / Discord Bot**:
  - Pins a live-updating dashboard in your group chat or channel.
  - Posts slot changes, availability updates, the finalized result, and cancellations.
  - Sends voting and session reminders when the organizer turns them on.
  - DMs the organizer a login link if they lose the manage page, and DMs players about waitlist promotions and final results (each person can turn bot DMs off).
- **My Events & Cross-Device Sync**: No account, but sign in through the Telegram bot or with Discord and your voting history follows you anywhere. The profile page shows a per-event sync badge (linked, or "This Device Only"), and you can link or unlink any event you've voted on straight from that badge.
- **Privacy & Security**:
  - **Zero Tracking**: We do not use Google Analytics, Facebook Pixels, or any third-party trackers.
  - **Hashed admin tokens**: Event admin tokens are hashed (SHA-256) before storage. A token from an older release that is still stored in plaintext is rewritten as its hash the first time it is used.
  - **Signed identity cookies**: Platform identities (Telegram, Discord) are stored in signed cookies, and a bare platform ID is never trusted as a login.
  - **Self-Hostable**: Your data stays on your server (SQLite). We capture as little information as possible.
  - **Persistence**: We use cookies only to restore your session, never to track you.

## Run it

The easiest way to run TabletopTime is the pre-built Docker image.

```bash
mkdir -p data && sudo chown 1000:1000 data

docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e DATABASE_URL="file:/app/data/scheduler.db" \
  --name tabletop-time \
  ghcr.io/mels0n/tabletop_scheduler:latest
```

Open `http://localhost:3000` to start creating events.

**Upgrading is automatic.** Run `docker pull ghcr.io/mels0n/tabletop_scheduler:latest` and restart the container; on start it brings your database up to date from whatever release you were on, keeping your data.

### Upgrading

Check these settings when you move to a new release with a bot connected:

- **Set `NEXT_PUBLIC_BASE_URL`.** Every link a Telegram or Discord bot sends (logins, events, reminders) is built from it. Without it the app still starts, but it logs an error and bot links fail until you set it. Use an address your players can open; a LAN address works behind NAT.
- **Polling is the self-host default.** With a Telegram token and no `TELEGRAM_MODE`, a self-hosted install polls Telegram, which needs no public URL.
- **Set `TELEGRAM_MODE=webhook` only with a public URL.** If your install used webhook mode before, keep it by setting `TELEGRAM_MODE=webhook`; `NEXT_PUBLIC_BASE_URL` must then be a public HTTPS address Telegram can reach. If the log says another consumer owns the bot, a webhook is still registered: set `TELEGRAM_MODE=webhook` or delete the webhook.

**Bind mounts and UID 1000.** The container runs as the `node` user (UID 1000). A bind-mounted `./data` directory must be writable by UID 1000, or the database cannot be created and the container exits at startup. A named Docker volume needs no extra step.

**Secrets.** If `SESSION_SECRET` or `CRON_SECRET` is unset, the container generates a random value on first start and keeps it in `/app/data` (`.session-secret`, `.cron-secret`), so they survive restarts as long as the data volume does. Set them explicitly if you run more than one instance against the same data.

**How the schema is applied (`db push` contract).** The Docker image uses SQLite and applies the schema on every start with `prisma db push`. There is no migration history for self-hosters: the schema in the image is the schema you get. Releases only ever add to the schema, and CI checks that every past release upgrades without losing data. If startup ever stops with a data-loss warning (a database edited by hand, for example), it has deleted nothing: back up `/app/data/scheduler.db`, then start once with `PRISMA_ACCEPT_DATA_LOSS=1` to accept the change, and remove the variable afterwards.

### Configuration

All configuration is through environment variables, validated once at boot. A missing or invalid value stops the server with a message that lists every problem. See [EnvVariables.md](docs/reference/EnvVariables.md) for the full reference.

| Variable | Required | Description | Default / Example |
|----------|----------|-------------|-------------------|
| `DATABASE_URL` | **Yes** | SQLite path (Docker) or pooled Postgres URL (hosted). | `file:/app/data/scheduler.db` |
| `DIRECT_URL` | Hosted only | Direct (non-pooled) Postgres URL used for migrations. | `postgresql://...:5432/postgres` |
| `NEXT_PUBLIC_IS_HOSTED` | No | `true` enables hosted behavior (indexing, sitemap). | `false` |
| `NEXT_PUBLIC_BASE_URL` | When a bot token is set | URL of the app, used for every link the bots send. Hosted and Vercel refuse to start without it when a bot token is set; a self-hosted install starts, logs an error and sends broken bot links until it is set (a LAN address works behind NAT). | `https://scheduler.example.com` |
| `NEXT_PUBLIC_BOT_NAME` | No | Display name of your Discord bot, shown in the channel-permission instructions on the manage page. Telegram links use the bot username reported by Telegram. | `TabletopTime` |
| `SESSION_SECRET` | Production (Vercel production, or `NODE_ENV=production` off Vercel) | Signs identity and participant cookies and Telegram connect codes, and derives the outbound webhook signing keys. Docker generates one if unset. | 32+ random bytes, base64 |
| `CRON_SECRET` | Hosted, or Vercel production | Bearer token for `/api/cron/*`. Docker generates one if unset. Outbound webhooks are signed with a key derived from `SESSION_SECRET`, not this value. | 32+ random bytes, base64 |
| `TELEGRAM_BOT_TOKEN` | No | Token from @BotFather. | `123456:ABC...` |
| `TELEGRAM_MODE` | No | `webhook`, `polling`, or `off`. When unset with a token: `polling` on a self-hosted install, `webhook` when hosted or on Vercel. Without a token: `off`. | derived |
| `DISCORD_BOT_TOKEN` | No | Discord bot token. | |
| `DISCORD_APP_ID` | No | Discord application ID. | |
| `DISCORD_CLIENT_SECRET` | No | Discord OAuth client secret. | |
| `KOFI_VERIFICATION_TOKEN` | No | Verification token for the Ko-fi donation webhook. | |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, or `error`. | `info` |
| `VOTE_ANNOUNCE_COOLDOWN_MINUTES` | No | Minutes between "updated their availability" group posts for the same person (0 to 1440; `0` posts every vote). The pinned dashboard updates on every vote. | `60` |
| `WEBHOOK_ALLOW_PRIVATE` | No | Self-host only. `true` lets an event's webhook `fromUrl` use plain `http` and private or LAN addresses. Ignored when hosted or on Vercel. | `false` |
| `CLEANUP_RETENTION_DAYS_FINALIZED` | No | Days to keep a finalized event after its chosen slot (or a campaign's last session) ends. | `1` |
| `CLEANUP_RETENTION_DAYS_DRAFT` | No | Days to keep a draft after its last proposed time ends. | `1` |
| `CLEANUP_RETENTION_DAYS_CANCELLED` | No | Days to keep a cancelled event after cancellation. | `1` |
| `PRISMA_ACCEPT_DATA_LOSS` | No | Self-host only, recovery only. Set to `1` for one start to apply a schema change that drops data; releases never need it. | unset |
| `IS_DOCKER_BUILD` | No | Build-time flag set by the Dockerfile (standalone output). | `false` |

## Documentation

*   **[Telegram Setup Guide](docs/guides/TelegramSetup.md)**: How to create a Telegram bot and connect an event.
*   **[Discord Setup Guide](docs/guides/DiscordSetup.md)**: How to create a Discord bot and enable OAuth.
*   **[Understanding Magic Links](docs/guides/MagicLinks.md)**: How passwordless recovery and login works.
*   **[Environment Variables](docs/reference/EnvVariables.md)**: Detailed configuration options.
*   **[Privacy & Architecture](docs/reference/PrivacyAndArchitecture.md)**: How the hosted and self-hosted builds differ.
*   **[API Reference](docs/reference/ApiReference.md)**: Every HTTP route, its auth, and its request and response shapes.
*   **[Architecture Decisions](docs/adr/0001-stack-and-dual-target.md)**: Why the stack and the dual database target look the way they do.
*   **[User Guide](docs/guides/UserGuide.md)**: Comprehensive usage guide.
*   **[Contributing](CONTRIBUTING.md)**: Guide for developers wanting to help out.
*   **[Reverse Proxy Example](docs/examples/nginx.conf)**: Nginx configuration for exposing to the web.

## Develop

Requirements: Node 22 and npm.

```bash
git clone https://github.com/mels0n/tabletop_scheduler.git
cd tabletop_scheduler
npm ci
cp .env.example .env        # DATABASE_URL="file:./dev.db" is enough to start
npx prisma db push          # creates prisma/dev.db from prisma/schema.prisma
npm run dev
```

### Blog posts

Posts live in `content/blog/*.md`. A build publishes only the posts that are live on the build date: `draft: true` never publishes, and a post dated after the build date waits for a later build. `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run depcruise` first run `scripts/generate-published-posts.mjs`, which writes `shared/data/published-posts.generated.ts` (gitignored). The site reads posts only from that module, through `shared/lib/blog.ts`.

```bash
SHOW_SCHEDULED=1 npm run dev                  # also show future-dated posts
SHOW_DRAFTS=1 SHOW_SCHEDULED=1 npm run dev    # also show drafts
BUILD_DATE=2026-12-01 npm run build           # build as if it were that date (UTC, YYYY-MM-DD)
```

The preview flags apply only to `npm run dev`; production builds, CI and any run with `NODE_ENV=production` ignore them. Restart the dev server after editing a post or changing a flag, because the module is generated once at startup. `npm run blog:queue` lists live, scheduled and draft posts.

Checks to run before opening a pull request:

```bash
npm run typecheck
npm run lint
npm test
npm run depcruise
npx next build
```

The app has two Prisma targets from one codebase: `prisma/schema.prisma` (SQLite, self-host and local development) and `prisma/hosted/schema.prisma` (Postgres, hosted). A schema change edits both files and adds a migration under `prisma/hosted/migrations/`. See [CONTRIBUTING.md](CONTRIBUTING.md) and [HostedMaintenance.md](docs/guides/HostedMaintenance.md).

## Deploy

The hosted version runs on Vercel with a Supabase Postgres database.

- **Build and migrations.** `vercel.json` points the build at `scripts/vercel-build.sh`, which generates the Prisma client from the hosted schema, runs `prisma migrate deploy` and pending data migrations on production builds only, then builds the app. A failed migration fails the deploy. Preview builds never migrate.
- **CI gates.** Pull requests and pushes run typecheck, lint, tests, a production build, the dependency-direction check, the self-host upgrade check, and a check that the hosted migration history matches `prisma/hosted/schema.prisma`. The Docker image is published only after those pass. `main` is protected, so every change lands through a pull request that passes these checks.
- **Fortnightly rebuild.** A GitHub Actions workflow calls a Vercel deploy hook every other Thursday so scheduled blog posts go live. It pushes no commits.
- **Required settings.** `DATABASE_URL` (pooled), `DIRECT_URL`, `NEXT_PUBLIC_IS_HOSTED=true`, `NEXT_PUBLIC_BASE_URL`, `SESSION_SECRET`, and `CRON_SECRET`.
- **Scheduled jobs.** Event cleanup runs daily from Vercel Cron. Reminders and the outbound webhook queue run from Supabase `pg_cron`, with a GitHub Actions reminder run every two hours as a backstop; the one-time setup is in [HostedMaintenance.md](docs/guides/HostedMaintenance.md#scheduling-reminders-with-pg_cron).

## Support

The hosted version is free to use. If TabletopTime saves your group some chaos, you can help with the hosting bill on [Ko-fi](https://ko-fi.com/N4N11VDWCU).

## License
CC-BY-NC-SA 4.0 (see [LICENSE](LICENSE)).

[Hosted by UntapWeb](https://untapweb.com)
