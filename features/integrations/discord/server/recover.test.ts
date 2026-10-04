import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recoverDiscordManagerLink } from './actions';
import prisma from '@/shared/lib/prisma';
import { sendDirectMessage } from '@/features/notifications';
import { verifyEventAdmin } from '@/features/auth/server/verify';

// Runs the real recovery module: the public typed-username path must deliver to the stored
// manager without the caller being the event admin.
vi.mock('@/shared/lib/prisma');
vi.mock('@/features/integrations/discord/model/discord', () => ({
    getDiscordUser: vi.fn(),
    sendDiscordMessage: vi.fn(),
    pinDiscordMessage: vi.fn(),
    getGuildChannels: vi.fn(),
    createDMChannel: vi.fn(),
}));
vi.mock('@/features/notifications', () => ({
    sendDirectMessage: vi.fn(),
    isDelivered: (r: { telegram: { status: string }; discord: { status: string } }) =>
        r.telegram.status === 'sent' || r.discord.status === 'sent',
}));
vi.mock('@/features/auth/server/verify', async () => {
    const { ForbiddenError } = await import('@/shared/errors');
    const verifyEventAdmin = vi.fn();
    return {
        verifyEventAdmin,
        requireEventAdmin: async (slug: string) => {
            if (!(await verifyEventAdmin(slug))) throw new ForbiddenError();
        },
    };
});

const mockPrisma = prisma as unknown as {
    event: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    loginToken: {
        create: ReturnType<typeof vi.fn>;
        findFirst: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
        deleteMany: ReturnType<typeof vi.fn>;
    };
};
const mockSend = sendDirectMessage as unknown as ReturnType<typeof vi.fn>;
const mockAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;

const event = {
    id: 1,
    slug: 'abc',
    title: 'Game Night',
    managerTelegram: null,
    managerChatId: null,
    managerDiscordId: '123456789012345678',
    managerDiscordUsername: 'GmSteve',
};

describe('recoverDiscordManagerLink', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockAdmin.mockResolvedValue(false);
        mockPrisma.event.findUnique.mockResolvedValue(event);
        mockPrisma.loginToken.findFirst.mockResolvedValue(null);
        mockPrisma.loginToken.create.mockResolvedValue({});
        mockPrisma.loginToken.count.mockResolvedValue(1);
        mockPrisma.loginToken.deleteMany.mockResolvedValue({ count: 0 });
        mockSend.mockResolvedValue({ telegram: { status: 'skipped', reason: 'not_linked' }, discord: { status: 'sent', messageId: '1' } });
    });

    it('delivers the login link to the stored manager for a matching handle, without admin', async () => {
        const res = await recoverDiscordManagerLink('abc', '@gmsteve');

        expect(res).toMatchObject({ success: true });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(
            { telegramChatId: null, discordUserId: '123456789012345678' },
            expect.objectContaining({ html: expect.stringContaining('/auth/login?token=') }),
            expect.anything(),
            // A requested login link is transactional: the DM opt-out never blocks it.
            { respectOptOut: false }
        );
    });

    it('sends nothing for a handle that does not match', async () => {
        const res = await recoverDiscordManagerLink('abc', 'someoneelse');

        expect(res).toHaveProperty('error');
        expect(mockSend).not.toHaveBeenCalled();
        expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
    });
});
