# Testing Patterns

**Analysis Date:** 2026-04-22

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`) — no separate assertion library

**Run Commands:**
```bash
npm test                # Run all tests (vitest)
npm test -- --watch     # Watch mode
npm test -- --coverage  # Coverage (v8 provider)
```

## Test File Organization

**Location:**
- Mix of co-located (`features/event-management/server/actions.test.ts`) and a separate `tests/` directory (`tests/auth-safety.test.ts`)
- Co-location is the emerging pattern for feature server actions
- `tests/` is used for cross-cutting or integration-style tests

**Naming:**
- `{module-name}.test.ts` — suffix `.test.ts` for all test files
- No `.spec.ts` pattern used

**Structure:**
```
features/
  event-management/
    server/
      actions.ts
      actions.test.ts    ← co-located test

tests/
  auth-safety.test.ts    ← standalone safety tests

shared/
  lib/
    __mocks__/
      prisma.ts          ← manual mock for Prisma client
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Module Name', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('functionName', () => {
        it('should describe the expected behavior', async () => {
            // arrange
            mockVerifyAdmin.mockResolvedValue(true);
            // act
            const result = await functionUnderTest('slug');
            // assert
            expect(result).toEqual({ success: true });
        });
    });
});
```

**Patterns:**
- `beforeEach(() => vi.resetAllMocks())` in every test file (also enforced globally in `vitest.setup.ts`)
- One `describe` block per module/file, nested `describe` per exported function
- `it` descriptions use "should ..." phrasing — `it('should return unauthorized if verifyEventAdmin fails')`
- Async/await throughout — no `.then()` chains

## Mocking

**Framework:** Vitest `vi` — `vi.mock()`, `vi.fn()`, `vi.resetAllMocks()`

**Module Mocking:**
```typescript
// Mock entire module
vi.mock('@/shared/lib/prisma');

// Mock with partial factory (replace specific exports)
vi.mock('@/features/auth/server/actions', () => ({
    verifyEventAdmin: vi.fn(),
}));

// Mock optional integrations
vi.mock('@/features/telegram', () => ({
    sendTelegramMessage: vi.fn(),
    unpinChatMessage: vi.fn(),
}));
```

**Cast Pattern for Type Safety:**
```typescript
// Cast mocked modules to get typed access to vi.fn() methods
const mockVerifyAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
    event: { findUnique: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn> },
    $transaction: ReturnType<typeof vi.fn>
};
```

**Configuring Mock Behavior:**
```typescript
mockVerifyAdmin.mockResolvedValue(false);                // Async mock return
mockCookieStore.get.mockReturnValue({ value: 'token' }); // Sync mock return
mockPrisma.event.findUnique.mockResolvedValue(null);     // Simulate DB miss
mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(prisma)); // Transaction pass-through
```

**Global Setup (`vitest.setup.ts`):**
```typescript
// next/headers mocked globally for all tests
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
    })),
    headers: vi.fn(() => ({ get: vi.fn() })),
}));

beforeEach(() => {
    vi.clearAllMocks(); // Auto-clear between every test
});
```

**What to Mock:**
- `@/shared/lib/prisma` — always mock the DB client
- `next/headers` (`cookies`, `headers`) — mocked globally in setup
- External feature integrations (`@/features/telegram`, `@/features/discord/...`) — mock to test action logic in isolation
- Auth helpers (`verifyEventAdmin`) — mock when testing actions that depend on auth

**What NOT to Mock:**
- Pure utility functions (e.g., `hashToken`, `checkSlotQuorum`) — test these directly
- Business logic under test — mock its dependencies, not the function itself

## Fixtures and Factories

**Test Data:**
```typescript
// Inline object literals used directly in tests — no factory pattern yet
mockPrisma.event.findUnique.mockResolvedValue({
    id: 1,
    title: 'Test Event',
    slug: 'slug'
});

mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
```

**Location:**
- No dedicated fixtures directory — test data constructed inline per test
- `shared/lib/__mocks__/prisma.ts` serves as the reusable Prisma mock factory:
  ```typescript
  // shared/lib/__mocks__/prisma.ts
  export const prisma = {
      event: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
      participant: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
      vote: { deleteMany: vi.fn() },
      timeSlot: { deleteMany: vi.fn() },
      webhookEvent: { create: vi.fn() },
      loginToken: { create: vi.fn() },
      $transaction: vi.fn((callback) => callback(prisma)),
  };
  export default prisma;
  ```
  This file is automatically used when `vi.mock('@/shared/lib/prisma')` is called.

## Coverage

**Requirements:** No coverage threshold enforced

**Provider:** v8 (configured in `vitest.config.ts`)

**View Coverage:**
```bash
npm test -- --coverage
```

## Test Types

**Unit Tests:**
- All current tests are unit tests for server actions
- Test individual server action functions in isolation
- Mock all external dependencies (DB, auth, integrations)
- Files: `features/event-management/server/actions.test.ts`, `tests/auth-safety.test.ts`

**Integration Tests:**
- Not present — no tests exercise multiple real layers together

**E2E Tests:**
- Not used — no Playwright, Cypress, or similar configured

**Component Tests:**
- `@testing-library/react` is installed (devDependency) but no component tests exist yet
- `jsdom` environment configured in `vitest.config.ts` (`environment: 'jsdom'`) — ready for component testing

## Common Patterns

**Async Testing:**
```typescript
it('should return unauthorized if verifyEventAdmin fails', async () => {
    mockVerifyAdmin.mockResolvedValue(false);
    const result = await deleteEvent('slug');
    expect(result).toEqual({ error: "Unauthorized" });
});
```

**Error/Null Path Testing:**
```typescript
it('should return error if event not found', async () => {
    mockVerifyAdmin.mockResolvedValue(true);
    mockPrisma.event.findUnique.mockResolvedValue(null);
    const result = await deleteEvent('slug');
    expect(result).toEqual({ error: "Event not found" });
});
```

**Partial Match Assertions:**
```typescript
// Use expect.objectContaining for flexible assertions
expect(mockCookieStore.set).toHaveBeenCalledWith(
    'tabletop_admin_my-slug',
    'my-token',
    expect.objectContaining({
        httpOnly: true,
        maxAge: expect.any(Number),
    })
);

// Use expect.objectContaining for Prisma call args
expect(mockPrisma.event.update).toHaveBeenCalledWith(expect.objectContaining({
    data: { managerTelegram: '@chris' }
}));
```

**String Partial Match:**
```typescript
// Use .toContain() for error message content checks
expect(result.error).toContain('at least 2 characters');
```

---

*Testing analysis: 2026-04-22*
