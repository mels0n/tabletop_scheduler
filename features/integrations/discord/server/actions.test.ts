import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendDiscordMagicLogin } from './actions';
import prisma from '@/shared/lib/prisma';
import { createDMChannel, sendDiscordMessage } from '@/features/discord/model/discord';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/discord/model/discord', () => ({
    getDiscordUser: vi.fn(),
    sendDiscordMessage: vi.fn(),
    pinDiscordMessage: vi.fn(),
    getGuildChannels: vi.fn(),
    createDMChannel: vi.fn(),
}));
vi.mock('@/features/event-management/server/recovery', () => ({
    generateManagerMagicLink: vi.fn(),
}));

const mockPrisma = prisma as unknown as {
    participant: { findFirst: ReturnType<typeof vi.fn>, findMany: ReturnType<typeof vi.fn> },
    event: { findFirst: ReturnType<typeof vi.fn>, findMany: ReturnType<typeof vi.fn> },
    loginToken: { create: ReturnType<typeof vi.fn>, findFirst: ReturnType<typeof vi.fn> },
};
const mockCreateDM = createDMChannel as unknown as ReturnType<typeof vi.fn>;
const mockSendMessage = sendDiscordMessage as unknown as ReturnType<typeof vi.fn>;

describe('sendDiscordMagicLogin — username matching hardening', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.DISCORD_BOT_TOKEN = 'test-bot-token';

        // Defaults: no linked rows, no cooldown, happy DM transport.
        mockPrisma.participant.findMany.mockResolvedValue([]);
        mockPrisma.event.findMany.mockResolvedValue([]);
        mockPrisma.loginToken.findFirst.mockResolvedValue(null);
        mockPrisma.loginToken.create.mockResolvedValue({});
        mockCreateDM.mockResolvedValue({ id: 'dm-channel-1' });
        mockSendMessage.mockResolvedValue({ id: 'msg-1' });

        // Simulate what the old `contains` DB queries would have returned, so these
        // tests fail loudly while the implementation still substring-matches.
        mockPrisma.participant.findFirst.mockResolvedValue({ discordId: 'partial-victim', discordUsername: 'Daniel' });
        mockPrisma.event.findFirst.mockResolvedValue(null);
    });

    it('does not DM anyone for a partial username match', async () => {
        mockPrisma.participant.findMany.mockResolvedValue([
            { discordId: 'partial-victim', discordUsername: 'Daniel' },
        ]);

        const result = await sendDiscordMagicLogin('dan');

        expect(result.success).toBe(false);
        expect(mockCreateDM).not.toHaveBeenCalled();
        expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('does not match against participant display names', async () => {
        // Old code also substring-matched the free-text `name` column.
        mockPrisma.participant.findFirst.mockResolvedValue({ discordId: 'name-victim', discordUsername: 'zzz' });
        mockPrisma.participant.findMany.mockResolvedValue([
            { discordId: 'name-victim', discordUsername: 'zzz' },
        ]);

        const result = await sendDiscordMagicLogin('dan');

        expect(result.success).toBe(false);
        expect(mockCreateDM).not.toHaveBeenCalled();
    });

    it('sends a magic login DM for an exact username match (case-insensitive, @-tolerant)', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue(null);
        mockPrisma.participant.findMany.mockResolvedValue([
            { discordId: 'exact-user', discordUsername: 'Daniel' },
        ]);

        const result = await sendDiscordMagicLogin('@daniel');

        expect(result.success).toBe(true);
        expect(mockPrisma.loginToken.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ discordId: 'exact-user' }),
        }));
        expect(mockCreateDM).toHaveBeenCalledWith('exact-user', 'test-bot-token');
        expect(mockSendMessage).toHaveBeenCalled();
    });

    it('falls back to an exact match on event manager usernames', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue(null);
        mockPrisma.event.findMany.mockResolvedValue([
            { managerDiscordId: 'manager-9', managerDiscordUsername: 'GmSteve' },
        ]);

        const result = await sendDiscordMagicLogin('gmsteve');

        expect(result.success).toBe(true);
        expect(mockCreateDM).toHaveBeenCalledWith('manager-9', 'test-bot-token');
    });

    it('refuses to send another link while a recent one is still cooling down', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue(null);
        mockPrisma.participant.findMany.mockResolvedValue([
            { discordId: 'exact-user', discordUsername: 'Daniel' },
        ]);
        mockPrisma.loginToken.findFirst.mockResolvedValue({ createdAt: new Date() });

        const result = await sendDiscordMagicLogin('daniel');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/wait/i);
        expect(mockCreateDM).not.toHaveBeenCalled();
        expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
    });
});
