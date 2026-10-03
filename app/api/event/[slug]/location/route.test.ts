import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/actions', () => ({ verifyEventAdmin: vi.fn() }));
vi.mock('@/features/telegram', () => ({ editMessageText: vi.fn(), sendTelegramMessage: vi.fn(), pinChatMessage: vi.fn() }));
vi.mock('@/features/discord/model/discord', () => ({
    sendDiscordMessage: vi.fn(),
    editDiscordMessage: vi.fn(),
    pinDiscordMessage: vi.fn(),
}));
vi.mock('@/shared/lib/eventMessage', () => ({ buildFinalizedMessage: vi.fn(() => '<b>Finalized</b>') }));
vi.mock('@/shared/lib/url', () => ({ getBaseUrl: vi.fn(() => 'https://example.test') }));

import { POST } from './route';
import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth/server/actions';
import { editMessageText, sendTelegramMessage, pinChatMessage } from '@/features/telegram';
import { sendDiscordMessage, editDiscordMessage, pinDiscordMessage } from '@/features/discord/model/discord';

const mockPrisma = prisma as unknown as { event: { update: ReturnType<typeof vi.fn> } };
const event = {
    id: 7,
    slug: 's',
    location: 'New place',
    finalizedSlotId: 3,
    timeSlots: [{ id: 3 }],
    telegramChatId: 'tg1',
    pinnedMessageId: 11,
    discordChannelId: 'dc1',
    discordMessageId: 'dm1',
};

const call = () =>
    POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ location: 'New place' }) }), { params: Promise.resolve({ slug: 's' }) });

describe('location update dashboard sync', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv('TELEGRAM_BOT_TOKEN', 'tg-token');
        vi.stubEnv('DISCORD_BOT_TOKEN', 'dc-token');
        (verifyEventAdmin as any).mockResolvedValue(true);
        mockPrisma.event.update.mockResolvedValue(event);
    });

    it('edits the Discord dashboard message in place', async () => {
        (editDiscordMessage as any).mockResolvedValue(true);
        (editMessageText as any).mockResolvedValue(true);
        const res = await call();
        expect(res.status).toBe(200);
        expect(editDiscordMessage).toHaveBeenCalledWith('dc1', 'dm1', expect.stringContaining('Finalized'), 'dc-token');
        expect(editMessageText).toHaveBeenCalledWith('tg1', 11, '<b>Finalized</b>', 'tg-token');
        expect(sendDiscordMessage).not.toHaveBeenCalled();
        expect(sendTelegramMessage).not.toHaveBeenCalled();
    });

    it('falls back to post + pin + store when the Telegram edit fails', async () => {
        (editMessageText as any).mockResolvedValue(false);
        (sendTelegramMessage as any).mockResolvedValue(12);
        (editDiscordMessage as any).mockResolvedValue(true);
        await call();
        expect(sendTelegramMessage).toHaveBeenCalledWith('tg1', '<b>Finalized</b>', 'tg-token');
        expect(pinChatMessage).toHaveBeenCalledWith('tg1', 12, 'tg-token');
        expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { pinnedMessageId: 12 } });
    });

    it('falls back to post + pin + store when the Discord edit fails', async () => {
        (editDiscordMessage as any).mockResolvedValue(false);
        (sendDiscordMessage as any).mockResolvedValue({ id: 'dm2' });
        await call();
        expect(sendDiscordMessage).toHaveBeenCalledWith('dc1', expect.stringContaining('Finalized'), 'dc-token');
        expect(pinDiscordMessage).toHaveBeenCalledWith('dc1', 'dm2', 'dc-token');
        expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { discordMessageId: 'dm2' } });
    });

    it('still syncs Discord when the Telegram edit throws', async () => {
        (editMessageText as any).mockRejectedValue(new Error('boom'));
        (editDiscordMessage as any).mockResolvedValue(true);
        const res = await call();
        expect(res.status).toBe(200);
        expect(editDiscordMessage).toHaveBeenCalled();
    });
});
