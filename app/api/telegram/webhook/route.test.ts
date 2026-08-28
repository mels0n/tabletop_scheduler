import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/shared/lib/prisma';
import { sendTelegramMessage } from '@/features/telegram/lib/telegram-client';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/telegram/lib/telegram-client', () => ({
    sendTelegramMessage: vi.fn(),
    getWebhookSecret: () => 'test-secret',
}));

const mockPrisma = prisma as unknown as {
    loginToken: { create: ReturnType<typeof vi.fn> },
    participant: { updateMany: ReturnType<typeof vi.fn> },
    event: { updateMany: ReturnType<typeof vi.fn> },
};

const sent = sendTelegramMessage as unknown as ReturnType<typeof vi.fn>;

/** Minimal stand-in for the Request the route receives from Telegram. */
function webhookRequest(body: any, secret: string | null = 'test-secret') {
    return {
        json: async () => body,
        headers: {
            get: (name: string) =>
                name.toLowerCase() === 'x-telegram-bot-api-secret-token' ? secret : null,
        },
    } as unknown as Request;
}

function message(text: string, chatType = 'private') {
    return {
        message: {
            text,
            chat: { id: 4242, type: chatType },
            from: { id: 4242, username: 'chris' },
        },
    };
}

describe('POST /api/telegram/webhook', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.TELEGRAM_BOT_TOKEN = 'test-token';
        mockPrisma.loginToken.create.mockResolvedValue({});
        mockPrisma.participant.updateMany.mockResolvedValue({ count: 0 });
        mockPrisma.event.updateMany.mockResolvedValue({ count: 0 });
    });

    describe('authentication', () => {
        it('rejects an update with no secret header', async () => {
            const res = await POST(webhookRequest(message('/start login'), null));

            expect(res.status).toBe(401);
            expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
            expect(sent).not.toHaveBeenCalled();
        });

        it('rejects an update with the wrong secret', async () => {
            const res = await POST(webhookRequest(message('/start login'), 'guessed'));

            expect(res.status).toBe(401);
            expect(sent).not.toHaveBeenCalled();
        });

        it('accepts an update carrying the registered secret', async () => {
            const res = await POST(webhookRequest(message('/start login')));

            expect(res.status).toBe(200);
        });
    });

    describe('/start handling', () => {
        it('issues a login link for /start login', async () => {
            await POST(webhookRequest(message('/start login')));

            expect(mockPrisma.loginToken.create).toHaveBeenCalledTimes(1);
            expect(sent).toHaveBeenCalledWith(4242, expect.stringContaining('/auth/login?token='), 'test-token');
        });

        // Regression: the deep-link payload can be dropped by the client, and a user
        // who finds the bot directly just presses START. Both arrive as a bare /start,
        // which used to fall through to a silent no-op.
        it('issues a login link for a bare /start in a private chat', async () => {
            await POST(webhookRequest(message('/start')));

            expect(mockPrisma.loginToken.create).toHaveBeenCalledTimes(1);
            expect(sent).toHaveBeenCalledWith(4242, expect.stringContaining('/auth/login?token='), 'test-token');
        });

        it('records the sender telegram handle on the login token', async () => {
            await POST(webhookRequest(message('/start')));

            expect(mockPrisma.loginToken.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ chatId: '4242', telegramUsername: 'chris' }),
                }),
            );
        });

        it('stays silent for a bare /start in a group', async () => {
            await POST(webhookRequest(message('/start', 'group')));

            expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
            expect(sent).not.toHaveBeenCalled();
        });
    });
});
