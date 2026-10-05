import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    connectDiscordChannel,
    listDiscordChannels,
    recoverDiscordManagerLink,
    dmDiscordManagerLink,
} from './actions';
import prisma from '@/shared/lib/prisma';
import { getGuildChannels } from '@/features/integrations/discord/model/discord';
import { dmManagerLink, recoverManagerLink } from '@/features/event-management/server/recovery';
import { verifyEventAdmin } from '@/features/auth/server/verify';
import { cookies } from 'next/headers';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/integrations/discord/model/discord', () => ({
    getDiscordUser: vi.fn(),
    sendDiscordMessage: vi.fn(),
    pinDiscordMessage: vi.fn(),
    getGuildChannels: vi.fn(),
}));
vi.mock('@/features/event-management/server/recovery', () => ({
    dmManagerLink: vi.fn(),
    recoverManagerLink: vi.fn(),
}));
// requireEventAdmin keeps its real contract on top of the mocked verifyEventAdmin.
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
    participant: { findFirst: ReturnType<typeof vi.fn>, findMany: ReturnType<typeof vi.fn> },
    event: { findFirst: ReturnType<typeof vi.fn>, findMany: ReturnType<typeof vi.fn>, findUnique: ReturnType<typeof vi.fn> },
    loginToken: { create: ReturnType<typeof vi.fn>, findFirst: ReturnType<typeof vi.fn> },
};
const mockAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;
const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>;
const mockGuildChannels = getGuildChannels as unknown as ReturnType<typeof vi.fn>;
const mockRecover = recoverManagerLink as unknown as ReturnType<typeof vi.fn>;
const mockDmLink = dmManagerLink as unknown as ReturnType<typeof vi.fn>;

const GUILD = '111111111111111111';
const CHANNEL = '333333333333333333';
const badSlugs: unknown[] = [123, null, undefined, {}, '', 'a b', 'a/b', 'x'.repeat(65)];
const badHandles: unknown[] = [42, null, undefined, {}, ['gm'], 'x'.repeat(65)];

function expectNoDatabaseAccess() {
    for (const model of [mockPrisma.participant, mockPrisma.event, mockPrisma.loginToken]) {
        for (const fn of Object.values(model)) expect(fn).not.toHaveBeenCalled();
    }
}

describe('Discord actions validate their arguments before any lookup', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
        mockAdmin.mockResolvedValue(true);
        mockCookies.mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() });
        mockPrisma.participant.findMany.mockResolvedValue([]);
        mockPrisma.event.findMany.mockResolvedValue([]);
        mockPrisma.event.findUnique.mockResolvedValue(null);
        mockPrisma.loginToken.findFirst.mockResolvedValue(null);
    });

    describe('recoverDiscordManagerLink', () => {
        it.each(badSlugs.map((s) => [String(s), s]))('rejects slug %s', async (_l, slug) => {
            expect(await recoverDiscordManagerLink(slug as string, 'gm')).toMatchObject({ code: 'validation' });
            expect(mockRecover).not.toHaveBeenCalled();
            expectNoDatabaseAccess();
        });

        it.each(badHandles.map((h) => [String(h), h]))('rejects username %s', async (_l, username) => {
            expect(await recoverDiscordManagerLink('abc', username as string)).toMatchObject({ code: 'validation' });
            expect(mockRecover).not.toHaveBeenCalled();
            expectNoDatabaseAccess();
        });

        it('still reaches the lookup for valid arguments', async () => {
            expect(await recoverDiscordManagerLink('abc', '@gm')).toEqual({ error: 'No Discord account linked to this event.' });
            expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({ where: { slug: 'abc' } });
        });
    });

    describe('connectDiscordChannel and listDiscordChannels', () => {
        it.each(badSlugs.map((s) => [String(s), s]))('reject slug %s', async (_l, slug) => {
            expect(await connectDiscordChannel(slug as string, GUILD, CHANNEL)).toMatchObject({ code: 'validation' });
            expect(await listDiscordChannels(slug as string, GUILD)).toMatchObject({ code: 'validation' });
            expect(mockAdmin).not.toHaveBeenCalled();
            expect(mockGuildChannels).not.toHaveBeenCalled();
            expectNoDatabaseAccess();
        });

        it.each([
            ['number', 1.11111111111111e17],
            ['object', { toString: () => GUILD }],
            ['array', [GUILD]],
            ['null', null],
        ])('reject a %s guild or channel id', async (_l, bad) => {
            expect(await connectDiscordChannel('abc', bad as string, CHANNEL)).toMatchObject({ code: 'validation' });
            expect(await connectDiscordChannel('abc', GUILD, bad as string)).toMatchObject({ code: 'validation' });
            expect(await listDiscordChannels('abc', bad as string)).toMatchObject({ code: 'validation' });
            expect(mockGuildChannels).not.toHaveBeenCalled();
            expectNoDatabaseAccess();
        });

        it('still checks the guild grant for valid arguments', async () => {
            expect(await connectDiscordChannel('abc', GUILD, CHANNEL)).toMatchObject({ code: 'forbidden' });
            expect(await listDiscordChannels('abc', GUILD)).toMatchObject({ code: 'forbidden' });
            expect(mockAdmin).toHaveBeenCalledWith('abc');
        });
    });

    describe('dmDiscordManagerLink', () => {
        it('delegates to the validated dmManagerLink, limited to Discord', async () => {
            mockDmLink.mockResolvedValue({ error: 'Invalid request', code: 'validation' });
            expect(await dmDiscordManagerLink('a b')).toEqual({ error: 'Invalid request', code: 'validation' });
            expect(mockDmLink).toHaveBeenCalledWith('a b', 'discord');
        });
    });
});
