---
milestone: v1.9.0 - Fixing Magic Links
version: 1.9.0
updated: 2026-03-19
---

# Roadmap

> **Previous Milestone:** v1.8.0 - GitHub Issues — ✅ Complete
> **Current Milestone:** v1.9.0 - Fixing Magic Links
> **Goal:** Resolve magic link authentication and data persistence issues for players and organizers.

## Must-Haves
- [ ] Fix profile name not updating upon successful login.
- [ ] Fix organizer verification persistence on the myevents screen.
- [ ] Resolve intermittent `fetch failed` and `makeNetworkError` during login.
- [ ] Standardize logging formats for Magic Link logins.
- [ ] Normalize handle inputs (allow with or without '@' and align format with database storage).
- [ ] Fix "Account Not Found" error for organizer sign-ins.

---

## Phases

### Phase 1: Input Normalization & Logging
**Status**: ✅ Complete
**Objective**: Standardize Discord/Telegram handle inputs by processing the `@` symbol dynamically, and unify authentication log formats across scopes.

### Phase 2: Error Handling & Network Resilience
**Status**: ✅ Complete
**Objective**: Investigate and resolve the `fetch failed` and `makeNetworkError` instances occurring during the magic link login process.

### Phase 3: Profile & State Persistence
**Status**: ✅ Complete
**Objective**: Ensure that a successful login correctly updates the user's name across the application.

### Phase 4: Organizer Verification Logic
**Status**: ✅ Complete
**Objective**: Fix the persistent verification prompt for managers on the myevents screen and resolve the "Account Not Found" error for organizers attempting to sign in.

### Phase 5: Pre-Sync Organizer Inference
**Status**: ✅ Complete
**Objective**: If a user is already authenticated via Telegram or Discord and creates a new event, automatically record them as the event manager without requiring a separate linking step.
**Depends on**: Phase 4

**Tasks**:
- [ ] TBD (run /plan 5 to create)

**Verification**:
- TBD

### Phase 6: Mobile Responsive UI
**Status**: ✅ Complete
**Objective**: Address UI draw issues on mobile (e.g. iOS), fix the bright white safe area bars, and resolve the horizontal overflow causing excessive right-side padding. (Closes #34)
**Depends on**: Phase 5

**Tasks**:
- [ ] TBD (run /plan 6 to create)

**Verification**:
- TBD
