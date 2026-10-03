import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/shared/lib/prisma';
import { sendDirectMessage } from '@/features/notifications';
import { verifyEventAdmin } from '@/features/auth/server/actions';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/actions', () => ({ verifyEventAdmin: vi.fn() }));
vi.mock('@/features/notifications', () => ({
    sendDirectMessage: vi.fn(),
    broadcastToEvent: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/shared/lib/url', () => ({ getBaseUrl: () => 'https://example.test' }));
vi.mock('@/shared/lib/eventMessage', () => ({
    buildFinalizedMessage: () => '<b>finalized</b>',
    buildCampaignFinalizedMessage: () => '<b>campaign finalized</b>',
}));
vi.mock('@/features/telegram', () => ({
    sendTelegramMessage: vi.fn(),
    deleteMessage: vi.fn(),
    pinChatMessage: vi.fn(),
}));
vi.mock('@/features/discord/model/discord', () => ({
    sendDiscordMessage: vi.fn(),
    pinDiscordMessage: vi.fn(),
    unpinDiscordMessage: vi.fn(),
    deleteDiscordMessage: vi.fn(),
}));

import * as telegram from '@/features/telegram';
import * as discord from '@/features/discord/model/discord';

const mockPrisma = prisma as any;
const mockSend = sendDirectMessage as unknown as ReturnType<typeof vi.fn>;

const createdAt = new Date('2026-01-01T00:00:00Z');
const discordOnlyVote = {
    participantId: 7,
    preference: 'YES',
    createdAt,
    participant: { id: 7, name: 'Dee', chatId: null, discordId: 'd-7' },
};

const finalizedEvent = {
    id: 1,
    slug: 'evt',
    title: 'Game Night',
    fromUrl: null,
    telegramChatId: '-100',
    pinnedMessageId: 5,
    discordChannelId: 'chan-1',
    discordMessageId: 'old-msg',
    timeSlots: [{ id: 3, startTime: createdAt, endTime: createdAt }],
    finalizedSlotId: 3,
};

function oneShotRequest() {
    const form = new FormData();
    form.set('slotId', '3');
    return { formData: async () => form, headers: new Headers() } as unknown as Request;
}

describe('POST /api/event/[slug]/finalize', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        (verifyEventAdmin as any).mockResolvedValue(true);
        process.env.TELEGRAM_BOT_TOKEN = 'tg-token';
        process.env.DISCORD_BOT_TOKEN = 'dc-token';
        mockPrisma.event.findUnique.mockResolvedValue({ id: 1, maxPlayers: 4, minPlayers: 1, title: 'Game Night', eventType: 'ONE_SHOT', minSessions: null });
        mockPrisma.vote.findMany.mockResolvedValue([discordOnlyVote]);
        mockPrisma.event.update.mockResolvedValue(finalizedEvent);
        mockPrisma.participant.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
        (telegram.sendTelegramMessage as any).mockResolvedValue(99);
        (discord.sendDiscordMessage as any).mockResolvedValue({ id: 'new-msg' });
    });

    it('DMs a Discord-only accepted participant', async () => {
        await POST(oneShotRequest(), { params: { slug: 'evt' } });

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend.mock.calls[0][0]).toEqual({ telegramChatId: null, discordUserId: 'd-7' });
        expect(mockSend.mock.calls[0][1].html).toContain('You made the cut!');
    });

    it('deletes the old Discord dashboard message after unpinning, then posts and stores the new one', async () => {
        await POST(oneShotRequest(), { params: { slug: 'evt' } });

        expect(discord.unpinDiscordMessage).toHaveBeenCalledWith('chan-1', 'old-msg', 'dc-token');
        expect(discord.deleteDiscordMessage).toHaveBeenCalledWith('chan-1', 'old-msg', 'dc-token');
        expect(discord.pinDiscordMessage).toHaveBeenCalledWith('chan-1', 'new-msg', 'dc-token');
        expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { discordMessageId: 'new-msg' } });
    });

    it('still announces on Discord when Telegram throws', async () => {
        (telegram.deleteMessage as any).mockRejectedValue(new Error('telegram down'));

        await POST(oneShotRequest(), { params: { slug: 'evt' } });

        expect(discord.sendDiscordMessage).toHaveBeenCalled();
        expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { discordMessageId: 'new-msg' } });
    });

    it('still announces on Telegram when Discord throws', async () => {
        (discord.unpinDiscordMessage as any).mockRejectedValue(new Error('discord down'));

        await POST(oneShotRequest(), { params: { slug: 'evt' } });

        expect(telegram.sendTelegramMessage).toHaveBeenCalled();
        expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { pinnedMessageId: 99 } });
    });
});
