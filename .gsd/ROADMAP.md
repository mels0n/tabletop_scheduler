---
milestone: Issues on Github
version: 1.7.0
updated: 2026-03-04
---

# Roadmap

> **Previous Milestone:** Doc Sync 2026 (v1.6.0) — ✅ Complete
> **Current Milestone:** Issues on Github (v1.7.0)
> **Goal:** Address open feature requests from GitHub to improve event management controls and user experience, plus add a donation link.

## Must-Haves
- [x] ~~Add a donation button/option (e.g., PayPal, Venmo, or Ko-fi) to the UI.~~ (Skipped)
- [x] Allow Event Creators to remove a user (and their votes) from an event.
- [x] Add visibility for Event Creators to see exactly who voted for each option when hovering or viewing details.
- [x] Allow Event Creators to add, modify, or delete time slots after an event is created.
- [x] Allow attendees to suggest additional times to the Event Creator.
- [x] Extract waitlist auto-promotion logic into a shared service and trigger it on participant removal.

---

## Phases

### Phase 1: Support the Project
**Status:** ⏭️ Skipped
**Objective:** Add a donation button/option to the UI (#26) - Skipped for now.

---

### Phase 2: Enhanced Creator Controls
**Status:** ✅ Complete
**Objective:** Allow Event Creators to remove a user and view vote breakdowns per user (#29, #30).

---

### Phase 3: Dynamic Time Slots
**Status:** ✅ Complete
**Objective:** Allow modifying time slots after event creation and adding attendee suggestions (#27, #28).

---

### Phase 4: Waitlist Auto-Promotion
**Status:** ✅ Complete
**Objective:** Extract waitlist auto-promotion logic into a shared service and trigger it when an accepted participant is removed from a finalized, capped event.
**Depends on:** Phase 3

---

### Phase 5: Dashboard Sync Integrity
**Status:** ⬜ Not Started
**Objective:** Update `syncDashboard` and `pushSlotUpdates` to respect `FINALIZED` event status, preserving the finalized itinerary instead of reverting to the voting table.
**Depends on:** Phase 4

---

## Progress Summary

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ⏭️ | Support the Project (Donations) - Skipped |
| 2 | ✅ | Enhanced Creator Controls |
| 3 | ✅ | Dynamic Time Slots |
| 4 | ✅ | Waitlist Auto-Promotion |
| 5 | ⬜ | Dashboard Sync Integrity |
