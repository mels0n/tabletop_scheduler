import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendDiscordMagicLogin, connectDiscordChannel, listDiscordChannels, recoverDiscordManagerLink } from './actions';
import prisma from '@/shared/lib/prisma';
import { createDMChannel, sendDiscordMessage, getGuildChannels, pinDiscordMessage, getDiscordUser } from '@/features/integrations/discord/model/discord';
import { dmManagerLink } from '@/features/event-management/server/recovery';
import { verifyEventAdmin } from '@/features/auth/server/verify';
import { cookies } from 'next/headers';
import { signValue } from '@/shared/lib/session';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/integrations/discord/model/discord', () => ({
    getDiscordUser: vi.fn(),
    sendDiscordMessage: vi.fn(),
    pinDiscordMessage: vi.fn(),
    getGuildChannels: vi.fn(),
    createDMChannel: vi.fn(),
}));
vi.mock('@/features/event-management/server/recovery', () => ({
    dmManagerLink: vi.fn(),
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
    participant: { findFirst: ReturnType<typeof vi.fn>, findMany: ReturnType<typeof vi.fn>, count: ReturnType<typeof vi.fn> },
    event: {
        findFirst: ReturnType<typeof vi.fn>, findMany: ReturnType<typeof vi.fn>,
        findUnique: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn>,
    },
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

    it('ignores a forged unsigned discord id cookie (no fast-path lookup, no DM to that id)', async () => {
        mockCookies.mockResolvedValue(cookieJar({ tabletop_user_discord_id: '444444444444444444' }));
        mockPrisma.participant.findFirst.mockResolvedValue({ discordId: '444444444444444444', discordUsername: 'victim' });

        const result = await sendDiscordMagicLogin('nobody-matches');

        expect(mockPrisma.participant.findFirst).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(mockCreateDM).not.toHaveBeenCalled();
    });

    it('ignores a value signed for another purpose in the discord id cookie', async () => {
        mockCookies.mockResolvedValue(cookieJar({ tabletop_user_discord_id: signValue('participant:abc', '444444444444444444') }));

        const result = await sendDiscordMagicLogin('nobody-matches');

        expect(mockPrisma.participant.findFirst).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
    });

    it('uses the fast path for a signed discord identity cookie', async () => {
        mockCookies.mockResolvedValue(cookieJar({ tabletop_user_discord_id: signValue('identity:discord', 'signed-user') }));
        mockPrisma.participant.findFirst.mockResolvedValue({ discordId: 'signed-user', discordUsername: 'Me' });

        const result = await sendDiscordMagicLogin('me');

        expect(mockPrisma.participant.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { discordId: 'signed-user' } }));
        expect(result.success).toBe(true);
        expect(mockCreateDM).toHaveBeenCalledWith('signed-user', 'test-bot-token');
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

const GUILD = '111111111111111111';
const OTHER_GUILD = '222222222222222222';
const CHANNEL = '333333333333333333';
const mockAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;
const mockGuildChannels = getGuildChannels as unknown as ReturnType<typeof vi.fn>;
const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>;

/** Cookie store holding the given cookies (name -> raw value). */
function cookieJar(values: Record<string, string>) {
    return {
        get: (name: string) => (name in values ? { name, value: values[name] } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
    };
}

describe('Discord channel binding requires admin and a guild this admin just added the bot to', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
        mockAdmin.mockResolvedValue(true);
        mockCookies.mockResolvedValue(cookieJar({
            tabletop_discord_guild_abc: signValue('discord-guild:abc', GUILD),
            tabletop_user_discord_id: '999999999999999999',
        }));
        mockGuildChannels.mockResolvedValue([{ id: CHANNEL, name: 'general' }]);
        mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'abc', title: 'Game Night', managerDiscordId: null, timeSlots: [] });
        mockPrisma.event.update.mockResolvedValue({});
        mockPrisma.participant.count.mockResolvedValue(0);
        mockSendMessage.mockResolvedValue({ id: 'msg-1' });
        (pinDiscordMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    });

    it('connectDiscordChannel without admin -> forbidden, nothing written or sent', async () => {
        mockAdmin.mockResolvedValue(false);

        expect(await connectDiscordChannel('abc', GUILD, CHANNEL)).toMatchObject({ code: 'forbidden' });
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('connectDiscordChannel with a guild cookie for a different guild -> forbidden', async () => {
        expect(await connectDiscordChannel('abc', OTHER_GUILD, CHANNEL)).toMatchObject({ code: 'forbidden' });
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('connectDiscordChannel with an unsigned guild cookie -> forbidden', async () => {
        mockCookies.mockResolvedValue(cookieJar({ tabletop_discord_guild_abc: GUILD }));

        expect(await connectDiscordChannel('abc', GUILD, CHANNEL)).toMatchObject({ code: 'forbidden' });
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('connectDiscordChannel with a guild cookie issued for another event -> forbidden', async () => {
        mockCookies.mockResolvedValue(cookieJar({ tabletop_discord_guild_other: signValue('discord-guild:other', GUILD) }));

        expect(await connectDiscordChannel('abc', GUILD, CHANNEL)).toMatchObject({ code: 'forbidden' });
    });

    it('connectDiscordChannel with a guild value signed for another event, copied under this name -> forbidden', async () => {
        mockCookies.mockResolvedValue(cookieJar({ tabletop_discord_guild_abc: signValue('discord-guild:other', GUILD) }));

        expect(await connectDiscordChannel('abc', GUILD, CHANNEL)).toMatchObject({ code: 'forbidden' });
    });

    it('connectDiscordChannel with a signed identity value copied into the guild cookie -> forbidden', async () => {
        mockCookies.mockResolvedValue(cookieJar({ tabletop_discord_guild_abc: signValue('identity:discord', GUILD) }));

        expect(await connectDiscordChannel('abc', GUILD, CHANNEL)).toMatchObject({ code: 'forbidden' });
    });

    it.each([
        ['guild', '123/../../users/@me', CHANNEL],
        ['channel', GUILD, 'abc'],
    ])('connectDiscordChannel rejects a malformed %s id', async (_label, guildId, channelId) => {
        expect(await connectDiscordChannel('abc', guildId, channelId)).toMatchObject({ code: 'validation' });
        expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('connectDiscordChannel refuses a channel that is not in the granted guild', async () => {
        mockGuildChannels.mockResolvedValue([{ id: '444444444444444444', name: 'other' }]);

        expect(await connectDiscordChannel('abc', GUILD, CHANNEL)).toHaveProperty('error');
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('connectDiscordChannel binds guild and channel for the admin and never sets managerDiscordId', async () => {
        expect(await connectDiscordChannel('abc', GUILD, CHANNEL)).toEqual({ success: true });

        const first = mockPrisma.event.update.mock.calls[0][0].data;
        expect(first).toEqual({ discordGuildId: GUILD, discordChannelId: CHANNEL });
        for (const call of mockPrisma.event.update.mock.calls) {
            expect(call[0].data).not.toHaveProperty('managerDiscordId');
            expect(call[0].data).not.toHaveProperty('managerDiscordUsername');
        }
    });

    it('connectDiscordChannel escapes Discord markdown in the event title of the announcement', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'abc', title: '**bold** _x_', managerDiscordId: null, timeSlots: [] });

        await connectDiscordChannel('abc', GUILD, CHANNEL);

        const announcement = mockSendMessage.mock.calls[0][1] as string;
        expect(announcement).toContain(String.raw`\*\*bold\*\* \_x\_`);
        expect(announcement).not.toContain('**bold**');
    });

    it('listDiscordChannels without admin -> forbidden and the bot is never asked', async () => {
        mockAdmin.mockResolvedValue(false);

        expect(await listDiscordChannels('abc', GUILD)).toMatchObject({ code: 'forbidden' });
        expect(mockGuildChannels).not.toHaveBeenCalled();
    });

    it('listDiscordChannels for a guild this admin did not add the bot to -> forbidden', async () => {
        expect(await listDiscordChannels('abc', OTHER_GUILD)).toMatchObject({ code: 'forbidden' });
        expect(mockGuildChannels).not.toHaveBeenCalled();
    });

    it('listDiscordChannels returns channels for the granted guild', async () => {
        expect(await listDiscordChannels('abc', GUILD)).toEqual({ success: true, channels: [{ id: CHANNEL, name: 'general' }] });
        expect(mockGuildChannels).toHaveBeenCalledWith(GUILD, 'test-bot-token');
    });
});

describe('recoverDiscordManagerLink', () => {
    const mockGetUser = getDiscordUser as unknown as ReturnType<typeof vi.fn>;
    const mockDmManagerLink = dmManagerLink as unknown as ReturnType<typeof vi.fn>;
    const linked = (overrides: Record<string, unknown> = {}) => ({
        id: 7, slug: 'abc', managerDiscordId: '123456789012345678', managerDiscordUsername: 'GmSteve', ...overrides,
    });

    beforeEach(() => {
        vi.resetAllMocks();
        process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
        mockPrisma.event.findUnique.mockResolvedValue(linked());
        mockPrisma.event.update.mockResolvedValue({});
        mockDmManagerLink.mockResolvedValue({ success: true });
    });

    // Catches: dropping the managerDiscordId guard (the recovery DM would go to nobody or to a
    // user who never linked this event).
    it.each([
        ['no such event', null],
        ['an event with no manager Discord id', linked({ managerDiscordId: null })],
    ])('returns an error and sends nothing for %s', async (_label, row) => {
        mockPrisma.event.findUnique.mockResolvedValue(row);

        const result = await recoverDiscordManagerLink('abc', 'GmSteve');

        expect(result).toEqual({ error: 'No Discord account linked to this event.' });
        expect(mockDmManagerLink).not.toHaveBeenCalled();
        expect(mockGetUser).not.toHaveBeenCalled();
    });

    // Catches: making the comparison case- or @-sensitive, or substituting a partial match.
    it.each(['gmsteve', '@GMSTEVE', ' @GmSteve '])('DMs the manager link when the stored username matches %j', async (input) => {
        const result = await recoverDiscordManagerLink('abc', input);

        expect(result).toEqual({ success: true });
        expect(mockDmManagerLink).toHaveBeenCalledTimes(1);
        expect(mockDmManagerLink).toHaveBeenCalledWith('abc');
        expect(mockGetUser).not.toHaveBeenCalled();
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    // Catches: skipping the live Discord lookup (users who renamed would be locked out), or
    // sending the DM without refreshing the stored name.
    it('refreshes a stale stored username from the Discord API, then DMs', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(linked({ managerDiscordUsername: 'OldName' }));
        mockGetUser.mockResolvedValue({ id: '123456789012345678', username: 'NewName' });

        const result = await recoverDiscordManagerLink('abc', '@newname');

        expect(result).toEqual({ success: true });
        expect(mockGetUser).toHaveBeenCalledWith('123456789012345678', 'test-bot-token');
        expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { managerDiscordUsername: 'NewName' } });
        expect(mockDmManagerLink).toHaveBeenCalledWith('abc');
        expect(mockPrisma.event.update.mock.invocationCallOrder[0]).toBeLessThan(mockDmManagerLink.mock.invocationCallOrder[0]);
    });

    // Catches: dropping the final equality check, which would DM the manager link to whoever
    // typed any username for this event (account takeover of the admin link).
    it.each([
        ['stored and live names both differ', { managerDiscordUsername: 'OldName' }, { username: 'NewName' }],
        ['no stored name and the lookup fails', { managerDiscordUsername: null }, null],
    ])('returns an error and sends no DM when %s', async (_label, row, discordUser) => {
        mockPrisma.event.findUnique.mockResolvedValue(linked(row));
        mockGetUser.mockResolvedValue(discordUser);

        const result = await recoverDiscordManagerLink('abc', 'mallory');

        expect(result).toEqual({ error: 'Discord username does not match our records.' });
        expect(mockDmManagerLink).not.toHaveBeenCalled();
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });
});
