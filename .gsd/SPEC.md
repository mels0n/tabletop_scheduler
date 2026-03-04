---
projectId: tabletop_scheduler
status: FINALIZED
version: 1.7.0
lastUpdated: 2026-03-04
---

# Specification: Issues on Github

## 1. Goal
Address open feature requests from GitHub to improve event management controls and user experience, plus add a donation link.

## 2. Success Criteria
- [ ] **Phase 1: Support the Project**: A donation button/option (e.g., PayPal, Venmo, or Ko-fi) is added to the UI.
- [ ] **Phase 2: Enhanced Creator Controls**: Event Creators can remove a user (and their votes) from an event.
- [ ] **Phase 2: Enhanced Creator Controls**: Event Creators can see exactly who voted for each option when hovering or viewing details.
- [ ] **Phase 3: Dynamic Time Slots**: Event Creators can add, modify, or delete time slots after an event is created (triggering Discord notifications).
- [ ] **Phase 3: Dynamic Time Slots**: Attendees can suggest additional times to the Event Creator.

## 3. Core Requirements
- **Phase 1**: Add a simple link or button in the footer or settings page.
- **Phase 2**: Add a "remove user" functionality to the event management view. Show vote breakdowns per user on hover or click.
- **Phase 3**: Rework the event edit flow to allow adding/removing time slots. Implement notification logic when slots change. Add a "Suggest Time" feature for attendees.
