import { describe, it, expect, vi, beforeEach } from 'vitest';
import { disconnectPlatformFromBrowser } from './browser-disconnect';
import { cookies } from 'next/headers';
import prisma from '@/shared/lib/prisma';

vi.mock('@/shared/lib/prisma');

describe('disconnectPlatformFromBrowser', () => {
    const mockCookieStore = {
        get: vi.fn(),
        delete: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        (cookies as any).mockReturnValue(mockCookieStore);
    });

    it('clears only the Discord session cookies and never touches the database', async () => {
        mockCookieStore.get.mockImplementation((name: string) =>
            name === 'tabletop_user_discord_id' ? { value: 'discord-42' } : undefined
        );

        const result = await disconnectPlatformFromBrowser('discord');

        expect(result).toEqual({ success: true, message: expect.any(String) });
        expect(mockCookieStore.delete).toHaveBeenCalledWith('tabletop_user_discord_id');
        expect(mockCookieStore.delete).toHaveBeenCalledWith('tabletop_user_discord_name');
        expect(mockCookieStore.delete).toHaveBeenCalledTimes(2);
        // The whole point of this action vs. unlinkPlatformEverywhere: no DB access at all.
        for (const model of Object.values(prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)) {
            for (const method of Object.values(model ?? {})) {
                if (typeof method === 'function' && 'mock' in method) {
                    expect(method).not.toHaveBeenCalled();
                }
            }
        }
    });

    it('clears only the Telegram session cookies', async () => {
        mockCookieStore.get.mockImplementation((name: string) =>
            name === 'tabletop_user_chat_id' ? { value: '999' } : undefined
        );

        const result = await disconnectPlatformFromBrowser('telegram');

        expect(result).toEqual({ success: true, message: expect.any(String) });
        expect(mockCookieStore.delete).toHaveBeenCalledWith('tabletop_user_chat_id');
        expect(mockCookieStore.delete).toHaveBeenCalledWith('tabletop_user_telegram_name');
        expect(mockCookieStore.delete).toHaveBeenCalledTimes(2);
    });

    it('refuses without a session cookie and deletes nothing', async () => {
        mockCookieStore.get.mockReturnValue(undefined);

        const result = await disconnectPlatformFromBrowser('discord');

        expect(result).toEqual({ error: expect.any(String) });
        expect(mockCookieStore.delete).not.toHaveBeenCalled();
    });
});
