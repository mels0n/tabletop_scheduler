# Codebase Concerns

**Analysis Date:** 2026-04-22

---

## Tech Debt

**Vote API uses numeric ID in a slug-keyed route:**
- Issue: The route `/api/event/[slug]/vote` is named with `[slug]` but the frontend passes `event.id` (a numeric integer). The route handler explicitly calls `parseInt(params.slug)` to recover the numeric ID. A comment in the code acknowledges this as a legacy inconsistency.
- Files: `app/api/event/[slug]/vote/route.ts` (line 38), `components/VotingInterface.tsx` (line 177), `components/FinalizedEventView.tsx` (lines 143, 360)
- Impact: Confusing API contract. Any consumer (external developer, new API client) reading the route name would expect a slug string, not an integer. Makes the webhook/integration surface misleading.
- Fix approach: Add a secondary `findUnique({ where: { id: eventId } })` lookup or migrate the vote API to also accept/prefer the slug. Update all callers to pass `event.slug` instead of `event.id`.

**Plaintext token fallback still in production auth:**
- Issue: Both `verifyEventAdmin` in `features/auth/server/actions.ts` (line 40) and the magic link auth route `app/api/event/[slug]/auth/route.ts` (line 52) include a fallback: `event.adminToken === token` (plaintext comparison). This was added during a migration to hashed tokens. The plaintext path has never been removed.
- Files: `features/auth/server/actions.ts`, `app/api/event/[slug]/auth/route.ts`
- Impact: If any admin token was stored in plaintext (before the hash migration), the raw token value accepted via the URL would match directly — bypassing the security benefit of hashing. The test in `tests/auth-safety.test.ts` (line 54) even explicitly validates this "migration support" path remains working.
- Fix approach: Run a migration to ensure all `adminToken` values in the DB are SHA-256 hashes. Remove the `|| event.adminToken === token` plaintext fallback. Update the test.

**`features` layer imports directly from `app/api`:**
- Issue: `features/event-management/server/waitlist.ts` (line 3) imports `syncDashboard` from `@/app/api/event/[slug]/slot/notify`. This crosses the architectural boundary — feature modules should not depend on API route modules.
- Files: `features/event-management/server/waitlist.ts`, `app/api/event/[slug]/slot/notify.ts`
- Impact: Creates a tight coupling between the feature layer and the HTTP layer. Makes `syncDashboard` hard to test in isolation, and means changes to the notify route file break the feature layer.
- Fix approach: Extract `syncDashboard` into `shared/lib/` or `features/notifications/` so it can be imported cleanly by both the API route and the feature module.

**84 uses of `any` type across API and feature code:**
- Issue: The codebase has 84 occurrences of `any` type annotations, concentrated in `app/api/event/[slug]/finalize/route.ts`, `app/api/event/[slug]/vote/route.ts`, `app/api/telegram/webhook/route.ts`, and `features/integrations/discord/server/actions.ts`.
- Files: Multiple — see `grep "as any\|: any" app/ features/` for full list
- Impact: Defeats TypeScript's type-safety guarantees in critical auth and voting paths. Errors that TypeScript would catch at compile time can surface as runtime failures.
- Fix approach: Replace `any` with proper Prisma-generated types or custom interfaces. Priority targets are the `byTime` sort comparator, the `updateData` objects, and the transaction callback signatures.

**`adminToken` is optional in schema but treated as required:**
- Issue: The Prisma schema defines `adminToken String? @default(uuid())`. The `?` makes the field nullable, yet all auth code assumes it is always present with no null guard.
- Files: `prisma/schema.prisma` (line 26), `features/auth/server/actions.ts`
- Impact: If a record somehow has a null `adminToken` (e.g. created via a direct DB insert or a future schema change), the auth comparison silently fails rather than throwing a clear error.
- Fix approach: Change the schema to `adminToken String @default(uuid())` (non-nullable) or add explicit null guards in `verifyEventAdmin`.

---

## Security Considerations

**Cleanup cron trusts `x-forwarded-for` for IP allowlisting:**
- Risk: The cleanup cron at `app/api/cron/cleanup/route.ts` (line 31) reads the IP from the `x-forwarded-for` header and allows unauthenticated access if the IP contains `127.0.0.1` or `::1`. `x-forwarded-for` is a client-controlled header that can be spoofed in some proxy configurations.
- Files: `app/api/cron/cleanup/route.ts`
- Current mitigation: `CRON_SECRET` bearer token check is the secondary defense. If `CRON_SECRET` is set, the spoofed-IP path is still blocked unless the secret also matches.
- Recommendations: Remove the IP-based allowlist entirely. Require `CRON_SECRET` always in production. The self-hosted `start.sh` loop already sends no auth header when `CRON_SECRET` is unset — document this and make `CRON_SECRET` mandatory.

**`rawPayload` in Ko-fi webhook stores full payload including supporter email:**
- Risk: The Ko-fi webhook payload includes `email` (see the `KofiWebhookPayload` interface comment in `app/api/kofi/webhook/route.ts`). The full `rawData` string is stored as `rawPayload` in the `Donation` table. The schema comment says "email is intentionally excluded" but the raw JSON blob containing the email is persisted.
- Files: `app/api/kofi/webhook/route.ts` (line 105), `prisma/schema.prisma` (`rawPayload` field on `Donation`)
- Current mitigation: None — email is in the stored blob.
- Recommendations: Either strip the email field before storing `rawPayload`, or stop storing `rawPayload` entirely now that the Ko-fi payload shape is confirmed (the comment says it was for "discovery").

**Non-null assertions on env vars without runtime guard:**
- Risk: Several files use `process.env.TELEGRAM_BOT_TOKEN!` and `process.env.DISCORD_BOT_TOKEN!` (TypeScript non-null assertion) which silence TypeScript warnings but do not prevent runtime errors if the env var is absent.
- Files: `features/auth/server/magic-link.ts` (lines 70, 83), `features/event-management/server/actions.ts` (line 197), `features/event-management/server/recovery.ts` (lines 63, 91)
- Current mitigation: Most bot-touching code in API routes guards with `if (process.env.TELEGRAM_BOT_TOKEN)` before calling, but the feature layer skips this guard.
- Recommendations: Replace `!` assertions with explicit guards or throw a descriptive `ConfigurationError` at startup.

**No rate limiting on any public API endpoint:**
- Risk: All public POST endpoints (`/api/event`, `/api/event/[slug]/vote`, `/api/events/validate`) have no rate limiting. The validate endpoint accepts an arbitrary-length `slugs` array with no upper bound enforced.
- Files: `app/api/event/route.ts`, `app/api/event/[slug]/vote/route.ts`, `app/api/events/validate/route.ts`
- Current mitigation: None detected.
- Recommendations: Add input size capping (e.g., `slugs.length > 100` → 400) to the validate endpoint. Consider edge-level rate limiting via Vercel middleware or a lightweight library.

---

## Known Bugs

**Telegram polling is double-invoked on startup:**
- Symptoms: `startPolling()` in `features/telegram/lib/telegram-service.ts` (lines 22-27) calls `poll(token)` twice sequentially before returning. The second invocation comment reads "double-invoke to handle potential network stalls? (Legacy behavior maintained)". This creates two concurrent recursive polling loops, each of which retries on error with its own backoff — leading to duplicate message processing and the 409 Conflict errors the code tries to handle.
- Files: `features/telegram/lib/telegram-service.ts` (lines 22-27)
- Trigger: Any Docker deployment path that calls `startPolling()`.
- Workaround: The 409 conflict handler retries with random backoff, which partially masks the issue.

**Reminders cron not registered in `vercel.json`:**
- Symptoms: The hosted (Vercel) deployment only registers `/api/cron/cleanup` in `vercel.json`. The `/api/cron/reminders` endpoint is never called on Vercel. Reminders only work in Docker (via `start.sh` loop).
- Files: `vercel.json`, `app/api/cron/reminders/route.ts`
- Trigger: Any user on the hosted deployment who enables reminders.
- Workaround: None for hosted users. Self-hosted Docker users are unaffected.

**`checkReminders` filters on `quorumViableNotified: false` — events with quorum reached never receive reminders:**
- Symptoms: The reminder query in `features/telegram/lib/telegram-service.ts` (line 53) includes `quorumViableNotified: false` as a condition. Once an event hits quorum and the manager is notified, the event is excluded from future reminder checks entirely. Users on events that have reached quorum stop receiving voting reminders even if the event is not yet finalized.
- Files: `features/telegram/lib/telegram-service.ts` (line 49-54)
- Trigger: Any event that reached viable quorum but wasn't finalized (e.g., manager ignored notification).

**`ACTIVE` is a referenced but unimplemented status:**
- Symptoms: `checkReminders` queries for events with `status: { in: ["ACTIVE", "DRAFT"] }`, but no code path ever sets an event's status to `"ACTIVE"`. Events transition from `"DRAFT"` to `"FINALIZED"` or `"CANCELLED"` only. The `"ACTIVE"` value is dead code in the status machine.
- Files: `features/telegram/lib/telegram-service.ts` (line 51), `prisma/schema.prisma` (status comment: "DRAFT -> ACTIVE -> FINALIZED")
- Impact: Planned status transition is never implemented. The documentation comment in the schema is misleading.

---

## Performance Bottlenecks

**Cleanup cron fetches all events into memory then filters in application code:**
- Problem: `app/api/cron/cleanup/route.ts` (line 62) calls `prisma.event.findMany` with no date filter, fetching all DRAFT, FINALIZED, and CANCELLED events. Filtering to find expired events is then done in JavaScript.
- Files: `app/api/cron/cleanup/route.ts` (lines 62-99)
- Cause: Comment in code says "Filter in memory to handle complex logic involving relation (timeSlots) dates." The complex filter could be expressed in Prisma with `some`/`every` conditions or a raw query.
- Improvement path: Push the date comparison into the Prisma `where` clause using `OR` with `timeSlots: { some: { startTime: { lt: cutoff } } }`. Avoids loading entire event history into RAM as the database grows.

**Vote API makes multiple sequential Prisma queries outside the transaction:**
- Problem: `app/api/event/[slug]/vote/route.ts` executes the transaction for participant/vote upsert, then makes three additional `prisma.event.findUnique` / `prisma.participant.count` calls sequentially post-transaction before sending notifications. Under load, this compounds latency.
- Files: `app/api/event/[slug]/vote/route.ts` (lines 196-240)
- Cause: Post-transaction notification logic was added incrementally without consolidating queries.
- Improvement path: Combine the post-transaction read into the transaction's return value or use `select` to include counts in the initial event fetch.

---

## Fragile Areas

**`notify.ts` is imported as a shared library but lives inside `app/api`:**
- Files: `app/api/event/[slug]/slot/notify.ts`
- Why fragile: The file exports `syncDashboard` and `pushSlotUpdates` which are consumed by `features/event-management/server/waitlist.ts`. It also contains the full API route handlers for PUT/PATCH. Moving, renaming, or restructuring this file for routing purposes would break the feature import. The `[slug]` segment in the path means TypeScript path resolution only works because Next.js resolves `@/app/api/event/[slug]/slot/notify` as a module path — it is not a dynamic segment in this context.
- Safe modification: Extract `syncDashboard` and `pushSlotUpdates` to `shared/lib/notifications.ts` before making any changes to the notify route.
- Test coverage: No tests for `syncDashboard` or `pushSlotUpdates`.

**Magic link tokens are never deleted (intentional but creates unbounded table growth):**
- Files: `app/auth/login/route.ts` (lines 83-85), `prisma/schema.prisma` (`LoginToken` model)
- Why fragile: Tokens are intentionally not deleted after use (to avoid "link preview" race conditions), but there is no cleanup path either. The cleanup cron in `app/api/cron/cleanup/route.ts` does not delete expired `LoginToken` rows. Over time the `LoginToken` table accumulates expired records indefinitely.
- Safe modification: Add `prisma.loginToken.deleteMany({ where: { expiresAt: { lt: new Date() } } })` to the cleanup cron.
- Test coverage: No tests verify token lifecycle or cleanup.

**Ko-fi webhook uses `console.log/error` instead of the structured logger:**
- Files: `app/api/kofi/webhook/route.ts`
- Why fragile: All other API routes use `Logger.get(...)`. The Ko-fi webhook uses raw `console.log` and `console.error` throughout, including a debug log that dumps the full payload on every incoming request (line 63: `console.log('[Ko-fi Webhook] Received payload:', JSON.stringify(payload, null, 2))`). This log was added for "initial deployment discovery" and never removed.
- Safe modification: Replace with the structured logger; remove the debug payload dump.

**Discord recovery uses string comparison after optional username lookup fallback — mismatch on username format changes:**
- Files: `features/integrations/discord/server/actions.ts` (lines 22-50)
- Why fragile: `recoverDiscordManagerLink` normalizes both the input and stored username for comparison. If Discord changes the username format (e.g., removing discriminators), or if the stored username was captured with a different format, recovery silently fails.
- Safe modification: Use the stable `managerDiscordId` (Discord user snowflake) as the recovery key, not username string matching.

---

## Test Coverage Gaps

**Core voting and finalization logic has no tests:**
- What's not tested: The entire `/api/event/[slug]/vote/route.ts` handler (participant upsert, vote replacement, quorum detection), `/api/event/[slug]/finalize/route.ts` (seat selection algorithm, waitlist assignment), and `features/event-management/server/waitlist.ts` (promotion logic).
- Files: `app/api/event/[slug]/vote/route.ts`, `app/api/event/[slug]/finalize/route.ts`, `features/event-management/server/waitlist.ts`
- Risk: Bugs in seat assignment or quorum notification go undetected. The finalize algorithm (YES-first, MAYBE-fill-to-min, capped at max) is complex enough to have edge cases.
- Priority: High

**No tests for notification side-effects (Telegram/Discord messages):**
- What's not tested: `syncDashboard`, `pushSlotUpdates`, quorum notifications in the vote handler, reminder delivery in `telegram-service.ts`.
- Files: `app/api/event/[slug]/slot/notify.ts`, `features/telegram/lib/telegram-service.ts`
- Risk: Notification logic silently fails or double-fires without detection.
- Priority: Medium

**No tests for cron jobs:**
- What's not tested: `app/api/cron/cleanup/route.ts` retention logic and `app/api/cron/reminders/route.ts` reminder firing.
- Files: `app/api/cron/cleanup/route.ts`, `app/api/cron/reminders/route.ts`
- Risk: Changes to retention thresholds or reminder time-window logic cannot be verified without full integration tests.
- Priority: Medium

**Only 2 test files exist for the entire application:**
- Files: `tests/auth-safety.test.ts` (68 lines), `features/event-management/server/actions.test.ts` (69 lines)
- Risk: The vast majority of business logic — event creation, voting, finalization, waitlist, notifications, Discord/Telegram integration — has no automated test coverage.
- Priority: High

---

*Concerns audit: 2026-04-22*
