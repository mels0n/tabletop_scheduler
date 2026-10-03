import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cookies } from 'next/headers';
import prisma from '@/shared/lib/prisma';
import { signValue } from '@/shared/lib/session';
import { setDmPreference } from './dm-preference';
import { getDmPreferences } from './dm-preference-read';

vi.mock('@/shared/lib/prisma');

const mockUpsert = prisma.dmPreference.upsert as unknown as ReturnType<typeof vi.fn>;
const mockFind = prisma.dmPreference.findUnique as unknown as ReturnType<typeof vi.fn>;

function withCookies(values: Record<string, string>) {
    (cookies as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        get: (name: string) => (name in values ? { value: values[name] } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
    });
}

const signedDiscord = { tabletop_user_discord_id: signValue('identity:discord', 'discord-42') };
const signedTelegram = { tabletop_user_chat_id: signValue('identity:telegram', '777') };

describe('setDmPreference', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('refuses a platform that is not linked on this browser', async () => {
        withCookies(signedDiscord);

        const result = await setDmPreference('telegram', true);

        expect(result).toEqual({ error: expect.any(String), status: 403 });
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('refuses an unsigned identity cookie', async () => {
        withCookies({ tabletop_user_discord_id: 'discord-42' });

        const result = await setDmPreference('discord', true);

        expect(result).toEqual({ error: expect.any(String), status: 403 });
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('rejects input that is not a known platform and a boolean', async () => {
        withCookies(signedDiscord);

        expect(await setDmPreference('email' as never, true)).toEqual({ error: expect.any(String), status: 400 });
        expect(await setDmPreference('discord', 'yes' as never)).toEqual({ error: expect.any(String), status: 400 });
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('stores the preference for the verified identity of a linked platform', async () => {
        withCookies(signedDiscord);
        mockUpsert.mockResolvedValue({});

        const result = await setDmPreference('discord', true);

        expect(result).toEqual({ success: true, optOut: true });
        expect(mockUpsert).toHaveBeenCalledWith({
            where: { platform_platformId: { platform: 'discord', platformId: 'discord-42' } },
            create: { platform: 'discord', platformId: 'discord-42', dmOptOut: true },
            update: { dmOptOut: true },
        });
    });

    it('reports a storage failure without throwing', async () => {
        withCookies(signedDiscord);
        mockUpsert.mockRejectedValue(new Error('db down'));

        expect(await setDmPreference('discord', false)).toEqual({ error: expect.any(String), status: 500 });
    });
});

describe('getDmPreferences', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns null for unlinked platforms and the stored flag for linked ones', async () => {
        withCookies(signedTelegram);
        mockFind.mockResolvedValue({ dmOptOut: true });

        expect(await getDmPreferences()).toEqual({ telegram: true, discord: null });
        expect(mockFind).toHaveBeenCalledTimes(1);
    });

    it('reads a linked platform with no stored row as not opted out', async () => {
        withCookies({ ...signedTelegram, ...signedDiscord });
        mockFind.mockResolvedValue(null);

        expect(await getDmPreferences()).toEqual({ telegram: false, discord: false });
    });
});
