import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startPolling, stopPolling } from './telegram-service';
import { handleTelegramUpdate } from '../server/update-handler';

vi.mock('../server/update-handler', () => ({ handleTelegramUpdate: vi.fn() }));

const handler = handleTelegramUpdate as unknown as ReturnType<typeof vi.fn>;

function json(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, statusText: '', json: async () => body } as Response;
}

/** Lets the detached poll loop run until it settles. */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('startPolling', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.resetAllMocks();
        process.env.TELEGRAM_BOT_TOKEN = 'test-token';
        delete process.env.VERCEL;
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        stopPolling();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('refuses to start on Vercel', async () => {
        vi.stubEnv('VERCEL', '1');
        vi.stubEnv('TELEGRAM_MODE', 'webhook');
        vi.stubEnv('CRON_SECRET', 'cron');

        await startPolling();
        await flush();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('stops on a 409 without deleting the webhook', async () => {
        fetchMock.mockResolvedValue(json(409, { ok: false, description: "Conflict: can't use getUpdates method while webhook is active" }));

        await startPolling();
        await flush();
        await flush();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toContain('/getUpdates');
        expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('deleteWebhook'))).toBe(false);
    });

    it('runs one loop and hands each update to the shared handler', async () => {
        const update = { update_id: 10, message: { text: '/start', chat: { id: 1, type: 'private' } } };
        fetchMock
            .mockResolvedValueOnce(json(200, { ok: true, result: [update] }))
            .mockResolvedValue(json(409, { ok: false, description: 'Conflict' }));

        await startPolling();
        await startPolling(); // second call must not start a second loop
        for (let i = 0; i < 5; i++) await flush();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(update);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(String(fetchMock.mock.calls[1][0])).toContain('offset=11');
    });
});
