import { vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Automatically clear mock calls and instances between tests
beforeEach(() => {
    vi.clearAllMocks();
});

// testing-library only auto-cleans when a global afterEach exists (vitest globals are off
// here), so unmount rendered components explicitly or the DOM accumulates across tests.
afterEach(() => {
    cleanup();
});

// Mock next/headers for Server Actions
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        getAll: vi.fn(),
        has: vi.fn(),
    })),
    headers: vi.fn(() => ({
        get: vi.fn(),
    })),
}));
