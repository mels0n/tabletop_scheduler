import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/actions', () => ({ verifyEventAdmin: vi.fn() }));
vi.mock('@/shared/lib/url', () => ({ getBaseUrl: vi.fn(() => 'https://example.test') }));
vi.mock('next/headers', () => ({ headers: vi.fn(() => new Headers()) }));
vi.mock('@/features/telegram', () => ({
    editMessageText: vi.fn(),
    unpinChatMessage: vi.fn(),
}));
vi.mock('@/features/telegram/lib/telegram-client', () => ({
    sendTelegramMessage: vi.fn(),
}));
vi.mock('@/features/integrations/discord/model/discord', () => ({
    sendDiscordMessage: vi.fn(),
    sendDiscordDM: vi.fn(),
    editDiscordMessage: vi.fn(),
    unpinDiscordMessage: vi.fn(),
}));

import { cancelEvent, deleteEvent } from './actions';
import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth/server/actions';
import { editMessageText, unpinChatMessage } from '@/features/telegram';
import { sendTelegramMessage } from '@/features/telegram/lib/telegram-client';
import { sendDiscordMessage, editDiscordMessage, unpinDiscordMessage } from '@/features/integrations/discord/model/discord';

const mockPrisma = prisma as unknown as {
    event: {
        findUnique: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
};

const event = {
    id: 1,
    slug: 's',
    title: 'Game Night',
    finalizedSlotId: null,
    telegramChatId: 'tg1',
    pinnedMessageId: 11,
    discordChannelId: 'dc1',
    discordMessageId: 'dm1',
    fromUrl: null,
};

describe('cancel / delete notify both platforms independently', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv('TELEGRAM_BOT_TOKEN', 'tg-token');
        vi.stubEnv('DISCORD_BOT_TOKEN', 'dc-token');
        (verifyEventAdmin as any).mockResolvedValue(true);
        mockPrisma.event.findUnique.mockResolvedValue(event);
        mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.event.delete.mockResolvedValue(event);
        mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
        (sendDiscordMessage as any).mockResolvedValue({ id: 'x' });
    });

    it('cancelEvent posts to Discord even when Telegram calls throw', async () => {
        (editMessageText as any).mockRejectedValue(new Error('tg down'));
        (sendTelegramMessage as any).mockRejectedValue(new Error('tg down'));
        const result = await cancelEvent('s');
        expect(result).toEqual({ success: true });
        expect(editDiscordMessage).toHaveBeenCalledWith('dc1', 'dm1', expect.stringContaining('Event Cancelled'), 'dc-token');
        expect(sendDiscordMessage).toHaveBeenCalledWith('dc1', expect.stringContaining('Event Cancelled'), 'dc-token');
    });

    it('cancelEvent works with only Discord linked and no Telegram token', async () => {
        vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
        mockPrisma.event.findUnique.mockResolvedValue({ ...event, telegramChatId: null, pinnedMessageId: null });
        await cancelEvent('s');
        expect(sendDiscordMessage).toHaveBeenCalled();
        expect(sendTelegramMessage).not.toHaveBeenCalled();
    });

    it('deleteEvent unpins and posts on Discord even when Telegram throws', async () => {
        (unpinChatMessage as any).mockRejectedValue(new Error('tg down'));
        (sendTelegramMessage as any).mockRejectedValue(new Error('tg down'));
        const result = await deleteEvent('s');
        expect(result).toEqual({ success: true });
        expect(unpinDiscordMessage).toHaveBeenCalledWith('dc1', 'dm1', 'dc-token');
        expect(sendDiscordMessage).toHaveBeenCalledWith('dc1', expect.stringContaining('Event Deleted'), 'dc-token');
    });

    it('cancelEvent is idempotent: a second call changes nothing and announces nothing', async () => {
        mockPrisma.event.updateMany.mockResolvedValue({ count: 0 });
        const result = await cancelEvent('s');
        expect(result).toEqual({ success: true });
        expect(mockPrisma.event.updateMany).toHaveBeenCalledWith({
            where: { id: 1, status: { not: 'CANCELLED' } },
            data: { status: 'CANCELLED' },
        });
        expect(editMessageText).not.toHaveBeenCalled();
        expect(editDiscordMessage).not.toHaveBeenCalled();
        expect(sendDiscordMessage).not.toHaveBeenCalled();
        expect(sendTelegramMessage).not.toHaveBeenCalled();
    });

    it('deleteEvent deletes with one event.delete and announces only after it', async () => {
        const result = await deleteEvent('s');
        expect(result).toEqual({ success: true });
        expect(mockPrisma.event.delete).toHaveBeenCalledTimes(1);
        expect(mockPrisma.event.delete).toHaveBeenCalledWith({ where: { id: 1 } });
        const deletedAt = mockPrisma.event.delete.mock.invocationCallOrder[0];
        const announcedAt = (sendDiscordMessage as any).mock.invocationCallOrder[0];
        expect(announcedAt).toBeGreaterThan(deletedAt);
    });

    it('deleteEvent announces nothing when the delete fails', async () => {
        mockPrisma.event.delete.mockRejectedValue(new Error('db down'));
        const result = await deleteEvent('s');
        expect(result).toEqual({ error: 'Failed to delete event' });
        expect(sendDiscordMessage).not.toHaveBeenCalled();
        expect(sendTelegramMessage).not.toHaveBeenCalled();
    });
});
