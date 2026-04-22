# Coding Conventions

**Analysis Date:** 2026-04-22

## Naming Patterns

**Files:**
- React components: PascalCase — `VotingInterface.tsx`, `Navbar.tsx`, `FinalizedEventView.tsx`
- Server actions: camelCase module names — `actions.ts`, `magic-link.ts`, `recovery.ts`
- Utility/library files: kebab-case — `auth-cookie.ts`, `webhook-sender.ts`, `event-management`
- API routes: always named `route.ts` in Next.js App Router convention
- Test files: co-located or in `tests/`, named `{module}.test.ts`
- Mock files: placed in `__mocks__/` subdirectory adjacent to the module they mock

**Functions:**
- Exported functions: camelCase — `setAdminCookie`, `verifyEventAdmin`, `checkSlotQuorum`
- React components: PascalCase — `VotingInterface`, `Navbar`, `NavLink`
- Private helpers: camelCase — `generateSlug`, `sign`, `shouldLog`
- API handlers: HTTP verb names — `GET`, `POST`, `DELETE` (Next.js App Router convention)
- Event handlers in components: `handle` prefix — `handleVote`, `toggleHost`, `submitVotes`

**Variables:**
- camelCase throughout — `mockCookieStore`, `rawAdminToken`, `inferredTelegramHandle`
- Boolean state variables: `is`/`has` prefix — `isSubmitting`, `hasVoted`, `isActive`
- Log context instances: `log` — `const log = Logger.get("ContextName")`

**Types/Interfaces:**
- PascalCase — `LogLevel`, `QuorumResult`, `VisitedEvent`, `VotingInterfaceProps`
- `interface` preferred over `type` for object shapes
- Props interfaces named `{ComponentName}Props`
- `any` used pragmatically in spots still needing type hardening (acknowledged in comments)

**Environment Variables:**
- SCREAMING_SNAKE_CASE — `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`, `NODE_ENV`
- Public vars prefixed — `NEXT_PUBLIC_IS_HOSTED`

## Code Style

**Formatting:**
- No Prettier config detected — formatting relies on editor defaults and ESLint
- 4-space indentation in TypeScript files
- Single quotes for string literals in most files

**Linting:**
- ESLint with `next/core-web-vitals` preset — `/.eslintrc.json`
- TypeScript strict mode enabled — `"strict": true` in `tsconfig.json`
- `noEmit: true` — type-checking only, not for build output

## Import Organization

**Order (observed pattern):**
1. Framework/Next.js imports — `"next/server"`, `"next/headers"`, `"next/navigation"`
2. React imports — `"react"`
3. Third-party packages — `"date-fns"`, `"lucide-react"`, `"clsx"`
4. Internal `@/` path alias imports — `@/shared/lib/prisma`, `@/features/auth/...`
5. Relative imports — `"./ClientDate"`, `"./SuggestTime"`

**Path Aliases:**
- `@/*` maps to project root `./` — configured in both `tsconfig.json` and `vitest.config.ts`
- Use `@/shared/lib/...` for utilities, `@/features/.../...` for feature code, `@/components/...` for UI components

**Dynamic Imports:**
- Used for optional integrations to avoid loading when env vars not set:
  ```typescript
  if (process.env.TELEGRAM_BOT_TOKEN) {
      const { sendTelegramMessage } = await import("@/features/telegram");
  }
  ```

## Error Handling

**Server Actions Pattern:**
- Return discriminated union `{ error: string }` or `{ success: true }` — never throw to caller
- Auth check first, early return on failure:
  ```typescript
  if (!await verifyEventAdmin(slug)) return { error: "Unauthorized" };
  ```
- Wrap DB operations in try/catch, log with context logger, return `{ error: "..." }`:
  ```typescript
  try {
      await prisma.event.update({ ... });
      return { success: true };
  } catch (e) {
      log.error("Failed to update handle", e as Error);
      return { error: "Failed to update handle." };
  }
  ```

**API Route Handlers Pattern:**
- Wrap entire handler body in try/catch
- Return `NextResponse.json({ error: "..." }, { status: NNN })` on failure
- Return `NextResponse.json(data)` on success (200 implied)
- Log errors before returning:
  ```typescript
  } catch (error) {
      log.error("Failed to create event", error as Error);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
  ```

**Client Components:**
- `try/catch` around async fetch calls with `alert()` for user feedback (acknowledged as needing improvement in comments)
- `console.error(e)` in catch blocks for client-side errors

## Logging

**Framework:** Custom `Logger` class — `shared/lib/logger.ts`

**Usage Pattern:**
- Create named context instance at module top: `const log = Logger.get("EventActions")`
- Context names follow feature path: `"API:EventCreate"`, `"EventActions"`, `"WaitlistService"`
- Log levels: `debug` (detailed trace), `info` (normal operations), `warn` (deletions, soft failures), `error` (exceptions)
- Always cast errors: `log.error("message", e as Error)` — Logger accepts `Error | LogPayload`
- Include relevant identifiers in payload: `log.info("Event created", { slug, id })`

**Log Level Config:**
- Controlled by `LOG_LEVEL` env var (default: `info`)
- Levels: `debug < info < warn < error`

## Comments

**Intent Comments:**
- Inline `// Intent:` prefix used extensively to explain non-obvious decisions:
  ```typescript
  // Intent: Refresh cookies on every interaction to keep session alive indefinitely
  // Intent: Constant-time comparison to prevent timing attacks.
  ```
- `// Fix:` prefix marks workarounds or bug fixes
- `// Note:` prefix for important caveats or context
- `// Action:` prefix in complex flows to label what a block of code does

**JSDoc:**
- JSDoc `@function` / `@component` / `@interface` blocks used for all exported symbols
- `@param`, `@returns`, `@description` used consistently
- `@property` used in interface descriptions
- Example from `shared/lib/quorum.ts`:
  ```typescript
  /**
   * @function checkSlotQuorum
   * @description Analyzes a specific time slot to determine its viability.
   * @param {TimeSlotWithVotes} slot - The slot to analyze.
   * @param {number} minPlayers - Minimum required players.
   * @returns {QuorumResult} The calculated status.
   */
  ```

## Function Design

**Size:** Functions kept focused; complex flows decomposed with comments labeling logical sections

**Parameters:** Primitive types preferred — pass `slug: string` rather than full objects when only slug is needed

**Return Values:**
- Server actions return `{ error: string } | { success: true, ...extras }`
- Pure utilities return typed values — `boolean`, `string`, `QuorumResult`
- API routes always return `NextResponse`

## Module Design

**Exports:**
- Named exports preferred for utilities and components: `export function`, `export const`
- Default export used for class instances and Prisma client: `export default prisma`, `export default Logger`
- Feature barrel files re-export from submodules: `features/telegram/index.ts` re-exports from `lib/` and `model/`

**Barrel Files:**
- Used at feature boundaries — `features/telegram/index.ts`
- Not used within `shared/lib/` — each file imported directly

**"use server" / "use client" Directives:**
- `"use server"` at top of all Server Action files — required for Next.js
- `"use client"` at top of all interactive React components — `VotingInterface.tsx`, `Navbar.tsx`, hooks

## Prisma Usage

**Query Style:**
- Use `select` to limit fields when full object not needed (prefer over `include` for reads)
- Use `include` for relational data in page-level data fetches
- Transactions used for multi-table writes: `prisma.$transaction(async (tx) => { ... })`
- Guard against null: `event?.managerChatId` with optional chaining

**Singleton Pattern:**
- Single Prisma client instance in `shared/lib/prisma.ts`
- Imported everywhere as `import prisma from "@/shared/lib/prisma"`

---

*Convention analysis: 2026-04-22*
