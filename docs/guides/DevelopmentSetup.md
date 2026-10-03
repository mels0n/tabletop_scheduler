# Development Setup Guide

## Prerequisites
- Node.js 22 (the repo pins it in `.nvmrc`; Node 20.9 is the minimum Next.js supports)
- npm
- Git

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
- `NEXT_PUBLIC_BASE_URL`: The URL where the app is running (e.g., `http://localhost:3000`). Required if you set any bot token, except for Telegram polling.
- `DISCORD_APP_ID`: Application ID from Discord Developer Portal.
- `DISCORD_CLIENT_SECRET`: Client Secret from Discord Developer Portal.
- `DISCORD_BOT_TOKEN`: Bot Token from Discord Developer Portal.

The full list, with defaults, is in [EnvVariables.md](../reference/EnvVariables.md). Configuration is validated at boot, so a missing or invalid value stops `npm run dev` with a message that lists every problem.

## 2. Database Setup
The project uses Prisma with SQLite for local development and self-hosting. The SQLite schema has no migration history; `db push` makes the database match the schema file.

1. **Generate Client:**
   ```bash
   npx prisma generate
   ```
2. **Create or update the database:**
   ```bash
   npx prisma db push
   ```
   *Note: This creates/updates `prisma/dev.db`.*

The hosted (Postgres) target has its own schema and migrations; see [HostedMaintenance.md](HostedMaintenance.md) before changing the data model.

## 3. Running the Server
```bash
npm run dev
```
The server typically starts on `http://localhost:3000`.

## 4. Checks
Run these before opening a pull request:
```bash
npm run typecheck
npm run lint
npm test
```

## 5. Discord Integration
To verify Discord features:
1. Create a generic Application in Discord Developer Portal.
2. Create a generic Bot and reset its token.
3. Add the credentials to `.env`.
4. Invite the bot to a test server using the OAuth link generated in the app's "Manage" page.

## Troubleshooting
- **Database Error (Code 14):** ensure `DATABASE_URL` is correct. If using `file:./dev.db`, the file lives in the `prisma/` folder; run `npx prisma db push` to create it.
- **Prisma Client Error:** Run `npx prisma generate` after changing the schema.
- **Server exits at startup with a config error:** read the message. It names each variable that is missing or invalid.
