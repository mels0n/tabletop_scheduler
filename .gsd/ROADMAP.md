---
milestone: Maintenance-Feb-2026
version: 1.5.1
updated: 2026-02-04
---

# Roadmap

> **Current Milestone:** Maintenance & Stability (v1.4.1)
> **Goal:** Resolve critical bugs in Event Display and Data Cleanup.

## Must-Haves
- [x] Fix "My Events" Date Display Logic (Stop showing "Today" for past events)
- [x] Fix Cleanup Cron Job (Handle WebhookEvent FK constraint)

---

## Phases

### Phase 1: Event Display & Cron Fixes
**Status:** ✅ Complete
**Objective:** Correct UI misinformation and ensure data retention policies work.
**Tasks:**
- [x] Update `ProfilePage` to fetch `finalizedSlot.startTime` and `status`
- [x] Update `ProfileDashboard` to render correct date and Cancelled status
- [x] Update `cleanup/route.ts` to cascade delete `WebhookEvent` records
- [x] Verify fix with `debug-inspect` or manual review

---

### Phase 2: Content Polish
**Status:** 🚧 In Progress
**Objective:** Ensure dynamic dates, correct copyright info, and polish UI/UX.
**Tasks:**
- [x] Update `Footer.tsx` to use dynamic year
- [x] Remove duplicate "Propose Time Slots" header
- [x] Add Telegram Group Ilink help text

---

## Progress Summary

| Phase | Status | Tasks | Complete |
|-------|--------|-------|----------|
| 1 | ✅ | 4/4 | 100% |
| 2 | ✅ | 3/3 | 100% |

