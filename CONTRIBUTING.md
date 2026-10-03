# Contributing to TabletopTime

Thank you for your interest in improving TabletopTime! This project is a scheduling tool, hosted for the community and self-hostable, designed to make scheduling gaming sessions easier and less painful.

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite for self-host and local development, Postgres (Supabase) for the hosted version, both via Prisma ORM
- **Styling**: Tailwind CSS
- **Deployment**: Docker / Docker Compose (self-host), Vercel (hosted)

See [docs/adr](docs/adr) for why the stack and the two database targets look the way they do.

## Getting Started

### Prerequisites
- Node.js 22
- npm

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/mels0n/tabletop_scheduler.git
   cd tabletop_scheduler
   ```

2. **Install Dependencies**
   ```bash
   npm ci
   ```

3. **Environment Setup**
   Copy the example environment file (if available) or set minimal vars:
   ```bash
   # .env
   DATABASE_URL="file:./dev.db"
   ```

4. **Initialize Database**
   This creates the local SQLite file at `prisma/dev.db` from `prisma/schema.prisma`.
   ```bash
   npx prisma db push
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

- `app/`: Next.js App Router pages and API endpoints.
  - `app/api/`: Backend logic (endpoints).
  - `app/e/[slug]/`: The main event page (voting).
  - `app/e/[slug]/manage/`: The admin dashboard for a specific event.
- `components/`: Reusable React components.
- `features/`: Self-contained vertical slices by business domain, e.g., `telegram/`, `event-management/`, `notifications/`, `auth/`.
- `shared/`: Core shared utilities (config, sessions, errors, schema generators, URL helpers, Prisma client, logger).
- `prisma/`: Database schemas. `prisma/schema.prisma` is SQLite; `prisma/hosted/` holds the Postgres schema and its migrations.

Imports flow one way: `app` and `components` may use `features`, `features` may use `shared`, and never the reverse.

## Key Workflows

### Database Changes
The schema exists twice, once per database target, and the two must describe the same models:

1. Edit **both** `prisma/schema.prisma` and `prisma/hosted/schema.prisma`.
2. Run `npx prisma db push` to apply the SQLite schema to your local database.
3. Add a hosted migration (see [HostedMaintenance.md](docs/guides/HostedMaintenance.md)): `npm run db:new:hosted <name>` writes it under `prisma/hosted/migrations/`.
4. Commit the schema files and the migration together. `npm test` fails if the two schemas diverge.

Self-hosters get the SQLite schema through `prisma db push` at container start, so there is no SQLite migration folder to maintain.

### Telegram Bot Testing
Testing the bot locally is handled via **Long Polling**, which is enabled automatically when you run `npm run dev` with a `TELEGRAM_BOT_TOKEN` set and no `NEXT_PUBLIC_BASE_URL` (or with `TELEGRAM_MODE=polling`).

- **Polling (dev)**: the poller in `features/telegram/lib/telegram-service.ts` fetches updates and passes each one to the shared handler.
- **Webhook (prod)**: Telegram pushes updates to `app/api/telegram/webhook/route.ts`, which authenticates the request and passes the update to the same shared handler.

Command handling lives in one place, `features/telegram/server/update-handler.ts`. If you add a command or a deep-link handler, add it there and both transports pick it up. Do not add logic to the route or the poller.

## Pull Requests
- Run `npm run typecheck`, `npm run lint`, and `npm test` before submitting, and make sure `npx next build` passes.
- Keep PRs focused on a single feature or fix.
- Add "Why" comments for complex business logic.

## Logging

We use a centralized structured logger instead of `console.log`. It writes one JSON object per line, and its level comes from `LOG_LEVEL`.

### Usage
Import the Logger and create a named instance for your file/component:

```typescript
import Logger from "@/shared/lib/logger";

const log = Logger.get("MyComponent");

log.info("Something happened", { userId: 123 });
log.error("Something failed", error);
```

### Log Levels
- **Debug**: Detailed info for troubleshooting (e.g., payload contents, exact logic flow).
- **Info**: General application lifecycle events (e.g., "Event Created", "Cron Started").
- **Warn**: Unexpected states that aren't fatal (e.g., "Invalid input", "Manager Handle mismatched").
- **Error**: Exceptions and failures that stop an operation.

Never log tokens, full URLs that contain a bot token, or personal data from webhook payloads.

Every new table in the hosted (Postgres) schema needs row level security statements in its migration: enable RLS and add the deny-all policy, following `prisma/hosted/migrations/20261003000200_enable_rls`. Prisma does not diff RLS, so the migration check will not catch a missing policy.
