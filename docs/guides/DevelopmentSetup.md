# Development Setup Guide

## Prerequisites
- Node.js 18+
- npm
- Git

## 1. Environment Configuration
The application requires specific environment variables to function. These are stored in a `.env` file in the project root.

**IMPORTANT:** The `.env` file is gitignored for security. Do NOT commit it.

### Setup Steps:
1. Copy the example file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in the required values.

### Variable Reference:
- `DATABASE_URL`: Connection string for the local SQLite database. 
  - Recommended: `"file:./dev.db"` (Points to `prisma/dev.db`)
- `TZ`: Timezone for the server (e.g., `America/New_York`).
- `NEXT_PUBLIC_BASE_URL`: The URL where the app is running (e.g., `http://localhost:3000`).
- `DISCORD_APP_ID`: Application ID from Discord Developer Portal.
- `DISCORD_CLIENT_SECRET`: Client Secret from Discord Developer Portal.
- `DISCORD_BOT_TOKEN`: Bot Token from Discord Developer Portal.

## 2. Database Setup
The project uses Prisma with SQLite.

1. **Generate Client:**
   ```bash
   npx prisma generate
   ```
2. **Migration (Reset & Apply):**
   ```bash
   npx prisma migrate dev --name init
   ```
   *Note: This creates/updates `prisma/dev.db`.*

3. **Seeding (Optional):**
   If you have a seed script (check package.json), run:
   ```bash
   npx prisma db seed
   ```

## 3. Running the Server
```bash
npm run dev
```
The server typically starts on `http://localhost:3000`.

## 4. Discord Integration
To verify Discord features:
1. Create a generic Application in Discord Developer Portal.
2. Create a generic Bot and reset its token.
3. Add the credentials to `.env`.
4. Invite the bot to a test server using the OAuth link generated in the app's "Manage" page.

## Troubleshooting
- **Database Error (Code 14):** ensure `DATABASE_URL` is correct. If using `file:./dev.db`, ensure the file exists in the `prisma/` folder.
- **Prisma Client Error:** Run `npx prisma generate` after changing `.env` or schema.
