---
phase: 2
plan: 1
verified_at: 2026-03-05
---

# Phase 2 Summary

## Tasks Completed

### Task 1: Fix Discord Magic Link Redirect
Changed the `magicLink` URL in `dmDiscordManagerLink` from:
```
/e/{slug}/manage?token={token}
```
To:
```
/api/event/{slug}/auth?token={token}
```
This ensures the auth route sets the `tabletop_admin_{slug}` cookie before redirecting to `/manage`. The manage page itself ignores the token query param entirely.

### Task 2: Improve Discord Identity Matching
Rewrote `sendDiscordMagicLogin` with a three-step identity resolution strategy:
1. **Fast path:** Check `tabletop_user_discord_id` cookie → direct DB lookup by Discord ID (most reliable)
2. **Fallback:** Search `Participant` records by normalized username
3. **Last resort:** Search `Event.managerDiscordUsername` records

## Root Cause
The `dmDiscordManagerLink` function was created with the bug on Dec 28, 2025 (`dbd662f`). It was never correctly wired to the auth endpoint. Magic links appeared to work only when the user already had a valid admin cookie from a prior session.

## Verification
- `npm run build` succeeded with exit code 0
- No TypeScript errors
