---
phase: 4
level: 2
researched_at: 2026-03-04
---

# Phase 4 Research (Implementation Audit)

## Questions Investigated
1. Did extracting the waitlist auto-promotion logic into a shared service (Phase 4) introduce any unintended side effects?
2. Does the workflow for promoting a user correctly synchronize the dashboard across all states?

## Findings

### 1. 🐛 Bug: `syncDashboard` Overwrites Finalized Itineraries
**Severity:** High
**Discovery:** 
When an event is finalized, `app/api/event/[slug]/finalize/route.ts` creates a special "Finalized" message (via `buildFinalizedMessage`) that includes the selected time, location, host, calendar links, and lists of Accepted/Waitlisted users. It pins this message to Discord and Telegram, storing the `pinnedMessageId` in the database.

During our Phase 4 implementation, the Waitlist auto-promotion logic calls `syncDashboard(eventId)` to update the dashboard when someone is promoted. However, `syncDashboard(eventId)` is hardcoded to *always* generate the standard voting table using `generateStatusMessage(event, participantsCount, baseUrl)`. 

**The Side Effect:** 
If an admin removes a participant from a `FINALIZED` event, a waitlist user is promoted. `syncDashboard` is then called. It targets the existing `pinnedMessageId` (which holds the beautiful Finalized itinerary) and **overwrites it** with the standard pre-finalization voting table!

**Recommendation:**
Update `syncDashboard` and `pushSlotUpdates` in `app/api/event/[slug]/slot/notify.ts` to inspect `event.status`. If the status is `FINALIZED`, it should fetch the accepted/waitlist users and use `buildFinalizedMessage()` instead of `generateStatusMessage()`.

### 2. Waitlist Sorting Integrity
**Status:** Sound
The refactored `waitlist.ts` accurately preserves the sorting logic from `vote/route.ts`. It prioritizes `YES` votes over `MAYBE` votes, and then sorts by the original `createdAt` timestamp. Since the `PATCH` and `DELETE` slot logic correctly deletes votes entirely (or preserves timestamps for unmodified votes), waitlist fairness is perfectly maintained.

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fix `syncDashboard` Overwrite | Requires Immediate Action | Overwriting the Finalized itinerary destroys calendar links and location data for all users in the chat group. |

## Ready for Planning
- [x] Unintended side effects identified
- [x] Edge cases documented
