# Codebase Structure

**Analysis Date:** 2026-04-22

## Directory Layout

```
tabletop_scheduler/
├── app/                    # Next.js App Router — pages, layouts, API routes
│   ├── api/                # HTTP API endpoints (REST + webhooks + cron)
│   │   ├── auth/           # Discord OAuth callback, session clear
│   │   ├── cron/           # Scheduled triggers (reminders, cleanup, webhooks)
│   │   ├── event/          # Core event CRUD and sub-resources
│   │   ├── kofi/           # Ko-fi donation webhook
│   │   └── telegram/       # Telegram webhook + bot setup
│   ├── e/[slug]/           # Public event pages
│   │   └── manage/         # Event manager dashboard
│   ├── auth/               # Login redirect route
│   ├── blog/               # Blog index and post pages
│   ├── guide/              # Help/guide pages
│   ├── new/                # Event creation wizard
│   ├── profile/            # User profile / event history
│   ├── layout.tsx          # Root layout (Navbar, Footer, fonts, SEO)
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Global Tailwind base styles
│   └── actions.ts          # DEPRECATED — stub only, see features/
├── components/             # Reusable React UI components
├── features/               # Feature-sliced domain modules
│   ├── auth/               # Cookie auth, magic links, recovery tokens
│   │   ├── model/          # Token logic (generate/verify HMAC)
│   │   ├── server/         # Server Actions (setAdminCookie, verifyEventAdmin, sendGlobalMagicLink)
│   │   └── ui/             # ManagerRecovery client component
│   ├── discord/            # Discord bot integration
│   │   ├── model/          # Discord API client (send/edit/pin messages)
│   │   ├── server/         # Discord Server Actions
│   │   └── ui/             # DiscordConnect, DiscordLoginSender components
│   ├── event-management/   # Event lifecycle operations
│   │   └── server/         # actions.ts (cancel/delete/reminder), recovery.ts, waitlist.ts
│   ├── integrations/       # Integration-specific server actions
│   │   └── discord/server/ # Discord-specific event integration actions
│   └── telegram/           # Telegram bot integration
│       ├── index.ts        # Public barrel exports
│       ├── lib/            # telegram-client.ts (API calls), telegram-service.ts (polling/reminders)
│       └── model/          # TypeScript types for Telegram updates
├── shared/                 # Cross-feature utilities (no upward imports)
│   └── lib/
│       ├── prisma.ts       # Singleton Prisma client
│       ├── logger.ts       # Structured logger class
│       ├── auth-cookie.ts  # Cookie config constants
│       ├── token.ts        # hashToken() utility
│       ├── quorum.ts       # checkSlotQuorum / checkEventQuorum
│       ├── webhook-sender.ts # HTTP webhook delivery with retry
│       ├── eventMessage.ts # Telegram/Discord finalized message builder
│       ├── status.ts       # Voting status message generator
│       ├── url.ts          # getBaseUrl() helper
│       ├── calendar.ts     # Google/Outlook calendar URL builders
│       ├── blog.ts         # MDX blog content loader
│       ├── aeo.ts          # AEO/structured data helpers
│       ├── fetch.ts        # reliableFetch wrapper
│       └── __mocks__/      # Prisma mock for Vitest
├── hooks/                  # React hooks (client-side only)
│   └── useEventHistory.ts  # localStorage event history tracker
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma       # SQLite schema (dev/self-hosted)
│   ├── schema.hosted.prisma # Hosted production schema variant
│   └── migrations/         # Prisma migration SQL files
├── content/                # Static content (blog posts as MDX or similar)
├── docs/                   # Developer documentation
├── scripts/                # Utility scripts
├── tests/                  # Integration/safety tests (Vitest)
│   └── auth-safety.test.ts
├── public/                 # Static assets
├── tmp/                    # Temporary files (not committed)
├── middleware.ts           # Edge middleware (session sliding, route guard)
├── instrumentation.ts      # Server startup hook (Telegram bot init)
├── next.config.mjs         # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration (@/* alias → root)
├── vitest.config.ts        # Vitest test runner configuration
├── vitest.setup.ts         # Vitest global setup
├── package.json            # Dependencies and scripts
├── Dockerfile              # Docker container definition
├── docker-compose.yml      # Local Docker Compose setup
└── vercel.json             # Vercel deployment configuration
```

## Directory Purposes

**`app/`:**
- Purpose: All Next.js App Router routes — pages, layouts, and API handlers
- Contains: Server Components (`.tsx` files without `"use client"`), API route handlers (`route.ts`), co-located page-specific Client Components (e.g., `FinalizeEventModal.tsx`, `EditLocationModal.tsx`)
- Key files: `app/layout.tsx`, `app/page.tsx`, `app/new/page.tsx`, `app/e/[slug]/page.tsx`, `app/e/[slug]/manage/page.tsx`

**`app/api/`:**
- Purpose: REST-style API routes consumed by the frontend, bots, cron jobs, and external systems
- Contains: One `route.ts` per endpoint following Next.js file-system routing
- Key files: `app/api/event/route.ts` (create), `app/api/event/[slug]/vote/route.ts`, `app/api/event/[slug]/finalize/route.ts`, `app/api/telegram/webhook/route.ts`, `app/api/cron/reminders/route.ts`

**`components/`:**
- Purpose: Shared React UI components used across multiple pages
- Contains: Mostly Client Components (`"use client"`) for interactive UI
- Key files: `VotingInterface.tsx`, `FinalizedEventView.tsx`, `ManageSlots.tsx`, `ManageParticipants.tsx`, `ManagerControls.tsx`, `TimeSlotPicker.tsx`, `TelegramConnect.tsx`, `Navbar.tsx`, `Footer.tsx`, `DonationTicker.tsx`
- Note: `components/components/` subdirectory contains duplicate files (FAQItem, FaqJsonLd) — likely a structural artifact

**`features/`:**
- Purpose: Self-contained vertical slices — each feature manages its own model types, server logic, and UI components
- Contains: Subdirectories organized as `model/`, `server/`, `ui/` within each feature
- Convention: `server/actions.ts` uses `"use server"` directive for Server Actions; `ui/` contains Client Components

**`shared/lib/`:**
- Purpose: Pure utilities and singletons with no feature dependencies — safe to import from anywhere
- Contains: DB client, logger, auth helpers, domain utilities
- Rule: Never import from `features/`, `app/`, or `components/` — only external packages and each other

**`hooks/`:**
- Purpose: React hooks for client-side browser logic
- Contains: `useEventHistory.ts` (reads/writes `localStorage` to track recently viewed events)

**`prisma/`:**
- Purpose: Database schema definition and migration history
- Key files: `prisma/schema.prisma` (canonical development schema), `prisma/schema.hosted.prisma` (production variant)
- Generated: `prisma/dev.db` (SQLite dev database — not committed)

**`tests/`:**
- Purpose: Vitest integration/safety tests separate from source files
- Key files: `tests/auth-safety.test.ts`

**`content/`:**
- Purpose: Static blog and documentation content files
- Generated: No
- Committed: Yes

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root HTML shell, global providers
- `app/page.tsx`: Landing page (home)
- `app/new/page.tsx`: Event creation wizard
- `app/e/[slug]/page.tsx`: Public event voting page
- `app/e/[slug]/manage/page.tsx`: Manager dashboard
- `app/profile/page.tsx`: User profile / event history

**Configuration:**
- `middleware.ts`: Edge session management and route protection
- `instrumentation.ts`: Server startup hook for Telegram bot
- `next.config.mjs`: Next.js build config
- `tailwind.config.ts`: Tailwind CSS config
- `tsconfig.json`: TypeScript paths (`@/*` maps to project root)
- `prisma/schema.prisma`: Database schema
- `vercel.json`: Vercel cron job definitions

**Core Logic:**
- `shared/lib/prisma.ts`: Singleton Prisma client (import this everywhere DB access is needed)
- `shared/lib/logger.ts`: Structured logger
- `shared/lib/quorum.ts`: Quorum calculation (viable/perfect)
- `shared/lib/webhook-sender.ts`: Outbound webhook delivery
- `features/auth/server/actions.ts`: `verifyEventAdmin()` — used in every protected route
- `app/api/event/[slug]/slot/notify.ts`: `syncDashboard()` and `pushSlotUpdates()` — called after any event state change

**Testing:**
- `vitest.config.ts`: Test runner config
- `vitest.setup.ts`: Global test setup
- `tests/auth-safety.test.ts`: Auth integration tests
- `features/event-management/server/actions.test.ts`: Event management unit tests
- `shared/lib/__mocks__/prisma.ts`: Prisma mock for unit tests

## Naming Conventions

**Files:**
- Pages: `page.tsx` (App Router convention)
- API handlers: `route.ts` (App Router convention)
- Server Actions: `actions.ts` inside `features/<feature>/server/`
- Client Components: PascalCase `.tsx` (e.g., `VotingInterface.tsx`, `ManagerControls.tsx`)
- Server utilities: camelCase `.ts` (e.g., `webhook-sender.ts`, `auth-cookie.ts`, `telegram-client.ts`)
- Test files: `*.test.ts` co-located or in `tests/`

**Directories:**
- Feature directories: kebab-case (e.g., `event-management/`, `telegram/`)
- Feature sub-layers: `model/`, `server/`, `ui/` (FSD pattern)
- API routes: match URL path segments using Next.js file convention

## Where to Add New Code

**New API endpoint:**
- Implementation: `app/api/<resource>/route.ts`
- Add auth check at the top using `verifyEventAdmin()` from `features/auth/server/actions.ts`
- Use `Logger.get("API:<Name>")` for logging
- Import Prisma from `shared/lib/prisma.ts`

**New Server Action:**
- Implementation: `features/<feature>/server/actions.ts` (add to existing file or create new)
- Add `"use server"` at file top
- Return `{ success: true }` or `{ error: string }` — no thrown exceptions

**New UI Component:**
- Shared/reusable: `components/<ComponentName>.tsx`
- Feature-specific: `features/<feature>/ui/<ComponentName>.tsx`
- Add `"use client"` at top if it uses hooks, event handlers, or browser APIs

**New feature domain:**
- Create `features/<feature-name>/` with `model/`, `server/`, and `ui/` subdirectories as needed
- Export from `features/<feature-name>/index.ts` if used as a barrel

**New shared utility:**
- Implementation: `shared/lib/<util-name>.ts`
- Must not import from `features/`, `app/`, or `components/`

**New database model:**
- Add to `prisma/schema.prisma`
- Run `npx prisma migrate dev --name <description>` to generate migration
- Migration files land in `prisma/migrations/`

**New page route:**
- Implementation: `app/<route-name>/page.tsx` (Server Component by default)
- Add `"use client"` only if the entire page needs browser interactivity (prefer extracting sub-components instead)

## Special Directories

**`.planning/`:**
- Purpose: GSD agent planning artifacts, codebase maps, and phase documentation
- Generated: No (hand-maintained by agents)
- Committed: Yes

**`.agent/`:**
- Purpose: GSD agent skills, rules, and workflow definitions
- Generated: No
- Committed: Yes

**`.next/`:**
- Purpose: Next.js build output cache
- Generated: Yes
- Committed: No

**`prisma/migrations/`:**
- Purpose: Sequential migration SQL files tracking all schema changes
- Generated: Yes (via `prisma migrate dev`)
- Committed: Yes

**`tmp/`:**
- Purpose: Temporary scratch files
- Generated: Ad hoc
- Committed: No

---

*Structure analysis: 2026-04-22*
