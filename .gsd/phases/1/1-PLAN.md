---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Standardize Logs & Handle Formats

## Objective
Standardize Discord/Telegram handle inputs by processing the `@` symbol properly to match DB paradigms, and unify magic link logs.

## Context
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- .gsd/phases/1/RESEARCH.md
- app/auth/login/route.ts
- app/api/event/[slug]/auth/route.ts

## Tasks

<task type="auto">
  <name>Unify Authentication Logs</name>
  <files>
    - app/auth/login/route.ts
    - app/api/event/[slug]/auth/route.ts
  </files>
  <action>
    - In `app/auth/login/route.ts` (Global), update the success log to use a standard format, extracting `discordId` if `chatId` is missing: `log.info("Magic Link login successful", { scope: "global", identifier: validToken.chatId || validToken.discordId });`.
    - In `app/api/event/[slug]/auth/route.ts` (Route), update the success log to match: `log.info("Magic Link login successful", { scope: "event", identifier: slug });`.
  </action>
  <verify>grep -n "Magic Link login successful" app/auth/login/route.ts app/api/event/[slug]/auth/route.ts</verify>
  <done>Both log outputs standardize on `"Magic Link login successful"` and use `{ scope, identifier }` payload objects.</done>
</task>

<task type="auto">
  <name>Handle Input Normalization</name>
  <files>
    - features/event-management/server/recovery.ts
    - features/integrations/discord/server/actions.ts
    - features/auth/ui/ManagerRecovery.tsx
    - features/discord/ui/DiscordLoginSender.tsx
  </files>
  <action>
    - In `features/auth/ui/ManagerRecovery.tsx` and `features/discord/ui/DiscordLoginSender.tsx`, allow users to freely enter their handle with or without `@`.
    - In `features/event-management/server/recovery.ts`, explicitly prefix the output/log handle with `@` if it's Telegram, to match how `updateManagerHandle` stores it.
    - In `features/integrations/discord/server/actions.ts` (`sendDiscordMagicLogin`, `recoverDiscordManagerLink`), explicitly strip any `@` characters from the provided username to match how Discord OAuth stores it.
    - Ensure comparison logic removes `@` robustly so users can type either format reliably.
  </action>
  <verify>npm run build</verify>
  <done>The server actions successfully format `@` symbols appropriately according to the DB schema.</done>
</task>

## Success Criteria
- [ ] Global and Route Magic Link success logs share a unified `{ scope, identifier }` structure.
- [ ] Telegram handles are prefixed with `@` where appropriate and Discord handles are cleanly stripped of `@`.
