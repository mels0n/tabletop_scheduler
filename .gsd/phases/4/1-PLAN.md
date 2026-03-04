---
phase: 4
title: Waitlist Auto-Promotion
objective: Extract waitlist auto-promotion logic into a shared service and trigger it when an accepted participant is removed from a finalized, capped event.
status: pending
---

# Phase 4: Waitlist Auto-Promotion

## Context
During the Phase 2 implementation audit, we discovered that deleting an `ACCEPTED` participant from a capped/finalized event did not auto-promote someone from the waitlist to take their place. This is because the auto-promotion logic was tightly coupled to the user-driven `POST /api/event/[slug]/vote` route rather than a shared backend service.

## Objectives
1. Extract the auto-promotion logic from `vote/route.ts` into a dedicated service.
2. Hook up the new auto-promotion service to both `vote/route.ts` and `participant/[participantId]/route.ts`.
3. Ensure dashboards on Telegram and Discord accurately update whenever a priority bump shifts the roster.

## Tasks

### 1. Create Waitlist Service
- [ ] Create `features/event-management/server/waitlist.ts`
- [ ] Copy the waitlist logic originally defined in `app/api/event/[slug]/vote/route.ts` (lines 276-350 into a new async function `processWaitlistPromotion(eventId: number)`. Ensure this existing logic still handles notifying the newly promoted user via Telegram and Discord.
- [ ] Add the call to `syncDashboard` within `processWaitlistPromotion()`.

### 2. Refactor Vote Route
- [ ] Import `processWaitlistPromotion` in `app/api/event/[slug]/vote/route.ts`.
- [ ] Replace the original inline waitlist block with a clear call to `processWaitlistPromotion(event.id)`.

### 3. Update Participant Deletion Route
- [ ] Import `processWaitlistPromotion` in `app/api/event/[slug]/participant/[participantId]/route.ts`.
- [ ] Send a notification (Telegram/Discord) to the participant being deleted *before* wiping their record, if they were `ACCEPTED` in a `FINALIZED` event.
- [ ] Call `processWaitlistPromotion(event.id)` after a participant is successfully deleted. (Ensure waitlist spots are handled before finalizing response).

## Verification
- [ ] Confirm no regressions occur on standard voting (waitlist promotions still work).
- [ ] Verify that manual Admin `Remove` prompts waitlisted updates and dashboard synchronization.
