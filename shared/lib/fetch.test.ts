import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reliableFetch } from './fetch';

/**
 * Minimal Response stand-in: jsdom doesn't reliably expose the fetch Response class,
 * and reliableFetch only touches ok/status/headers.get/clone/json.
 */
function mockRes(status: number, opts: { retryAfterHeader?: string; body?: unknown } = {}) {
    const res = {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (name: string) =>
                name.toLowerCase() === 'retry-after' ? opts.retryAfterHeader ?? null : null,
        },
        clone() { return this; },
        json: async () => {
            if (opts.body === undefined) throw new Error('no body');
            return opts.body;
        },
    };
    return res as unknown as Response;
}

const mockFetch = vi.fn();

describe('reliableFetch — 429 rate limit handling', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('retries a 429 after the Retry-After header delay (seconds, fractional) and returns the eventual success', async () => {
        mockFetch
            .mockResolvedValueOnce(mockRes(429, { retryAfterHeader: '0.01' }))
            .mockResolvedValueOnce(mockRes(200));

        const res = await reliableFetch('https://discord.com/api/v10/channels/1/messages', { retries: 2 });

        expect(res.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('falls back to the JSON body retry_after when the header is absent', async () => {
        mockFetch
            .mockResolvedValueOnce(mockRes(429, { body: { retry_after: 0.01 } }))
            .mockResolvedValueOnce(mockRes(200));

        const res = await reliableFetch('https://discord.com/api/v10/channels/1/messages', { retries: 2 });

        expect(res.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('gives up without waiting when Retry-After exceeds the cap, returning the 429', async () => {
        mockFetch.mockResolvedValue(mockRes(429, { retryAfterHeader: '3600' }));

        const start = Date.now();
        const res = await reliableFetch('https://discord.com/api/v10/channels/1/messages', { retries: 2 });

        expect(res.status).toBe(429);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(Date.now() - start).toBeLessThan(1000);
    });

    it('returns the 429 once retries are exhausted', async () => {
        mockFetch.mockResolvedValue(mockRes(429, { retryAfterHeader: '0.01' }));

        const res = await reliableFetch('https://discord.com/api/v10/channels/1/messages', { retries: 1 });

        expect(res.status).toBe(429);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('still retries 5xx errors with backoff as before', async () => {
        mockFetch
            .mockResolvedValueOnce(mockRes(500))
            .mockResolvedValueOnce(mockRes(200));

        const res = await reliableFetch('https://example.com', { retries: 2, retryDelayMs: 1 });

        expect(res.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
