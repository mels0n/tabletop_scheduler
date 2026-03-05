---
phase: 2
level: 2
researched_at: 2026-03-05
---

# Phase 2 Post-Implementation Research

## Questions Investigated
1. Does calling `cookies()` inside `sendDiscordMagicLogin` (a server action) cause any errors?
2. Could the cookie fast-path in `sendDiscordMagicLogin` return the wrong user if multiple people share a browser session?
3. Are there any TypeScript variable shadowing risks from the rewrite?
4. Is the `tabletop_user_discord_id` cookie set and persisted reliably enough to be a trustworthy fast-path?

## Findings

### `cookies()` in a Server Action
`sendDiscordMagicLogin` is called from `DiscordLoginSender.tsx`, which is a `"use client"` component invoking a server action. In Next.js 14, this is a fully supported pattern — server actions run in a request context, so calling `cookies()` from `next/headers` is valid and safe.

**Verdict:** No issue.

### Cookie Fast-Path Correctness
The `tabletop_user_discord_id` cookie is set in two routes:
1. `app/api/auth/discord/callback/route.ts` — Set during Discord OAuth login/connect flows. Options: `HttpOnly: true`, 400-day `maxAge`.
2. `app/auth/login/route.ts` — Set after consuming a Discord magic login token.

Because the cookie is **HttpOnly**, it cannot be tampered with from the browser. If the cookie is present, it reliably identifies the device owner's Discord account. The risk of "wrong user on a shared device" is the same as for any cookie-based auth on the platform — an acceptable product-level tradeoff.

**Verdict:** No issue. Fast-path is safe.

### TypeScript Variable Shadowing
The original code had a `let targetUsername = match?.discordUsername` inside an inner block, which would shadow the outer declaration. The rewrite uses `targetDiscordId` / `targetDiscordUsername` at the outer scope, with no re-declaration inside blocks. The `token` variable was renamed to `botToken` in the rewrite to avoid any ambiguity.

**Verdict:** Resolved in rewrite. No issues.

### The `dmDiscordManagerLink` URL Fix
The `magicLink` URL now routes through `/api/event/${slug}/auth?token=${token}`. The auth route validates the token against the DB (supporting both hashed and legacy plaintext tokens), sets the `tabletop_admin_{slug}` cookie, and redirects to `/manage`.

One edge case to be aware of: The auth route derives `baseUrl` from `request.headers`, but `dmDiscordManagerLink` uses `process.env.NEXT_PUBLIC_BASE_URL` for the URL. This is correct and intentional — the DM is sent as a standalone link, so it must use the absolute public URL, not a relative one.

**Verdict:** Correct behavior. No issue.

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cookie fast-path | Keep | HttpOnly cookie is reliable. Reduces false negatives for users who have previously OAuth'd. |
| Renamed `token` to `botToken` in rewrite | Keep | Avoids subtle shadowing with any future `token` local variables. |

## Risks
- **Stale Cookie Risk**: If a user's Discord ID in the cookie is no longer valid in the DB (deleted participant, etc.), the fast-path would return `targetDiscordId = null` and fall through to username matching — this is the correct and safe behavior.
- **None found beyond the above.**

## Ready for Planning
- [x] Questions answered
- [x] Approach verified post-implementation
- [x] No regressions detected
