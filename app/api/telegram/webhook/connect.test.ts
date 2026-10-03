import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/shared/lib/prisma';
import { sendTelegramMessage } from '@/features/telegram/lib/telegram-client';
import { connectCodeFor } from '@/features/telegram/model/connect-code';
import { hashToken } from '@/shared/lib/token';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/telegram/lib/telegram-client', () => ({
    sendTelegramMessage: vi.fn(),
    pinChatMessage: vi.fn(),
    getWebhookSecret: () => 'test-secret',
}));

const mockPrisma = prisma as unknown as {
    event: {
        findUnique: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
    };
    participant: { updateMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
};
const sent = sendTelegramMessage as unknown as ReturnType<typeof vi.fn>;

const ADMIN_HASH = hashToken('real-admin-token');
const event = {
    id: 7,
    slug: 'abc123',
    title: 'Game Night',
    adminToken: ADMIN_HASH,
    managerTelegram: null,
    managerChatId: null,
    timeSlots: [],
};

function webhookRequest(body: unknown) {
    return {
        json: async () => body,
        headers: { get: (n: string) => (n.toLowerCase() === 'x-telegram-bot-api-secret-token' ? 'test-secret' : null) },
    } as unknown as Request;
}

function message(text: string, chatType = 'group') {
    return { message: { text, chat: { id: -1001, type: chatType }, from: { id: 4242, username: 'mallory' } } };
}

/** Every event.update payload the handler wrote. */
function writes() {
    return mockPrisma.event.update.mock.calls.map((c) => c[0].data);
}

describe('Telegram webhook: connecting a chat requires the manage-page code', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.TELEGRAM_BOT_TOKEN = 'test-token';
        mockPrisma.event.findUnique.mockResolvedValue(event);
        mockPrisma.event.update.mockResolvedValue({});
        mockPrisma.event.updateMany.mockResolvedValue({ count: 0 });
        mockPrisma.participant.updateMany.mockResolvedValue({ count: 0 });
        mockPrisma.participant.count.mockResolvedValue(0);
    });

    it('binds the chat for /connect <slug> <valid code> without touching manager identity', async () => {
        const code = connectCodeFor('abc123', ADMIN_HASH);
        await POST(webhookRequest(message(`/connect abc123 ${code}`)));

        expect(writes()[0]).toEqual({ telegramChatId: '-1001' });
        for (const data of writes()) {
            expect(data).not.toHaveProperty('managerTelegram');
            expect(data).not.toHaveProperty('managerChatId');
        }
    });

    it('rejects a wrong code and binds nothing', async () => {
        await POST(webhookRequest(message('/connect abc123 deadbeef')));

        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(sent).toHaveBeenCalledWith(-1001, expect.stringMatching(/not valid/i), 'test-token');
    });

    it.each([
        ['bare /connect <slug>', '/connect abc123'],
        ['/start <slug> (startgroup payload)', '/start abc123'],
        ['a pasted event URL', 'join us at https://example.test/e/abc123 tonight'],
    ])('replies with instructions and binds nothing for %s', async (_label, text) => {
        await POST(webhookRequest(message(text)));

        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(sent).toHaveBeenCalledWith(-1001, expect.stringMatching(/manage page/i), 'test-token');
    });

    it('treats /start <slug> in a DM the same way (no claim, no bind)', async () => {
        await POST(webhookRequest(message('/start abc123', 'private')));

        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('no longer recognises the removed setup_recovery payload', async () => {
        await POST(webhookRequest(message('/start setup_recovery_abc123_9999999999-a', 'group')));

        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('still lets a valid short recovery token claim an event with no Telegram manager', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({
            ...event,
            recoveryToken: hashToken('cafef00d'),
            recoveryTokenExpires: new Date(Date.now() + 60_000),
        });

        await POST(webhookRequest(message('/start rec_cafef00d', 'private')));

        expect(writes()).toContainEqual({ managerChatId: '4242', managerTelegram: 'mallory' });
    });
});
