---
phase: 1
level: 2
researched_at: 2026-03-19
---

# Phase 1 Research

## Questions Investigated
1. Where are the Magic Link logs generated and how do they differ in format?
2. How are Discord and Telegram handles currently normalized and stored?
3. Where does the user input handles for recovery?

## Findings

### Magic Link Logging
Logs are generated in two places:
1. `app/auth/login/route.ts` (Global Player Login): Outputs `Global Magic Link login successful {"chatId":null}` because it only logs `chatId`, neglecting `discordId`.
2. `app/api/event/[slug]/auth/route.ts` (Event Manager Login): Outputs `Magic Link login successful {"slug":"..."}`.

**Recommendation:** Unify these to a standard format. For example, include the `scope` ("global" or "route") and the `identifier` (discordId, chatId, or slug) consistently.

### Handle Input Normalization & Storage
Handlers are stored differently based on platform:
- **Telegram:** `updateManagerHandle` in `features/event-management/server/actions.ts` explicitly stores handles with a leading `@` (e.g., `@handle`).
- **Discord:** Stored without `@`, directly matching the Discord OAuth username.

Recovery inputs occur in `features/auth/ui/ManagerRecovery.tsx` and `features/discord/ui/DiscordLoginSender.tsx`. 
Current recovery server actions perform a baseline normalization by stripping `@` and converting to lowercase for DB comparisons. However, to fully satisfy the requirement to "add or remove it to match how we store", we should apply this formatting explicitly to the sanitized string if we update/echo it back. 

**Recommendation:** 
- For Telegram: Explicitly format strings to always start with `@` (if not already) before storage or visual echo.
- For Discord: Explicitly strip `@` from strings for storage or visual echo.
- Fix the logger in `app/auth/login/route.ts` to include Discord context.

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Log Format | Standardize `log.info` payload | Makes log searching easier in Vercel |
| Handle normalizer | Telegram gets `@`, Discord strips `@` | Matches DB storage paradigms |

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
