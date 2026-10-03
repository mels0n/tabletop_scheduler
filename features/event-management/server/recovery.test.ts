import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recoverManagerLink, dmManagerLink } from './recovery';
import prisma from '@/shared/lib/prisma';
import { sendDirectMessage } from '@/features/notifications';

vi.mock('@/shared/lib/prisma');
vi.mock('next/headers', () => ({ headers: vi.fn(() => new Headers()) }));
vi.mock('@/shared/lib/url', () => ({ getBaseUrl: vi.fn(() => 'https://example.test') }));
vi.mock('@/features/notifications', () => ({
    sendDirectMessage: vi.fn(),
    isDelivered: (r: { telegram: { status: string }; discord: { status: string } }) =>
        r.telegram.status === 'sent' || r.discord.status === 'sent',
}));

const mockPrisma = prisma as unknown as {
    event: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};
const mockSend = sendDirectMessage as unknown as ReturnType<typeof vi.fn>;

const skipped = { status: 'skipped', reason: 'not_linked' };
const sent = { status: 'sent', messageId: '1' };

const discordOnlyEvent = {
    slug: 'abc',
    title: 'Game Night',
    managerTelegram: null,
    managerChatId: null,
    managerDiscordId: 'd-123',
    managerDiscordUsername: 'GmSteve',
};

describe('manager recovery (platform-neutral)', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockPrisma.event.update.mockResolvedValue({});
        mockSend.mockResolvedValue({ telegram: skipped, discord: sent });
    });

    it('DMs a Discord-only manager via one-click recovery', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

        const res = await dmManagerLink('abc');

        expect(res).toMatchObject({ success: true });
        expect(mockSend).toHaveBeenCalledWith(
            { telegramChatId: null, discordUserId: 'd-123' },
            expect.objectContaining({ html: expect.stringContaining('/api/event/abc/auth?token=') }),
            expect.anything()
        );
    });

    it('matches a Discord username case-insensitively, ignoring a leading @', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

        const res = await recoverManagerLink('abc', '@gmsteve');

        expect(res).toMatchObject({ success: true, message: expect.stringContaining('Discord') });
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('rejects a non-matching handle without rotating the token or sending', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

        const res = await recoverManagerLink('abc', 'someoneelse');

        expect(res).toHaveProperty('error');
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('sends to both platforms when the manager linked both', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({
            ...discordOnlyEvent, managerTelegram: '@steve_tg', managerChatId: '555',
        });
        mockSend.mockResolvedValue({ telegram: sent, discord: sent });

        const res = await recoverManagerLink('abc', 'steve_tg');

        expect(mockSend).toHaveBeenCalledWith(
            { telegramChatId: '555', discordUserId: 'd-123' },
            expect.anything(),
            expect.anything()
        );
        expect(res).toMatchObject({ success: true, message: expect.stringContaining('Telegram and Discord') });
    });

    it('reports an error when no platform delivered', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);
        mockSend.mockResolvedValue({ telegram: skipped, discord: { status: 'failed', error: 'blocked' } });

        const res = await dmManagerLink('abc');

        expect(res).toHaveProperty('error');
    });

    it('errors when no manager is linked at all', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({
            ...discordOnlyEvent, managerDiscordId: null, managerDiscordUsername: null,
        });

        expect(await dmManagerLink('abc')).toHaveProperty('error');
        expect(mockSend).not.toHaveBeenCalled();
    });
});
