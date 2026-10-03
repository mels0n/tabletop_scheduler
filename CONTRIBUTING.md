# Contributing to TabletopTime

Thank you for your interest in improving TabletopTime! This project is a scheduling tool, hosted for the community and self-hostable, designed to make scheduling gaming sessions easier and less painful.

## Technology Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Database**: SQLite for self-host and local development, Postgres (Supabase) for the hosted version, both via Prisma ORM 5
- **Validation**: zod at every inbound boundary
- **Tooling**: ESLint 10 (flat config), Vitest, dependency-cruiser
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
   Copy the example environment file. `DATABASE_URL="file:./dev.db"` is all you need to start:
   ```bash
   cp .env.example .env
   ```

4. **Initialize Database**
   This creates the local SQLite file at `prisma/dev.db` from `prisma/schema.prisma`. The SQLite schema has no migration history, so do not use `prisma migrate dev` for it.
   ```bash
   npx prisma generate
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
- `features/`: Self-contained vertical slices by business domain: `auth/`, `event-management/`, `notifications/`, `telegram/`, `integrations/discord/`, `integrations/webhooks/`.
- `entities/`: Business nouns and their rules, shared by several features (sits between `features/` and `shared/`): `donation/`, `notification-preference/`, `participant/`.
- `shared/`: Core shared utilities (config, sessions, errors, schema generators, URL helpers, Prisma client, logger).
- `prisma/`: Database schemas. `prisma/schema.prisma` is SQLite; `prisma/hosted/` holds the Postgres schema and its migrations; `prisma/compat/` holds one SQLite schema snapshot per release.
- `scripts/`: build and maintenance scripts, including the data-migration runner (`run-data-migrations.mjs`) and its list (`data-migrations/index.mjs`).
- `content/blog/`: blog posts. `docs/`: guides, reference and ADRs.

Imports flow one way: `app` above `components` above `features` above `entities` above `shared`. Each layer may use the layers below it, and never the reverse. Use another feature slice through its `index.ts`, not its internal files. `npm run depcruise` checks these rules with dependency-cruiser; CI fails on an upward import, a cycle or an unresolvable import, so run it before opening a pull request.

## Key Workflows

### Database Changes
The schema exists twice, once per database target, and the two must describe the same models:

1. Edit **both** `prisma/schema.prisma` and `prisma/hosted/schema.prisma`.
2. Run `npx prisma db push` to apply the SQLite schema to your local database.
3. Add a hosted migration (see [HostedMaintenance.md](docs/guides/HostedMaintenance.md)): `npm run db:new:hosted <name>` writes it under `prisma/hosted/migrations/`. A migration that creates a table also needs its row level security statements (see below).
4. Commit the schema files and the migration together. `npm test` fails if the two schemas diverge, CI fails if the hosted migrations do not produce the hosted schema, and `npm run db:upgrade-check` fails if the SQLite change would not upgrade every past release.

Self-hosters get the SQLite schema through `prisma db push` at container start, so there is no SQLite migration folder to maintain.

### Database change rules
Self-hosted instances upgrade by pulling a newer image and restarting, from whatever release they were on. `start.sh` then applies `prisma/schema.prisma` with a plain `prisma db push` and runs pending data migrations, with no manual step. Every database change must therefore work automatically, from any earlier release to the current one.

- **Additive only (expand, then contract).** A release may add a nullable column, a column with a default, a new table or a new index. It never drops, renames or retypes a column or table. To rename or reshape, add the new column in one release, write to both and backfill, and drop the old one in a later release, only once no released code reads it.
- **Snapshot every release.** A release that changes `prisma/schema.prisma` adds a copy of it to `prisma/compat/` (see [prisma/compat/README.md](prisma/compat/README.md)).
- **Backfills are data migrations.** Rewriting existing rows (filling a new column from an old one, for example) goes in `scripts/data-migrations/index.mjs`, never in a manual step. Each entry runs once, in a transaction, on self-host start and on the hosted production build, and is recorded in the `AppMigration` table.
- **`npm run db:upgrade-check` is the gate.** It pushes the current schema onto a seeded database built from every snapshot, without `--accept-data-loss`, and checks the rows survive. CI runs it as the `selfhost-upgrade` job, and the Docker image is only published from a commit that passed it.
- **`PRISMA_ACCEPT_DATA_LOSS` is for recovery only.** It exists so an operator can repair a database that is already in a broken state. A release must never require it; if the upgrade check needs it to pass, the change is wrong.

### Telegram Bot Testing
Testing the bot locally is handled via **Long Polling**: run `npm run dev` with `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_BASE_URL=http://localhost:3000` and `TELEGRAM_MODE=polling`. The base URL is required whenever a bot token is set.

- **Polling (dev)**: the poller in `features/telegram/lib/telegram-service.ts` fetches updates and passes each one to the shared handler.
- **Webhook (prod)**: Telegram pushes updates to `app/api/telegram/webhook/route.ts`, which authenticates the request and passes the update to the same shared handler.

Command handling lives in one place, `features/telegram/server/update-handler.ts`. If you add a command or a deep-link handler, add it there and both transports pick it up. Do not add logic to the route or the poller.

## Pull Requests
- `main` is protected: every change lands through a pull request, and the CI checks must pass before it can merge.
- Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run depcruise` before submitting, and make sure `npx next build` passes. If you changed `prisma/schema.prisma`, also run `npm run db:upgrade-check`.
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
- **Warn**: Unexpected states that aren't fatal (e.g., "Invalid input", "Rejected webhook update: missing or invalid secret token").
- **Error**: Exceptions and failures that stop an operation.

Never log tokens, full URLs that contain a bot token, or personal data from webhook payloads.

## Configuration, validation and errors

- Read configuration through `shared/config/server.ts` (server) or `shared/config/public.ts` (browser), never `process.env` directly. A new variable goes into the schema there and into [EnvVariables.md](docs/reference/EnvVariables.md) and `.env.example`.
- Validate every request body, query and route parameter with a zod schema before use.
- Throw the typed errors from `shared/errors`; route handlers map them to a response with `toResponse`, which produces the `{ error, code }` body.
- Escape user text with `shared/lib/escape` before it goes into a Telegram or Discord message.

## Row level security (hosted)

Every new table in the hosted (Postgres) schema needs row level security statements in its migration: enable RLS and add the deny-all policy, following `prisma/hosted/migrations/20261003000200_enable_rls`. Prisma does not diff RLS, so the migration check will not catch a missing policy.

## Compatibility rule

A deploy must never invalidate an admin link, a stored participant id, or a live login or recovery token. Any change to how credentials are stored or checked keeps accepting the old form and upgrades it on first use. See [HostedMaintenance.md](docs/guides/HostedMaintenance.md#compatibility-rule) and [ADR 0002](docs/adr/0002-identity-and-sessions.md).
