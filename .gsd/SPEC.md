---
projectId: tabletop_scheduler
status: FINALIZED
version: 1.4.1
lastUpdated: 2026-02-04
---

# Specification: Maintenance & Stability

## 1. Goal
Address critical stability issues and UI inconsistencies reported in production. Specifically, resolve the "My Events" date display confusion and fix the failing Database Cleanup Cron Job.

## 2. Success Criteria
- [ ] **UI Accuracy**: "My Events" page displays the *Scheduled Date* for finalized events, not the *Last Visited* date.
- [ ] **Data Hygiene**: The Cleanup Cron runs successfully without FK violations.
- [ ] **User Feedback**: Cancelled events are clearly marked and distinguishable from active events.
- [ ] **Content**: Footer years must be dynamic to avoid annual maintenance.


## 3. Core Requirements
- **Cron Fix**: Delete `WebhookEvent` and other dependencies before deleting `Event` to prevent Foreign Key constraints.
- **UI Logic Update**:
    - If `status == CANCELLED`, show "Cancelled" badge.
    - If `finalizedSlot` exists, show its `startTime` as the event date.
    - Fallback to "Draft" or "Scheduling..." for non-finalized events.
- **Content Update**:
    - Ensure footer year is `new Date().getFullYear()`.

