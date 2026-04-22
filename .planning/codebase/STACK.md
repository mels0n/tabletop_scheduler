# Technology Stack

**Analysis Date:** 2026-04-22

## Languages

**Primary:**
- TypeScript 5.x - All application code: frontend components, API routes, server actions, shared libraries
- CSS (Tailwind) - All styling via utility classes

**Secondary:**
- JavaScript - `scripts/db-backup.mjs`, `scripts/db-restore.mjs`, `list_events.js` (utility scripts only)
- Shell Script (`start.sh`) - Docker container entrypoint/cron orchestration

## Runtime

**Environment:**
- Node.js >=20 (enforced via `package.json` `engines` field)
- Edge runtime: Not used — middleware uses Node.js-compatible APIs; `process.env.NEXT_RUNTIME === 'nodejs'` check in `instrumentation.ts`

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 14.2.3 — Full-stack React framework; App Router; Server Components; API Routes; ISR via `revalidatePath`
- React 18.x — UI rendering

**Styling:**
- Tailwind CSS 3.4.x — Utility-first CSS; config at `tailwind.config.ts`
- `@tailwindcss/typography` 0.5.x — Rich text prose styling for markdown content
- `tailwind-merge` 3.4.x — Conditional class merging utility

**Testing:**
- Vitest 4.x — Test runner; config at `vitest.config.ts`
- `@testing-library/react` 16.x — Component testing
- `jsdom` 27.x — Browser DOM simulation in tests
- `@vitejs/plugin-react` 5.x — Vitest React plugin

**Build/Dev:**
- PostCSS 8.x — CSS processing for Tailwind; config at `postcss.config.mjs`
- ESLint 8.x — Linting; config at `.eslintrc.json` (extends `next/core-web-vitals`)
- TypeScript compiler — Strict mode enabled; `tsconfig.json`

## Key Dependencies

**Critical:**
- `@prisma/client` 5.22.x — ORM and database client; singleton pattern at `shared/lib/prisma.ts`
- `prisma` 5.22.x (dev) — Schema management, migrations, code generation
- `next` 14.2.3 — Framework core; server/client boundary management
- `uuid` 13.x — UUID generation for admin tokens, login tokens, webhook event IDs
- `date-fns` 4.x — Date formatting and manipulation (ICS generation, event scheduling)

**UI:**
- `lucide-react` 0.556.x — Icon library
- `react-markdown` 10.x + `remark-gfm` 4.x — Markdown rendering for blog/content pages
- `clsx` 2.x — Conditional className utility
- `gray-matter` 4.x — Markdown frontmatter parsing for blog content

**Schema/SEO:**
- `schema-dts` 1.x — TypeScript types for Schema.org JSON-LD structured data; used in `shared/lib/aeo.ts`

## Configuration

**Environment:**
- `.env` — Local environment (not committed); see `.env.example` for required vars
- Required vars: `DATABASE_URL`, `DISCORD_APP_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_BASE_URL`, `CRON_SECRET`, `KOFI_VERIFICATION_TOKEN`
- Optional vars: `TELEGRAM_BOT_USERNAME`, `LOG_LEVEL`, `CLEANUP_RETENTION_DAYS_*`, `TZ`
- `NEXT_PUBLIC_IS_HOSTED` — Toggles hosted vs self-hosted mode (SEO, ads, telemetry)
- `IS_DOCKER_BUILD` — Switches Next.js output to `standalone` mode; set only via Dockerfile

**Build:**
- `next.config.mjs` — Standalone output for Docker (`IS_DOCKER_BUILD=true`); `instrumentationHook` experiment enabled
- `tsconfig.json` — Strict mode; path alias `@/*` maps to project root
- `vercel.json` — Vercel Cron: daily cleanup at `0 0 * * *` via `/api/cron/cleanup`
- `tailwind.config.ts` — Scans `pages/`, `components/`, `app/` directories

**Dual Schema Strategy:**
- `prisma/schema.prisma` — Self-hosted (SQLite); used for Docker builds and local dev
- `prisma/schema.hosted.prisma` — Hosted/production (PostgreSQL); used via `build:hosted` and `db:deploy:hosted` scripts

## Platform Requirements

**Development:**
- Node.js >=20
- Windows + Docker Desktop (binary targets include `linux-musl-openssl-3.0.x` and `native` for cross-platform Prisma)
- SQLite database at `prisma/dev.db` (auto-created)

**Production:**
- **Hosted (Vercel):** PostgreSQL database; `build:hosted` script; Vercel Cron for scheduled tasks
- **Self-Hosted (Docker):** Alpine Linux container; SQLite database at `/app/data/scheduler.db`; `start.sh` runs migrations + internal cron loops; image exposed on port 3000

---

*Stack analysis: 2026-04-22*
