import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/telegram', () => ({
    editMessageText: vi.fn(),
    sendTelegramMessage: vi.fn(),
    pinChatMessage: vi.fn(),
    unpinChatMessage: vi.fn(),
}));
vi.mock('@/features/notifications', () => ({ broadcastToEvent: vi.fn() }));
vi.mock('@/shared/lib/url', () => ({ getBaseUrl: () => 'https://example.test' }));
vi.mock('@/shared/lib/status', () => ({ generateStatusMessage: () => 'status' }));
vi.mock('@/features/integrations/discord/model/discord', () => ({
    editDiscordMessage: vi.fn(),
    sendDiscordMessage: vi.fn(),
    pinDiscordMessage: vi.fn(),
    unpinDiscordMessage: vi.fn(),
}));

import prisma from '@/shared/lib/prisma';
import { refreshTelegramDashboard, refreshDiscordDashboard, pushSlotUpdates } from './dashboard-sync';
import { broadcastToEvent } from '@/features/notifications';
import { editMessageText, sendTelegramMessage, pinChatMessage, unpinChatMessage } from '@/features/telegram';
import { editDiscordMessage, sendDiscordMessage, pinDiscordMessage, unpinDiscordMessage } from '@/features/integrations/discord/model/discord';

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const update = (prisma as any).event.update as ReturnType<typeof vi.fn>;

describe('refreshTelegramDashboard: EditResult matrix', () => {
    const event = { telegramChatId: 'tg1', pinnedMessageId: 11 };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv('TELEGRAM_BOT_TOKEN', 'tg-token');
        m(sendTelegramMessage).mockResolvedValue(12);
    });

    it('edited: no repost', async () => {
        m(editMessageText).mockResolvedValue('edited');
        await refreshTelegramDashboard(event, 7, '<b>x</b>');
        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(pinChatMessage).not.toHaveBeenCalled();
    });

    it('failed (rate limit, 5xx, timeout): no repost, no pin, id kept', async () => {
        m(editMessageText).mockResolvedValue('failed');
        await refreshTelegramDashboard(event, 7, '<b>x</b>');
        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(pinChatMessage).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('gone: reposts, unpins the old id before pinning the new one, stores the new id', async () => {
        m(editMessageText).mockResolvedValue('gone');
        await refreshTelegramDashboard(event, 7, '<b>x</b>');
        expect(sendTelegramMessage).toHaveBeenCalledWith('tg1', '<b>x</b>', 'tg-token');
        expect(unpinChatMessage).toHaveBeenCalledWith('tg1', 11, 'tg-token');
        expect(pinChatMessage).toHaveBeenCalledWith('tg1', 12, 'tg-token');
        expect(m(unpinChatMessage).mock.invocationCallOrder[0]).toBeLessThan(m(pinChatMessage).mock.invocationCallOrder[0]);
        expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { pinnedMessageId: 12 } });
    });

    it('gone: an unpin failure does not stop the new pin', async () => {
        m(editMessageText).mockResolvedValue('gone');
        m(unpinChatMessage).mockRejectedValue(new Error('nope'));
        await refreshTelegramDashboard(event, 7, '<b>x</b>');
        expect(pinChatMessage).toHaveBeenCalledWith('tg1', 12, 'tg-token');
        expect(update).toHaveBeenCalled();
    });

    it('no stored dashboard: posts and pins without unpinning', async () => {
        await refreshTelegramDashboard({ telegramChatId: 'tg1', pinnedMessageId: null }, 7, '<b>x</b>');
        expect(editMessageText).not.toHaveBeenCalled();
        expect(unpinChatMessage).not.toHaveBeenCalled();
        expect(pinChatMessage).toHaveBeenCalledWith('tg1', 12, 'tg-token');
    });
});

describe('refreshDiscordDashboard: EditResult matrix', () => {
    const event = { discordChannelId: 'dc1', discordMessageId: 'dm1' };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv('DISCORD_BOT_TOKEN', 'dc-token');
        m(sendDiscordMessage).mockResolvedValue({ id: 'dm2' });
    });

    it('edited: no repost', async () => {
        m(editDiscordMessage).mockResolvedValue('edited');
        await refreshDiscordDashboard(event, 7, '<b>x</b>');
        expect(sendDiscordMessage).not.toHaveBeenCalled();
    });

    it('failed: no repost, no pin, id kept', async () => {
        m(editDiscordMessage).mockResolvedValue('failed');
        await refreshDiscordDashboard(event, 7, '<b>x</b>');
        expect(sendDiscordMessage).not.toHaveBeenCalled();
        expect(pinDiscordMessage).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('gone: reposts, unpins the old id before pinning the new one, stores the new id', async () => {
        m(editDiscordMessage).mockResolvedValue('gone');
        await refreshDiscordDashboard(event, 7, '<b>x</b>');
        expect(sendDiscordMessage).toHaveBeenCalledWith('dc1', expect.stringContaining('x'), 'dc-token');
        expect(unpinDiscordMessage).toHaveBeenCalledWith('dc1', 'dm1', 'dc-token');
        expect(pinDiscordMessage).toHaveBeenCalledWith('dc1', 'dm2', 'dc-token');
        expect(m(unpinDiscordMessage).mock.invocationCallOrder[0]).toBeLessThan(m(pinDiscordMessage).mock.invocationCallOrder[0]);
        expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { discordMessageId: 'dm2' } });
    });

    it('gone: an unpin failure does not stop the new pin', async () => {
        m(editDiscordMessage).mockResolvedValue('gone');
        m(unpinDiscordMessage).mockRejectedValue(new Error('nope'));
        await refreshDiscordDashboard(event, 7, '<b>x</b>');
        expect(pinDiscordMessage).toHaveBeenCalledWith('dc1', 'dm2', 'dc-token');
    });
});

describe('pushSlotUpdates', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('escapes the event title in the announcement', async () => {
        (prisma as any).event.findUnique.mockResolvedValue({
            id: 7,
            title: '<a href="https://evil">x</a>',
            status: 'ACTIVE',
            finalizedSlotId: null,
            timeSlots: [],
            finalizedHost: null,
            telegramChatId: null,
            pinnedMessageId: null,
            discordChannelId: null,
            discordMessageId: null,
        });
        (prisma as any).participant.count.mockResolvedValue(0);

        await pushSlotUpdates(7, 'A new time option was added by the creator');

        const html = m(broadcastToEvent).mock.calls[0][1].html as string;
        expect(html).toContain('&lt;a href=&quot;https://evil&quot;&gt;x&lt;/a&gt;');
        expect(html).not.toContain('<a href');
    });
});
