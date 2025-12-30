# TabletopTime

> **Ditch the group chat chaos.** A self-hosted, simplified scheduling tool for tabletop gamers.

![License](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)

## Overview
TabletopTime helps you find the best time for your gaming group to meet. It is designed to be self-hosted on your home server (Synology, Unraid, Rasp Pi) and integrates deeply with Telegram for real-time coordination.

### Key Features
- **Host**: Create events with multiple time slots, quorum rules (min players), and capacity limits (max players).
- **Vote**: No login required. Simple "Yes", "If Needed", or "No" voting.
- **Waitlist**: Automatic waitlist management with First-Come-First-Serve promotion when spots open up.
- **Finalize**: Select a host/location and generate calendar invites (.ics / Google Calendar).
- **Telegram / Discord Bot**: 
  - Pins a live-updating dashboard in your group chat.
  - Notifies everyone when an event is finalized.
  - **Discord Exclusive**: "Recover with Discord" allows instant login for event managers.
- **Privacy-First**: Your data stays on your server (SQLite). We capture as little information as possible and use your local browser cache to remember who you are.

## One Click Start (Cloud)

Don't want to manage a server? We host a free version for the community supported by unobtrusive ads.

[**Launch TabletopTime Cloud**](https://www.tabletoptime.us/)

## Quick Start (Docker)

The easiest way to run TabletopTime is using the pre-built Docker image.

```bash
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e DATABASE_URL="file:/app/data/scheduler.db" \
  --name tabletop-time \
  ghcr.io/mels0n/tabletop_scheduler:latest
```

Open `http://localhost:3000` to start creating events.

## Configuration

TabletopTime is configured via environment variables. See [EnvVariables.md](docs/reference/EnvVariables.md) for a complete list.

| Variable | Required | Description | Default / Example |
|----------|----------|-------------|-------------------|
| `DATABASE_URL` | **Yes** | Path to SQLite DB. Must match volume mount. | `file:/app/data/scheduler.db` |
| `TELEGRAM_BOT_TOKEN` | Optional | Token from @BotFather for notifications. | `123456:ABC...` |
| `TZ` | Optional | Timezone for logs/database. | `America/Chicago` |

## Documentation

*   **[Telegram Setup Guide](docs/guides/TelegramSetup.md)**: How to create a Telegram bot.
*   **[Discord Setup Guide](docs/guides/DiscordSetup.md)**: How to create a Discord bot and enable OAuth.
*   **[Understanding Magic Links](docs/guides/MagicLinks.md)**: How passwordless recovery and login works.
*   **[Environment Variables](docs/reference/EnvVariables.md)**: Detailed configuration options.
*   **[Privacy & Architecture](docs/reference/PrivacyAndArchitecture.md)**: How we ensure self-hosted privacy (NoOp builds).
*   **[API Reference](docs/reference/ApiReference.md)**: Internal API endpoints and webhook specs.
*   **[User Guide](docs/guides/UserGuide.md)**: Comprehensive usage guide.
*   **[Contributing](CONTRIBUTING.md)**: Guide for developers wanting to help out.
*   **[Reverse Proxy Example](docs/examples/nginx.conf)**: Nginx configuration for exposing to the web.

## Development

To build from source:

1.  Clone the repo: `git clone https://github.com/mels0n/tabletop_scheduler.git`
2.  Install dependencies: `npm install`
3.  Initialize DB: `npx prisma migrate dev`
4.  Start server: `npm run dev`

See [CONTRIBUTING.md](CONTRIBUTING.md) for more comprehensive dev instructions.

## License
CC-BY-NC-SA 4.0


