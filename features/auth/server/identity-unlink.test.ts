import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unlinkPlatformEverywhere } from './identity-unlink';
import { cookies } from 'next/headers';
import { signValue } from '@/shared/lib/session';
import prisma from '@/shared/lib/prisma';

vi.mock('@/shared/lib/prisma');

const mockPrisma = prisma as unknown as {
    event: { updateMany: ReturnType<typeof vi.fn> },
    participant: { updateMany: ReturnType<typeof vi.fn> },
    loginToken: { deleteMany: ReturnType<typeof vi.fn> },
    dmPreference: { deleteMany: ReturnType<typeof vi.fn> },
    $transaction: ReturnType<typeof vi.fn>,
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
        mockPrisma.dmPreference.deleteMany.mockResolvedValue({ count: 1 });
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
    });

    it('wipes Discord identity from participants, managed events, and login tokens, then clears the session cookies', async () => {
        mockCookieStore.get.mockImplementation((name: string) =>
            name === 'tabletop_user_discord_id' ? { value: signValue('identity:discord', 'discord-42') } : undefined
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

    it('deletes only the Discord DM preference row, not the Telegram one', async () => {
        mockCookieStore.get.mockImplementation((name: string) =>
            name === 'tabletop_user_discord_id' ? { value: signValue('identity:discord', 'discord-42') } : undefined
        );

        await unlinkPlatformEverywhere('discord');

        expect(mockPrisma.dmPreference.deleteMany).toHaveBeenCalledTimes(1);
        expect(mockPrisma.dmPreference.deleteMany).toHaveBeenCalledWith({
            where: { platform: 'discord', platformId: 'discord-42' }
        });
    });

    it('runs every wipe inside one transaction', async () => {
        mockCookieStore.get.mockImplementation((name: string) =>
            name === 'tabletop_user_discord_id' ? { value: signValue('identity:discord', 'discord-42') } : undefined
        );
        const tx = {
            participant: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
            event: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
            loginToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
            dmPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        };
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx));

        await unlinkPlatformEverywhere('discord');

        expect(tx.participant.updateMany).toHaveBeenCalled();
        expect(tx.event.updateMany).toHaveBeenCalled();
        expect(tx.loginToken.deleteMany).toHaveBeenCalled();
        expect(tx.dmPreference.deleteMany).toHaveBeenCalled();
        expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.dmPreference.deleteMany).not.toHaveBeenCalled();
    });

    it('refuses a forged unsigned Discord identity cookie and touches nothing', async () => {
        mockCookieStore.get.mockImplementation((name: string) =>
            name === 'tabletop_user_discord_id' ? { value: 'discord-42' } : undefined
        );

        const result = await unlinkPlatformEverywhere('discord');

        expect(result).toEqual({ error: expect.any(String) });
        expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.loginToken.deleteMany).not.toHaveBeenCalled();
    });

    it('wipes Telegram identity (verified chatId) from participants, managed events, and login tokens, then clears the session cookies', async () => {
        mockCookieStore.get.mockImplementation((name: string) =>
            name === 'tabletop_user_chat_id' ? { value: signValue('identity:telegram', '999') } : undefined
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

    it('deletes only the Telegram DM preference row, not the Discord one', async () => {
        mockCookieStore.get.mockImplementation((name: string) =>
            name === 'tabletop_user_chat_id' ? { value: signValue('identity:telegram', '999') } : undefined
        );

        await unlinkPlatformEverywhere('telegram');

        expect(mockPrisma.dmPreference.deleteMany).toHaveBeenCalledTimes(1);
        expect(mockPrisma.dmPreference.deleteMany).toHaveBeenCalledWith({
            where: { platform: 'telegram', platformId: '999' }
        });
    });

    it('refuses without a verified session cookie and performs no writes', async () => {
        mockCookieStore.get.mockReturnValue(undefined);

        const result = await unlinkPlatformEverywhere('discord');

        expect(result).toEqual({ error: expect.any(String) });
        expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.loginToken.deleteMany).not.toHaveBeenCalled();
        expect(mockPrisma.dmPreference.deleteMany).not.toHaveBeenCalled();
        expect(mockCookieStore.delete).not.toHaveBeenCalled();
    });
});
