import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unlinkPlatformEverywhere } from './identity-unlink';
import { cookies } from 'next/headers';
import { signValue } from '@/shared/lib/session';
import prisma from '@/shared/lib/prisma';

vi.mock('@/shared/lib/prisma');

const mockPrisma = prisma as unknown as {
    participant: { updateMany: ReturnType<typeof vi.fn> },
    event: { updateMany: ReturnType<typeof vi.fn> },
    loginToken: { deleteMany: ReturnType<typeof vi.fn> },
    dmPreference: { deleteMany: ReturnType<typeof vi.fn> },
    $transaction: ReturnType<typeof vi.fn>,
};

describe('unlinkPlatformEverywhere validates its platform argument', () => {
    const mockCookieStore = { get: vi.fn(), delete: vi.fn() };

    beforeEach(() => {
        vi.resetAllMocks();
        (cookies as any).mockReturnValue(mockCookieStore);
        mockPrisma.participant.updateMany.mockResolvedValue({ count: 0 });
        mockPrisma.event.updateMany.mockResolvedValue({ count: 0 });
        mockPrisma.loginToken.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.dmPreference.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
        // A signed identity exists for both platforms, so only validation can stop the call.
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
    ])('rejects %s without reading cookies or touching Prisma', async (_label, platform) => {
        expect(await unlinkPlatformEverywhere(platform as 'discord')).toEqual({ error: 'Invalid request.' });

        expect(cookies).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
        expect(mockCookieStore.delete).not.toHaveBeenCalled();
    });

    it.each(['telegram', 'discord'] as const)('still erases a valid %s identity', async (platform) => {
        const result = await unlinkPlatformEverywhere(platform);

        expect(result).toEqual({ success: true, message: expect.any(String) });
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
});
