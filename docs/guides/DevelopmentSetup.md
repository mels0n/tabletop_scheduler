# Development Setup Guide

## Prerequisites
- Node.js 22 (pinned in `.nvmrc`; `package.json` requires 22 or newer)
- npm
- Git

The app is built on Next.js 16 and React 19, with Prisma 5, ESLint 10 (flat config) and Vitest.

```bash
nvm use        # picks up .nvmrc
npm ci
```

## 1. Environment Configuration
The application reads its configuration from environment variables. For local development these live in a `.env` file in the project root.

**IMPORTANT:** The `.env` file is gitignored for security. Do NOT commit it.

### Setup Steps:
1. Copy the example file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in the values you need. `DATABASE_URL` is enough to start.

### Variable Reference:
- `DATABASE_URL`: Connection string for the local SQLite database.
  - Recommended: `"file:./dev.db"` (Points to `prisma/dev.db`)
- `NEXT_PUBLIC_BASE_URL`: The URL where the app is running (e.g., `http://localhost:3000`). Required whenever you set a Telegram or Discord bot token, in every Telegram mode.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_MODE=polling`: test the Telegram bot locally without a public URL.
- `DISCORD_APP_ID`: Application ID from Discord Developer Portal.
- `DISCORD_CLIENT_SECRET`: Client Secret from Discord Developer Portal.
- `DISCORD_BOT_TOKEN`: Bot Token from Discord Developer Portal.

The full list, with defaults, is in [EnvVariables.md](../reference/EnvVariables.md). Configuration is validated at boot, so a missing or invalid value stops `npm run dev` with a message that lists every problem.

## 2. Database Setup
The project uses Prisma with SQLite for local development and self-hosting. The SQLite schema has no migration history; `db push` makes the database match the schema file. Do not use `prisma migrate dev` for the SQLite schema.

1. **Generate Client:**
   ```bash
   npx prisma generate
   ```
2. **Create or update the database:**
   ```bash
   npx prisma db push
   ```
   *Note: This creates/updates `prisma/dev.db`.*

The hosted (Postgres) target has its own schema and migrations; see [HostedMaintenance.md](HostedMaintenance.md) before changing the data model. Every schema change must also follow the database change rules in [CONTRIBUTING.md](../../CONTRIBUTING.md).

## 3. Running the Server
```bash
npm run dev
```
The server typically starts on `http://localhost:3000`.

## 4. Checks
Run these before opening a pull request. CI runs the same set, and `main` only accepts changes through a pull request that passes them.
```bash
npm run typecheck          # tsc --noEmit
npm run lint               # eslint, zero warnings allowed
npm test                   # vitest, unit and integration tests
npm run depcruise          # import direction between layers
npm run db:upgrade-check   # only needed when prisma/schema.prisma changed
npm run build              # production build (regenerates the blog module first)
```

## 5. Discord Integration
To verify Discord features:
1. Create an Application in the Discord Developer Portal.
2. On its Bot tab, reset the token. Leave every privileged gateway intent off.
3. Add `http://localhost:3000/api/auth/discord/callback` as an OAuth2 redirect.
4. Add the credentials to `.env`.
5. Invite the bot to a test server with the "Connect Discord Server" button on an event's manage page.

## Troubleshooting
- **Database Error (Code 14):** ensure `DATABASE_URL` is correct. If using `file:./dev.db`, the file lives in the `prisma/` folder; run `npx prisma db push` to create it.
- **Prisma Client Error:** Run `npx prisma generate` after changing the schema.
- **Server exits at startup with a config error:** read the message. It names each variable that is missing or invalid.
