---
phase: 6
title: Post-Audit Refinements
objective: Resolve lingering side-effects from Phases 2-4 (rogue sync in vote route, slot modifications on finalized events).
status: pending
---

# Phase 6: Post-Audit Refinements

## Context
During the Phase 2-4 implementation audit, two side-effects were discovered that bypass the recent Phase 5 dashboard sync fix:
1. `vote/route.ts` contains duplicated, inline logic for syncing Telegram/Discord that circumvents `syncDashboard`, which causes voting on a finalized event to overwrite the itinerary.
2. The slot creation/modification routes introduced in Phase 3 do not check if an event is finalized, meaning a creator could corrupt the database by deleting the finalized slot.

## Approach

### 1. Fix Rogue Sync in `vote/route.ts`
- Remove the inline `editTelegramMessage`, `editDiscordMessage`, and `generateStatusMessage` calls.
- Replace these ~70 lines with a single call to `await syncDashboard(eventId)`.
- **Validation**: Ensure voting correctly pings the unified sync logic.

### 2. Lock Slots Post-Finalization
- Edit `app/api/event/[slug]/slot/route.ts` (POST).
- Edit `app/api/event/[slug]/slot/[slotId]/route.ts` (PATCH, DELETE).
- Edit `app/api/event/[slug]/slot/suggest/route.ts` (POST) (if not already handled).
- Add a strict guard: `if (eventInfo.status === 'FINALIZED' || eventInfo.status === 'CANCELLED') return 400;`
- **Validation**: Attempting to add, edit, or delete a slot on a finalized event should fail.

## Verification
- Automated build check.
- Manual test to ensure event remains pristine when voting changes.
- Manual test to ensure you cannot delete the finalized slot.
