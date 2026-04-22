# Architecture

**Analysis Date:** 2026-04-22

## Pattern Overview

**Overall:** Next.js App Router with Feature-Sliced Design

**Key Characteristics:**
- Server Components fetch data directly from Prisma — no intermediate API layer for page rendering
- Client Components are isolated to interactive UI only (`"use client"` at file top)
- Server Actions (`"use server"`) handle mutations; API routes handle external integrations and webhooks
- Feature modules under `features/` own their model, server logic, and UI; `shared/lib/` provides cross-cutting utilities
- Cookie-based identity (no accounts): event admins identified by `tabletop_admin_<slug>` cookie, users by `tabletop_user_chat_id` or `tabletop_user_discord_id`

## Layers

**Pages (App Router):**
- Purpose: Route entry points; Server Components that fetch data and render UI
- Location: `app/`
- Contains: `page.tsx` (Server Components), `layout.tsx`, `error.tsx`, route groups
- Depends on: `shared/lib/prisma`, `features/*/server/actions`, `components/`
- Used by: Next.js router

**API Routes:**
- Purpose: External-facing HTTP endpoints for mutations, webhooks, OAuth callbacks, and cron triggers
- Location: `app/api/`
- Contains: `route.ts` files using `NextResponse`
- Depends on: `shared/lib/prisma`, `features/*/model`, `features/*/server`
- Used by: Frontend clients, Telegram/Discord bots, cron schedulers, external webhook senders

**Features:**
- Purpose: Vertical slices of domain logic — each feature owns its model, server actions, and UI components
- Location: `features/`
- Contains: `auth/`, `discord/`, `event-management/`, `integrations/`, `telegram/`
- Depends on: `shared/lib/`
- Used by: `app/` pages and API routes

**Shared Library:**
- Purpose: Cross-feature utilities with no upward dependencies
- Location: `shared/lib/`
- Contains: `prisma.ts` (DB singleton), `logger.ts`, `auth-cookie.ts`, `quorum.ts`, `webhook-sender.ts`, `token.ts`, `url.ts`, `calendar.ts`, `eventMessage.ts`, `status.ts`, `blog.ts`, `aeo.ts`, `fetch.ts`
- Depends on: Nothing project-internal
- Used by: All layers

**Components:**
- Purpose: Reusable React UI components (mostly Client Components)
- Location: `components/`
- Contains: `VotingInterface.tsx`, `FinalizedEventView.tsx`, `ManageSlots.tsx`, `ManageParticipants.tsx`, `ManagerControls.tsx`, `TimeSlotPicker.tsx`, etc.
- Depends on: `shared/lib/`, `features/*/server/actions`
- Used by: `app/` pages

**Middleware:**
- Purpose: Edge-layer session sliding and route protection
- Location: `middleware.ts`
- Contains: Cookie refresh logic (400-day sliding sessions), `/manage` route guard
- Depends on: Nothing (no imports — cookie logic inlined for Edge compatibility)

**Database:**
- Purpose: SQLite (dev) / PostgreSQL-compatible via Prisma ORM
- Location: `prisma/schema.prisma`, `prisma/schema.hosted.prisma`
- Contains: `Event`, `TimeSlot`, `Participant`, `Vote`, `LoginToken`, `WebhookEvent`, `Donation` models

## Data Flow

**Event Creation:**
1. User fills `app/new/page.tsx` (Client Component)
2. Client POSTs to `app/api/event/route.ts`
3. API generates slug, hashes admin token, creates `Event` + `TimeSlots` in a Prisma transaction
4. If `fromUrl` webhook is configured, `WebhookEvent` row is created and `processWebhook()` fires immediately
5. API returns `{ slug, adminToken }` (raw token, never stored again)
6. Client calls Server Action `setAdminCookie()` to store token in HttpOnly cookie
7. Client redirects to `/e/[slug]/manage`

**Voting Flow:**
1. `app/e/[slug]/page.tsx` (Server Component) fetches event + slots + participants directly from Prisma
2. Server identifies user via `tabletop_user_chat_id` / `tabletop_user_discord_id` cookies
3. Renders `VotingInterface` (Client Component) with pre-computed vote counts
4. User submits vote → `POST /api/event/[slug]/vote`
5. API upserts Participant record, deletes old votes, inserts new votes (transactional)
6. Post-transaction: calls `syncDashboard()` to update pinned Telegram/Discord messages
7. Checks quorum thresholds; if reached for first time, sends private DM to manager

**Event Finalization:**
1. Manager at `/e/[slug]/manage` submits finalize form → `POST /api/event/[slug]/finalize`
2. API verifies admin via `verifyEventAdmin()` (cookie hash check + identity fallback)
3. Updates `Event` status to `FINALIZED`, sets `finalizedSlotId` and `finalizedHostId`
4. Deletes old pinned Telegram message, sends new finalized message, pins it
5. Sends Discord finalized embed
6. Queues `FINALIZED` `WebhookEvent` if `fromUrl` is set

**Bot Connectivity:**
- Production (BASE_URL set): `instrumentation.ts` calls `ensureWebhook()` on server start; Telegram pushes updates to `POST /api/telegram/webhook`
- Development (no BASE_URL): `instrumentation.ts` starts long-polling loop via `features/telegram/lib/telegram-service.ts`

**State Management:**
- No client-side global state store (no Redux/Zustand)
- Server Components pass data as props to Client Components
- Client Components use `useState` + `fetch()` for local interactivity
- Browser `localStorage` used in `hooks/useEventHistory.ts` to track recently viewed events

## Key Abstractions

**verifyEventAdmin:**
- Purpose: Two-path admin check — cookie token hash vs. global identity (Telegram/Discord)
- Examples: `features/auth/server/actions.ts`
- Pattern: Called at the top of every protected API route and Server Action

**checkSlotQuorum / checkEventQuorum:**
- Purpose: Pure functions determining if a time slot has enough YES+MAYBE votes, and if all participants voted YES with a host
- Examples: `shared/lib/quorum.ts`
- Pattern: Called after every vote submission and in cron reminders

**syncDashboard:**
- Purpose: Rebuilds and pushes the pinned status message to both Telegram and Discord after any state change
- Examples: `app/api/event/[slug]/slot/notify.ts`
- Pattern: Called post-vote, post-slot-change; generates message via `shared/lib/status.ts` or `shared/lib/eventMessage.ts`

**processWebhook:**
- Purpose: Delivers a queued `WebhookEvent` row via HTTP POST with retry logic (5-min retry, 1-hour TTL)
- Examples: `shared/lib/webhook-sender.ts`
- Pattern: Called synchronously after event creation/finalization; also triggered by `app/api/cron/webhooks/route.ts`

**Logger:**
- Purpose: Context-aware structured logger with level filtering via `LOG_LEVEL` env var
- Examples: `shared/lib/logger.ts`
- Pattern: `const log = Logger.get("ContextName")` at module top; used throughout API routes and server actions

## Entry Points

**Root Layout:**
- Location: `app/layout.tsx`
- Triggers: All page renders
- Responsibilities: Inter font, Navbar/Footer injection, conditional SEO metadata and JSON-LD schema for hosted mode

**Home Page:**
- Location: `app/page.tsx`
- Triggers: GET `/`
- Responsibilities: Landing page; links to event creation

**Event Creation:**
- Location: `app/new/page.tsx`
- Triggers: User navigates to `/new`
- Responsibilities: Client-side form for title, slots, player count; calls `POST /api/event`

**Public Event View:**
- Location: `app/e/[slug]/page.tsx`
- Triggers: User opens shared event link
- Responsibilities: Server-fetches event, identifies user via cookies, routes to `VotingInterface` / `FinalizedEventView` / cancelled card

**Manager Dashboard:**
- Location: `app/e/[slug]/manage/page.tsx`
- Triggers: Organizer navigates to `/e/[slug]/manage`
- Responsibilities: Verifies admin, shows slot ranking, finalize controls, Telegram/Discord connect, reminder settings

**Telegram Webhook Handler:**
- Location: `app/api/telegram/webhook/route.ts`
- Triggers: Telegram platform POST on message receipt
- Responsibilities: Command parsing (`/start`, `/connect`), passive identity linking, magic link callbacks, global login

**Server Instrumentation:**
- Location: `instrumentation.ts`
- Triggers: Server process start (Next.js `register()` hook)
- Responsibilities: Configures Telegram as webhook (prod) or long-polling (dev)

## Error Handling

**Strategy:** Return `{ error: string }` from API routes with appropriate HTTP status codes; log with `Logger` before returning.

**Patterns:**
- API routes wrap handlers in `try/catch`; return `NextResponse.json({ error: "..." }, { status: 5xx })` on failure
- Server Actions return `{ error: string }` on failure, `{ success: true }` on success — no thrown exceptions to clients
- Instrumentation errors are swallowed (`try/catch` with console.error) to prevent boot crash
- Telegram/Discord notification failures do not fail the primary operation (fire-and-forget pattern after core DB write)

## Cross-Cutting Concerns

**Logging:** `Logger` class from `shared/lib/logger.ts`. Named instances per module (`Logger.get("ModuleName")`). Level controlled by `LOG_LEVEL` env var (`debug` | `info` | `warn` | `error`). Outputs structured timestamped strings to `console.*`.

**Validation:** Inline in API route handlers (check required fields, array length, format regexes). No schema validation library (e.g., Zod) used.

**Authentication:**
- Event admin: `tabletop_admin_<slug>` cookie containing raw token; server hashes and compares to DB (`hashToken` from `shared/lib/token.ts`)
- Global identity: `tabletop_user_chat_id` (Telegram) or `tabletop_user_discord_id` (Discord) cookies — set after bot interaction or OAuth
- Magic Links: Time-bound HMAC tokens (`features/auth/model/token.ts`) for recovery
- Middleware provides first-layer route guard; `verifyEventAdmin()` provides second-layer DB-verified check

**Hosted vs. Self-Hosted Mode:** `NEXT_PUBLIC_IS_HOSTED=true` env var gates SEO metadata, JSON-LD schema, robots indexing, and Donation Ticker display. Two Prisma schemas exist: `prisma/schema.prisma` (SQLite for dev/self-hosted) and `prisma/schema.hosted.prisma`.

---

*Architecture analysis: 2026-04-22*
