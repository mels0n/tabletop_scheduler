import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reliableFetch, redactUrl } from './fetch';

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

describe('redactUrl', () => {
    it('redacts a Telegram bot token from a string URL', () => {
        expect(redactUrl('https://api.telegram.org/bot123456:ABC-def_GHI/sendMessage'))
            .toBe('https://api.telegram.org/bot***/sendMessage');
    });

    it('redacts a URL object', () => {
        expect(redactUrl(new URL('https://api.telegram.org/bot123456:ABC/getUpdates?offset=1')))
            .toBe('https://api.telegram.org/bot***/getUpdates?offset=1');
    });

    it('redacts a file download URL', () => {
        expect(redactUrl('https://api.telegram.org/file/bot123456:ABC/photos/1.jpg'))
            .toBe('https://api.telegram.org/file/bot***/photos/1.jpg');
    });

    it('leaves other URLs alone', () => {
        expect(redactUrl('https://discord.com/api/v10/channels/1/messages'))
            .toBe('https://discord.com/api/v10/channels/1/messages');
    });
});

describe('reliableFetch never logs the bot token', () => {
    const TOKEN = '123456:SECRET-token_value';
    const URL_WITH_TOKEN = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    function captureConsole() {
        const lines: string[] = [];
        for (const m of ['debug', 'info', 'warn', 'error', 'log'] as const) {
            vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
                lines.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
            });
        }
        return lines;
    }

    it('on 5xx, 429 and network failure', async () => {
        const lines = captureConsole();
        mockFetch
            .mockResolvedValueOnce(mockRes(500))
            .mockResolvedValueOnce(mockRes(429, { retryAfterHeader: '0' }))
            .mockRejectedValueOnce(new Error('ECONNRESET'))
            .mockRejectedValueOnce(new Error('ECONNRESET'));

        await expect(reliableFetch(URL_WITH_TOKEN, { retries: 3, retryDelayMs: 1 })).rejects.toThrow('ECONNRESET');

        expect(lines.length).toBeGreaterThanOrEqual(4);
        for (const line of lines) {
            expect(line).not.toContain('SECRET');
        }
        expect(lines.some(l => l.includes('bot***'))).toBe(true);
    });

    it('when Retry-After exceeds the cap', async () => {
        const lines = captureConsole();
        mockFetch.mockResolvedValueOnce(mockRes(429, { retryAfterHeader: '3600' }));

        await reliableFetch(URL_WITH_TOKEN, { retries: 2 });

        expect(lines.length).toBe(1);
        expect(lines[0]).not.toContain('SECRET');
    });
});
