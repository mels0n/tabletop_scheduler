import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTelegramUpdate, resetProcessedUpdatesForTests } from './update-handler';
import prisma from '@/shared/lib/prisma';
import { sendTelegramMessage, pinChatMessage } from '@/features/telegram/lib/telegram-client';
import { connectCodeFor } from '@/features/telegram/model/connect-code';
import { hashToken } from '@/shared/lib/token';
import type { TelegramUpdate } from '@/features/telegram/model/types';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/telegram/lib/telegram-client', () => ({
    sendTelegramMessage: vi.fn(),
    pinChatMessage: vi.fn(),
}));

const mockPrisma = prisma as unknown as {
    event: {
        findUnique: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
    };
    participant: { updateMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
    loginToken: { create: ReturnType<typeof vi.fn> };
};
const sent = sendTelegramMessage as unknown as ReturnType<typeof vi.fn>;
const pinned = pinChatMessage as unknown as ReturnType<typeof vi.fn>;

const ADMIN_HASH = hashToken('real-admin-token');
const event = {
    id: 7,
    slug: 'abc123',
    title: 'Game Night',
    adminToken: ADMIN_HASH,
    managerTelegram: null,
    managerChatId: null,
    minPlayers: 2,
    timezone: 'UTC',
    timeSlots: [],
};

let nextUpdateId = 1;

function update(text: string, chatType = 'group', chatId = -1001, username = 'mallory'): TelegramUpdate {
    return {
        update_id: nextUpdateId++,
        message: { text, chat: { id: chatId, type: chatType }, from: { id: 4242, username } },
    };
}

/** Every event.update payload the handler wrote. */
function writes() {
    return mockPrisma.event.update.mock.calls.map((c) => c[0].data);
}

beforeEach(() => {
    vi.resetAllMocks();
    resetProcessedUpdatesForTests();
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    mockPrisma.event.findUnique.mockResolvedValue(event);
    mockPrisma.event.update.mockResolvedValue({});
    mockPrisma.event.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.participant.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.participant.count.mockResolvedValue(0);
    mockPrisma.loginToken.create.mockResolvedValue({});
    sent.mockResolvedValue(555);
});

describe('handleTelegramUpdate: idempotency', () => {
    it('processes a repeated update_id only once', async () => {
        const u = update('/start login', 'private', 4242, 'chris');

        await handleTelegramUpdate(u);
        await handleTelegramUpdate(u);

        expect(mockPrisma.loginToken.create).toHaveBeenCalledTimes(1);
        expect(sent).toHaveBeenCalledTimes(1);
    });

    it('still processes distinct update_ids', async () => {
        await handleTelegramUpdate(update('/start login', 'private', 4242, 'chris'));
        await handleTelegramUpdate(update('/start login', 'private', 4242, 'chris'));

        expect(mockPrisma.loginToken.create).toHaveBeenCalledTimes(2);
    });

    it('ignores updates without a text message', async () => {
        await handleTelegramUpdate({ update_id: nextUpdateId++ });

        expect(sent).not.toHaveBeenCalled();
    });
});

describe('handleTelegramUpdate: /connect', () => {
    it('binds the chat for /connect <slug> <valid code>, pins the dashboard, and never touches manager identity', async () => {
        const code = connectCodeFor('abc123', ADMIN_HASH);
        await handleTelegramUpdate(update(`/connect abc123 ${code}`));

        expect(writes()[0]).toEqual({ telegramChatId: '-1001' });
        expect(writes()).toContainEqual({ pinnedMessageId: 555 });
        expect(pinned).toHaveBeenCalledWith(-1001, 555, 'test-token');
        for (const data of writes()) {
            expect(data).not.toHaveProperty('managerTelegram');
            expect(data).not.toHaveProperty('managerChatId');
        }
    });

    it('rejects a wrong code and binds nothing', async () => {
        await handleTelegramUpdate(update('/connect abc123 deadbeef'));

        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(sent).toHaveBeenCalledWith(-1001, expect.stringMatching(/not valid/i), 'test-token');
    });

    it.each([
        ['bare /connect <slug>', '/connect abc123'],
        ['/start <slug> (startgroup payload)', '/start abc123'],
        ['a pasted event URL', 'join us at https://example.test/e/abc123 tonight'],
    ])('replies with instructions and binds nothing for %s', async (_label, text) => {
        await handleTelegramUpdate(update(text));

        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(sent).toHaveBeenCalledWith(-1001, expect.stringMatching(/manage page/i), 'test-token');
    });

    it('sends instructions in HTML, never markdown backticks', async () => {
        await handleTelegramUpdate(update('/connect abc123'));

        const text = sent.mock.calls[0][1] as string;
        expect(text).toContain('<code>');
        expect(text).not.toContain('`');
    });

    it('treats /start <slug> in a DM the same way (no claim, no bind)', async () => {
        await handleTelegramUpdate(update('/start abc123', 'private'));

        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('does not recognise the removed setup_recovery payload', async () => {
        await handleTelegramUpdate(update('/start setup_recovery_abc123_9999999999-a', 'group'));

        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });
});

describe('handleTelegramUpdate: /start', () => {
    it('issues a login link for /start login', async () => {
        await handleTelegramUpdate(update('/start login', 'private', 4242, 'chris'));

        expect(mockPrisma.loginToken.create).toHaveBeenCalledTimes(1);
        expect(sent).toHaveBeenCalledWith(4242, expect.stringContaining('/auth/login?token='), 'test-token');
    });

    // The deep-link payload can be dropped by the client, and a user who finds the bot
    // directly just presses START. Both arrive as a bare /start.
    it('issues a login link for a bare /start in a private chat', async () => {
        await handleTelegramUpdate(update('/start', 'private', 4242, 'chris'));

        expect(sent).toHaveBeenCalledWith(4242, expect.stringContaining('/auth/login?token='), 'test-token');
    });

    it('records the sender telegram handle on the login token', async () => {
        await handleTelegramUpdate(update('/start', 'private', 4242, 'chris'));

        expect(mockPrisma.loginToken.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ chatId: '4242', telegramUsername: 'chris' }) }),
        );
    });

    it.each(['/start login', '/start recover_handle'])('never posts a login link into a group for %s', async (text) => {
        await handleTelegramUpdate(update(text, 'supergroup', -1001, 'chris'));

        expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
        expect(sent).toHaveBeenCalledTimes(1);
        const reply = sent.mock.calls[0][1] as string;
        expect(sent.mock.calls[0][0]).toBe(-1001);
        expect(reply).not.toContain('/auth/login');
        expect(reply).toMatch(/private chat|direct message/i);
        expect(reply).not.toContain('—');
    });

    it('stays silent for a bare /start in a group', async () => {
        await handleTelegramUpdate(update('/start', 'group'));

        expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
        expect(sent).not.toHaveBeenCalled();
    });

    it('lets a valid short recovery token claim an event with no Telegram manager', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({
            ...event,
            recoveryToken: hashToken('cafef00d'),
            recoveryTokenExpires: new Date(Date.now() + 60_000),
        });

        await handleTelegramUpdate(update('/start rec_cafef00d', 'private'));

        expect(writes()).toContainEqual({ managerChatId: '4242', managerTelegram: 'mallory' });
    });

    it('escapes the event title in the recovery confirmation', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({
            ...event,
            title: '<a href="https://evil">x</a>',
            recoveryToken: hashToken('cafef00d'),
            recoveryTokenExpires: new Date(Date.now() + 60_000),
        });

        await handleTelegramUpdate(update('/start rec_cafef00d', 'private'));

        const text = sent.mock.calls.at(-1)?.[1] as string;
        expect(text).toContain('&lt;a href=&quot;https://evil&quot;&gt;x&lt;/a&gt;');
        expect(text).not.toContain('<a href="https://evil">');
    });
});

describe('handleTelegramUpdate: no passive identity capture', () => {
    it('does not set managerChatId or participant chatId for a user whose handle matches', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...event, managerTelegram: 'victim', managerChatId: null });

        await handleTelegramUpdate(update('hello everyone', 'group', -1001, 'victim'));
        await handleTelegramUpdate(update('/start login', 'private', 4242, 'victim'));

        expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
        for (const data of writes()) expect(data).not.toHaveProperty('managerChatId');
    });
});
