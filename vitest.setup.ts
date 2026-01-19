import { vi, beforeEach } from 'vitest';
import '@testing-library/react';

// Automatically clear mock calls and instances between tests
beforeEach(() => {
    vi.clearAllMocks();
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
