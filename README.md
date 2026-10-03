# TabletopTime

> **Ditch the group chat chaos.** A scheduling tool for tabletop gamers, hosted for the community or self-hosted on your own server.

![License](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)
<a href="https://ko-fi.com/N4N11VDWCU" target="_blank"><img height="36" src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com" /></a>

## What it is

TabletopTime helps your gaming group find the best time to meet. A host proposes time slots, everyone votes without making an account, and the host finalizes a slot. The hosted version runs at [tabletoptime.us](https://tabletoptime.us/). The same code ships as a Docker image for home servers (Synology, Unraid, Raspberry Pi) and integrates with Telegram and Discord for real-time coordination.

### Key Features
- **Host**: Create, edit, and delete time slots dynamically. Manage quorum rules (min players) and capacity limits (max players). Remove accepted participants to trigger waitlist auto-promotion.
- **Vote & Suggest**: No login required. Simple "Yes", "If Needed", or "No" voting. Attendees can also suggest new time slots if none work.
- **Waitlist**: Automatic waitlist management with First-Come-First-Serve promotion when spots open up.
- **Finalize**: Select a host/location and generate calendar invites (.ics / Google Calendar). Once finalized, slot management is locked.
- **Telegram / Discord Bot**:
  - Pins a live-updating dashboard in your group chat or channel.
  - Notifies everyone when an event is finalized.
  - Sends voting and session reminders when the organizer turns them on.
  - **Discord Exclusive**:
    - "Recover with Discord" allows instant login for event managers.
    - Post live-updating dashboards to your channel.
- **My Events & Cross-Device Sync**: No account, but connect Telegram or Discord and your voting history follows you anywhere. The profile page shows a per-event sync badge (linked, or "This Device Only"), and you can link or unlink any event you've voted on straight from that badge.
- **Privacy & Security**:
  - **Zero Tracking**: We do not use Google Analytics, Facebook Pixels, or any third-party trackers.
  - **Hashed admin tokens**: Event admin tokens are hashed (SHA-256) before storage. We never store plaintext keys.
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
| `NEXT_PUBLIC_BASE_URL` | When a bot token is set | URL of the app, used for every link the bots send. Required with any bot token in every Telegram mode, polling included (a LAN address works behind NAT). | `https://scheduler.example.com` |
| `NEXT_PUBLIC_BOT_NAME` | No | Telegram bot username used to build "Add to group" links. | `MyGroupBot` |
| `SESSION_SECRET` | Production (Vercel production, or `NODE_ENV=production` off Vercel) | Signs identity cookies. Docker generates one if unset. | 32+ random bytes, base64 |
| `CRON_SECRET` | Hosted, or Vercel production | Bearer token for `/api/cron/*`. Docker generates one if unset. Outbound webhooks are signed with a key derived from `SESSION_SECRET`, not this value. | 32+ random bytes, base64 |
| `TELEGRAM_BOT_TOKEN` | No | Token from @BotFather. | `123456:ABC...` |
| `TELEGRAM_MODE` | No | `webhook`, `polling`, or `off`. Derived from the token and base URL when unset. | derived |
| `DISCORD_BOT_TOKEN` | No | Discord bot token. | |
| `DISCORD_APP_ID` | No | Discord application ID. | |
| `DISCORD_CLIENT_SECRET` | No | Discord OAuth client secret. | |
| `KOFI_VERIFICATION_TOKEN` | No | Verification token for the Ko-fi donation webhook. | |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, or `error`. | `info` |
| `VOTE_ANNOUNCE_COOLDOWN_MINUTES` | No | Minutes between "updated their availability" group posts for the same person (0 to 1440; `0` posts every vote). The pinned dashboard updates on every vote. | `60` |
| `CLEANUP_RETENTION_DAYS_FINALIZED` | No | Days to keep a finalized event after its chosen slot (or a campaign's last session) ends. | `1` |
| `CLEANUP_RETENTION_DAYS_DRAFT` | No | Days to keep a draft after its last proposed time ends. | `1` |
| `CLEANUP_RETENTION_DAYS_CANCELLED` | No | Days to keep a cancelled event after cancellation. | `1` |
| `PRISMA_ACCEPT_DATA_LOSS` | No | Self-host only. Set to `1` to let startup apply a schema change that drops data. | unset |
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

Checks to run before opening a pull request:

```bash
npm run typecheck
npm run lint
npm test
```

The app has two Prisma targets from one codebase: `prisma/schema.prisma` (SQLite, self-host and local development) and `prisma/hosted/schema.prisma` (Postgres, hosted). A schema change edits both files and adds a migration under `prisma/hosted/migrations/`. See [CONTRIBUTING.md](CONTRIBUTING.md) and [HostedMaintenance.md](docs/guides/HostedMaintenance.md).

## Deploy

The hosted version runs on Vercel with a Supabase Postgres database.

- **Build and migrations.** `vercel.json` points the build at `scripts/vercel-build.sh`, which generates the Prisma client from the hosted schema, runs `prisma migrate deploy` on production builds only, then builds the app. A failed migration fails the deploy. Preview builds never migrate.
- **CI gates.** Pull requests and pushes run typecheck, lint, tests, a production build, and a check that the hosted migration history matches `prisma/hosted/schema.prisma`. The Docker image is published only after those pass.
- **Required settings.** `DATABASE_URL` (pooled), `DIRECT_URL`, `NEXT_PUBLIC_IS_HOSTED=true`, `NEXT_PUBLIC_BASE_URL`, `SESSION_SECRET`, and `CRON_SECRET`.
- **Scheduled jobs.** Event cleanup runs from Vercel Cron. Reminders and the outbound webhook queue run from Supabase `pg_cron`; the one-time setup is in [HostedMaintenance.md](docs/guides/HostedMaintenance.md#scheduling-reminders-with-pg_cron).

## License
CC-BY-NC-SA 4.0

[Hosted by UntapWeb](https://untapweb.com)
