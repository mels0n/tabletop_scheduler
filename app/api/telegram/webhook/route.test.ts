import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { handleTelegramUpdate } from '@/features/telegram/server/update-handler';

vi.mock('@/features/telegram/lib/telegram-client', () => ({
    getWebhookSecret: () => 'test-secret',
}));
vi.mock('@/features/telegram/server/update-handler', () => ({
    handleTelegramUpdate: vi.fn(),
}));

const handler = handleTelegramUpdate as unknown as ReturnType<typeof vi.fn>;

/** Minimal stand-in for the Request the route receives from Telegram. */
function webhookRequest(body: unknown, secret: string | null = 'test-secret', badJson = false) {
    return {
        json: async () => {
            if (badJson) throw new SyntaxError('Unexpected token');
            return body;
        },
        headers: {
            get: (name: string) =>
                name.toLowerCase() === 'x-telegram-bot-api-secret-token' ? secret : null,
        },
    } as unknown as Request;
}

const update = { update_id: 1, message: { text: '/start login', chat: { id: 4242, type: 'private' } } };

describe('POST /api/telegram/webhook', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    });

    describe('authentication', () => {
        it('rejects an update with no secret header', async () => {
            const res = await POST(webhookRequest(update, null));

            expect(res.status).toBe(401);
            expect(handler).not.toHaveBeenCalled();
        });

        it('rejects an update with the wrong secret', async () => {
            const res = await POST(webhookRequest(update, 'guessed'));

            expect(res.status).toBe(401);
            expect(handler).not.toHaveBeenCalled();
        });

        it('passes an authenticated update to the shared handler', async () => {
            const res = await POST(webhookRequest(update));

            expect(res.status).toBe(200);
            expect(handler).toHaveBeenCalledWith(update);
        });
    });

    // A non-2xx makes Telegram redeliver the update and re-run its side effects.
    describe('always 200 after authentication', () => {
        it('returns 200 when the handler throws', async () => {
            handler.mockRejectedValue(new Error('db down'));

            const res = await POST(webhookRequest(update));

            expect(res.status).toBe(200);
        });

        it('returns 200 for a body that is not JSON', async () => {
            const res = await POST(webhookRequest(null, 'test-secret', true));

            expect(res.status).toBe(200);
            expect(handler).not.toHaveBeenCalled();
        });
    });
});
