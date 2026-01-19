---
phase: 1
plan: 2
wave: 1
---

# Plan 1.2: Refactor Server Actions (VSA)

## Objective
Decompose `app/actions.ts` into feature-specific slices, maintaining test coverage from the safety net.

## Context
- app/actions.ts
- features/
- tests/auth-safety.test.ts

## Tasks

<task type="auto">
  <name>Create Feature Directories</name>
  <files>
    features/auth/server/actions.ts
    features/event-management/server/actions.ts
    features/integrations/telegram/server/actions.ts
    features/integrations/discord/server/actions.ts
  </files>
  <action>
    Scaffold directory structure.
  </action>
  <verify>Test-Path features/auth/server</verify>
  <done>Dirs exist</done>
</task>

<task type="auto">
  <name>Migrate Auth Actions</name>
  <files>
    features/auth/server/actions.ts
    tests/auth-safety.test.ts
  </files>
  <action>
    Move `verifyEventAdmin` and `setAdminCookie` to `features/auth/server/actions.ts`.
    **CRITICAL**: specific imports in `tests/auth-safety.test.ts` must be updated to point to the new location `features/auth/server/actions.ts`.
    Verify tests still pass.
  </action>
  <verify>npm run test tests/auth-safety.test.ts</verify>
  <done>Code moved and tests pass</done>
</task>

<task type="auto">
  <name>Migrate Management Actions</name>
  <files>
    features/event-management/server/actions.ts
    features/event-management/server/actions.test.ts
  </files>
  <action>
    Move management logic (`deleteEvent`, etc).
    Write NEW unit tests for this logic (since no safety net exists for these yet) in `features/event-management/server/actions.test.ts`.
  </action>
  <verify>npm run test features/event-management/server/actions.test.ts</verify>
  <done>Tests pass</done>
</task>

<task type="auto">
  <name>Cleanup Legacy Actions</name>
  <files>app/actions.ts</files>
  <action>
    Remove moved functions from `app/actions.ts`.
    If file is empty, delete it.
    Verify execution with `npm run build` to catch any lingering imports in UI components.
  </action>
  <verify>npm run build</verify>
  <done>Build passes</done>
</task>

## Success Criteria
- [ ] `app/actions.ts` is empty/removed.
- [ ] `tests/auth-safety.test.ts` passes against NEW location.
