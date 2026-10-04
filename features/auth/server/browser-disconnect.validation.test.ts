import { describe, it, expect, vi, beforeEach } from 'vitest';
import { disconnectPlatformFromBrowser } from './browser-disconnect';
import { cookies } from 'next/headers';
import { signValue } from '@/shared/lib/session';

describe('disconnectPlatformFromBrowser validates its platform argument', () => {
    const mockCookieStore = { get: vi.fn(), delete: vi.fn() };

    beforeEach(() => {
        vi.resetAllMocks();
        (cookies as any).mockReturnValue(mockCookieStore);
        mockCookieStore.get.mockImplementation((name: string) => {
            if (name === 'tabletop_user_discord_id') return { value: signValue('identity:discord', 'discord-42') };
            if (name === 'tabletop_user_chat_id') return { value: signValue('identity:telegram', '999') };
            return undefined;
        });
    });

    it.each([
        ['an unknown platform', 'slack'],
        ['an empty string', ''],
        ['a number', 1],
        ['null', null],
        ['undefined', undefined],
        ['an object', { toString: () => 'discord' }],
        ['an array', ['discord']],
        ['an oversized string', 'discord'.repeat(100)],
    ])('rejects %s without reading or deleting any cookie', async (_label, platform) => {
        expect(await disconnectPlatformFromBrowser(platform as 'discord')).toEqual({ error: 'Invalid request.' });

        expect(cookies).not.toHaveBeenCalled();
        expect(mockCookieStore.get).not.toHaveBeenCalled();
        expect(mockCookieStore.delete).not.toHaveBeenCalled();
    });

    it.each(['telegram', 'discord'] as const)('still signs a valid %s identity out', async (platform) => {
        expect(await disconnectPlatformFromBrowser(platform)).toEqual({ success: true, message: expect.any(String) });
        expect(mockCookieStore.delete).toHaveBeenCalledTimes(2);
    });
});
