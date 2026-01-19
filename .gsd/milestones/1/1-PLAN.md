---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Testing Infrastructure & Safety Nets

## Objective
Establish a robust unit testing foundation and implement "Characterization Tests" (Safety Nets) for high-risk auth logic *before* refactoring.

## Context
- implementation_plan.md
- app/actions.ts

## Tasks

<task type="auto">
  <name>Install Dependencies</name>
  <files>package.json</files>
  <action>
    Install `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`.
    Use `npm install -D`.
  </action>
  <verify>grep "vitest" package.json</verify>
  <done>Packages installed</done>
</task>

<task type="auto">
  <name>Configure Vitest</name>
  <files>vitest.config.ts</files>
  <action>
    Create `vitest.config.ts` with React and Alias support (@ -> ./).
    Add `"test": "vitest"` script to package.json.
  </action>
  <verify>npm run test -- --help</verify>
  <done>Vitest runner works</done>
</task>

<task type="auto">
  <name>Setup Prisma & Cookie Mocks</name>
  <files>
    shared/lib/__mocks__/prisma.ts
    vitest.setup.ts
  </files>
  <action>
    Create a global mock for `prisma`.
    Create helpers to mock `next/headers` (cookies) for testing server actions.
  </action>
  <verify>Test-Path shared/lib/__mocks__/prisma.ts</verify>
  <done>Mocks created</done>
</task>

<task type="auto">
  <name>Create Auth Safety Net Test</name>
  <files>tests/auth-safety.test.ts</files>
  <action>
    Create a test file `tests/auth-safety.test.ts`.
    Import `setAdminCookie` and `verifyEventAdmin` from `app/actions.ts` (Legacy location).
    Write tests asserting:
    1. `setAdminCookie` sets a cookie with expected attributes (HTTPOnly, Secure).
    2. `verifyEventAdmin` returns true for valid token hash.
    3. `verifyEventAdmin` returns false for invalid token.
    Run this test to confirm "Green" state before refactoring.
  </action>
  <verify>npm run test tests/auth-safety.test.ts</verify>
  <done>Current behavior is verified</done>
</task>

## Success Criteria
- [ ] `npm run test` passes.
- [ ] Auth logic is characterized by tests.
