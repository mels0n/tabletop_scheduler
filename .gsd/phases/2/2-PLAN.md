---
phase: 2
plan: 1
wave: 1
---

# Plan 2.1: Fix Discord Magic Link & Identity Matching

## Objective
Ensure the Discord Magic Link works consistently across different devices and correctly links the manager to the event. This fixes two specific bugs: the link redirection failure, and the overly strict identity matching when users request a global magic link via Discord.

## Context
- .gsd/SPEC.md
- .gsd/phases/2/RESEARCH.md
- features/integrations/discord/server/actions.ts

## Tasks

<task type="auto">
  <name>Fix Discord Magic Link Redirect</name>
  <files>
    - features/integrations/discord/server/actions.ts
  </files>
  <action>
    - In `dmDiscordManagerLink`, modify the `magicLink` generation.
    - Change it from:
      ``const magicLink = `${process.env.NEXT_PUBLIC_BASE_URL}/e/${slug}/manage?token=${token}`;``
    - To target the auth endpoint (like Telegram does):
      ``const magicLink = `${process.env.NEXT_PUBLIC_BASE_URL}/api/event/${slug}/auth?token=${token}`;``
    - This ensures the `auth` route handles the token validation and sets the appropriate `tabletop_admin_[slug]` cookie.
  </action>
  <verify>npm run build</verify>
  <done>The magic link explicitly routes through `/api/event/[slug]/auth` instead of `/manage` directly.</done>
</task>

<task type="auto">
  <name>Improve Discord Identity Matching</name>
  <files>
    - features/integrations/discord/server/actions.ts
  </files>
  <action>
    - In `sendDiscordMagicLogin`, add logic to check for the `tabletop_user_discord_id` cookie before falling back entirely to username matching.
    - Import `cookies` from `next/headers` if not already available in the scope (it is imported at the top of the file).
    - If `tabletop_user_discord_id` is present, look for any `Participant` or `Event` (via `managerDiscordId`) matching that ID.
    - If a match is found via the ID cookie, use it for `targetId` and `targetUsername`.
    - If no cookie match is found, proceed with the existing normalized string matching for `username`.
  </action>
  <verify>npm run build</verify>
  <done>User lookup for global magic links gracefully falls back to explicit Discord ID cookies if available, reducing false negatives.</done>
</task>

## Success Criteria
- [ ] Magic link URLs generated for Discord route through the `/api/event/[slug]/auth` endpoint.
- [ ] Global magic link requests (`sendDiscordMagicLogin`) prioritize a user's known Discord ID in cookies when resolving identity.
