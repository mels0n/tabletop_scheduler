import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unlinkPlatformEverywhere } from './identity-unlink';
import { cookies } from 'next/headers';
import prisma from '@/shared/lib/prisma';

vi.mock('@/shared/lib/prisma');

const mockPrisma = prisma as unknown as {
    event: { updateMany: ReturnType<typeof vi.fn> },
    participant: { updateMany: ReturnType<typeof vi.fn> },
    loginToken: { deleteMany: ReturnType<typeof vi.fn> },
};

describe('unlinkPlatformEverywhere', () => {
    const mockCookieStore = {
        get: vi.fn(),
        delete: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        (cookies as any).mockReturnValue(mockCookieStore);
        mockPrisma.participant.updateMany.mockResolvedValue({ count: 2 });
        mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.loginToken.deleteMany.mockResolvedValue({ count: 1 });
    });

    it('wipes Discord identity from participants, managed events, and login tokens, then clears the session cookies', async () => {
        mockCookieStore.get.mockImplementation((name: string) =>
            name === 'tabletop_user_discord_id' ? { value: 'discord-42' } : undefined
        );

        const result = await unlinkPlatformEverywhere('discord');

        expect(result).toEqual({ success: true, message: expect.any(String) });
        expect(mockPrisma.participant.updateMany).toHaveBeenCalledWith({
            where: { discordId: 'discord-42' },
            data: { discordId: null, discordUsername: null }
        });
        expect(mockPrisma.event.updateMany).toHaveBeenCalledWith({
            where: { managerDiscordId: 'discord-42' },
            data: { managerDiscordId: null, managerDiscordUsername: null }
        });
        expect(mockPrisma.loginToken.deleteMany).toHaveBeenCalledWith({
            where: { discordId: 'discord-42' }
        });
        expect(mockCookieStore.delete).toHaveBeenCalledWith('tabletop_user_discord_id');
        expect(mockCookieStore.delete).toHaveBeenCalledWith('tabletop_user_discord_name');
    });

    it('wipes Telegram identity (verified chatId) from participants, managed events, and login tokens, then clears the session cookies', async () => {
        mockCookieStore.get.mockImplementation((name: string) =>
            name === 'tabletop_user_chat_id' ? { value: '999' } : undefined
        );

        const result = await unlinkPlatformEverywhere('telegram');

        expect(result).toEqual({ success: true, message: expect.any(String) });
        expect(mockPrisma.participant.updateMany).toHaveBeenCalledWith({
            where: { chatId: '999' },
            data: { chatId: null }
        });
        expect(mockPrisma.event.updateMany).toHaveBeenCalledWith({
            where: { managerChatId: '999' },
            data: { managerChatId: null }
        });
        expect(mockPrisma.loginToken.deleteMany).toHaveBeenCalledWith({
            where: { chatId: '999' }
        });
        expect(mockCookieStore.delete).toHaveBeenCalledWith('tabletop_user_chat_id');
        expect(mockCookieStore.delete).toHaveBeenCalledWith('tabletop_user_telegram_name');
    });

    it('refuses without a verified session cookie and performs no writes', async () => {
        mockCookieStore.get.mockReturnValue(undefined);

        const result = await unlinkPlatformEverywhere('discord');

        expect(result).toEqual({ error: expect.any(String) });
        expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.loginToken.deleteMany).not.toHaveBeenCalled();
        expect(mockCookieStore.delete).not.toHaveBeenCalled();
    });
});
