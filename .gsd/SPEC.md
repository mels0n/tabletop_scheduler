---
projectId: tabletop_scheduler
status: FINALIZED
version: 1.8.0
lastUpdated: 2026-03-05
---

# Specification: Features / Bug fixes from github issues

## 1. Goal
Address the current backlog of open bug reports and UI feature requests from GitHub, specifically focusing on mobile responsiveness, UI clipping, and Discord Magic Link authentication bugs.

## 2. Success Criteria
- [ ] **Phase 1: Mobile & UI Polish**: Android horizontal scrolling is prevented. iOS Safari bottom/top white bars are removed. Recovery Access nav gradient is fixed.
- [ ] **Phase 2: Magic Link Authentication**: Discord Magic links route via `/api/event/[slug]/auth` instead of `/manage` directly, allowing the admin cookie to be successfully set. Global Discord magic logins correctly identify accounts by username/ID without failing.
- [ ] **Phase 3: Recover Access Text Update**: The recovery modal dynamically updates text to say "Discord" instead of "Telegram" when Discord is selected.

## 3. Core Requirements
- **Phase 1**: Update `app/globals.css` or `app/layout.tsx` for mobile viewport styling. Fix Tailwind gradient classes in `Navbar.tsx` or `ManagerRecovery.tsx`.
- **Phase 2**: Fix `dmDiscordManagerLink` to use the auth endpoint. Improve username matching in `sendDiscordMagicLogin` to handle Discord IDs and usernames consistently and case-insensitively.
- **Phase 3**: Change the hardcoded paragraph in `ManagerRecovery.tsx` to read the `platform` state before displaying the term "Telegram".
