import { vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetServerConfigForTests } from '@/shared/config/server';

// Tests run with a canonical base URL (bot links require one). Config is cached, so it is
// reset before each test to pick up any env a test sets in its own beforeEach.
process.env.NEXT_PUBLIC_BASE_URL ||= 'http://localhost:3000';

// Automatically clear mock calls and instances between tests
beforeEach(() => {
    vi.clearAllMocks();
    resetServerConfigForTests();
});

// testing-library only auto-cleans when a global afterEach exists (vitest globals are off
// here), so unmount rendered components explicitly or the DOM accumulates across tests.
afterEach(() => {
    cleanup();
});

// Mock next/headers for Server Actions. Since Next 15, cookies() and headers() return Promises.
vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        getAll: vi.fn(),
        has: vi.fn(),
    })),
    headers: vi.fn(async () => ({
        get: vi.fn(),
    })),
}));
