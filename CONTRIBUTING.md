# Contributing to TabletopTime

Thank you for your interest in improving TabletopTime! This project is a self-hosted tool designed to make scheduling gaming sessions easier/less painful.

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: SQLite (via Prisma ORM)
- **Styling**: Tailwind CSS
- **Deployment**: Docker / Docker Compose

## Getting Started

### Prerequisites
- Node.js 20+
- npm

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/mels0n/tabletop_scheduler.git
   cd tabletop_scheduler
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Initialize Database**
   This will create the local SQLite file at `prisma/dev.db`.
   ```bash
   npx prisma migrate dev
   ```

4. **Environment Setup**
   Copy the example environment file (if available) or set minimal vars:
   ```bash
   # .env
   DATABASE_URL="file:./dev.db"
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
- `features/`: Self-contained vertical slices by business domain (VSA), e.g., `telegram/`, `discord/`, `event-management/`.
- `shared/`: Core shared utilities (schema generators, URL helpers, Prisma client, logger).
- `prisma/`: Database schema and migrations.

## Key Workflows

### Database Changes
If you modify `prisma/schema.prisma`:
1. Run `npx prisma migrate dev --name <descriptive_name>` to generate a migration.
2. Commit the new `migrations/` folder.

### Telegram Bot Testing
Testing the bot locally is handled via **Long Polling**, which is enabled automatically when you run `npm run dev` if a `TELEGRAM_BOT_TOKEN` is present.

- **Standard (Polling)**: Just run the app (`npm run dev`). Logic is handled in `lib/telegram-poller.ts`. This file implements the "long poll" loop to fetch updates manually.
- **Production (Webhooks)**: The live site uses the standard Next.js API route at `app/api/telegram/webhook/route.ts`. Telegram pushes updates here automatically.

> [!IMPORTANT]
> Because these are two separate entry points, **any logic changes to bot command handling must be applied to BOTH files**:
> 1. `app/api/telegram/webhook/route.ts` (Webhook / Prod)
> 2. `lib/telegram-poller.ts` (Polling / Dev)
>
> If you add a new command like `/connect` or a new deep-link handler, ensure you copy the implementation or shared logic to both locations.

## Pull Requests
- Please ensure `npm run build` passes before submitting.
- Keep PRs focused on a single feature or fix.
- Add "Why" comments for complex business logic.

## Logging

We use a centralized structured logger instead of `console.log`.

### Usage
Import the Logger and create a named instance for your file/component:

```typescript
import Logger from "@/lib/logger";

const log = Logger.get("MyComponent");

log.info("Something happened", { userId: 123 });
log.error("Something failed", error);
```

### Log Levels
- **Debug**: Detailed info for troubleshooting (e.g., payload contents, exact logic flow).
- **Info**: General application lifecycle events (e.g., "Event Created", "Cron Started").
- **Warn**: Unexpected states that aren't fatal (e.g., "Invalid input", "Manager Handle mismatched").
- **Error**: Exceptions and failures that stop an operation.
