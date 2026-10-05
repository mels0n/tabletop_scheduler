import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    recoverManagerLink,
    dmManagerLink,
    startTelegramRecovery,
    connectCommandForAdmin,
} from './recovery';
import prisma from '@/shared/lib/prisma';
import { sendDirectMessage } from '@/features/notifications';
import { verifyEventAdmin } from '@/features/auth/server/verify';
import { connectCodeFor } from '@/features/telegram/model/connect-code';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma');
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
vi.mock('@/features/notifications', () => ({
    sendDirectMessage: vi.fn(),
    isDelivered: (r: { telegram: { status: string }; discord: { status: string } }) =>
        r.telegram.status === 'sent' || r.discord.status === 'sent',
}));

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

const skipped = { status: 'skipped', reason: 'not_linked' };
const sent = { status: 'sent', messageId: '1' };

const discordOnlyEvent = {
    id: 1,
    telegramChatId: null,
    telegramConnectNonce: 'n1',
    slug: 'abc',
    title: 'Game Night',
    adminToken: 'f'.repeat(64),
    managerTelegram: null,
    managerChatId: null,
    managerDiscordId: '123456789012345678',
    managerDiscordUsername: 'GmSteve',
};

// Both platforms linked, with the same handle on each, so a recovery call without a tab
// (a page loaded before tabs were passed) matches and DMs both.
const bothEvent = {
    ...discordOnlyEvent,
    managerTelegram: '@steve',
    managerChatId: '555',
    managerDiscordUsername: 'Steve',
};

describe('manager recovery (platform-neutral, login-token based)', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockPrisma.loginToken.findFirst.mockResolvedValue(null);
        mockPrisma.event.update.mockResolvedValue({});
        mockPrisma.loginToken.create.mockResolvedValue({});
        mockPrisma.loginToken.count.mockResolvedValue(1);
        mockPrisma.loginToken.deleteMany.mockResolvedValue({ count: 0 });
        mockSend.mockResolvedValue({ telegram: skipped, discord: sent });
        // dmManagerLink is a manage-page button: these cases run as the event admin.
        mockAdmin.mockResolvedValue(true);
    });

    it('dmManagerLink refuses a caller who is not the event admin, without minting or sending', async () => {
        mockAdmin.mockResolvedValue(false);
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

        expect(await dmManagerLink('abc', 'discord')).toMatchObject({ code: 'forbidden', error: expect.any(String) });
        expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('recoverManagerLink needs no admin: a matching handle still gets the link', async () => {
        mockAdmin.mockResolvedValue(false);
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

        expect(await recoverManagerLink('abc', 'gmsteve')).toMatchObject({ success: true });
        expect(mockSend).toHaveBeenCalledWith(
            { telegramChatId: null, discordUserId: '123456789012345678' },
            expect.anything(),
            expect.anything(),
            { respectOptOut: false }
        );
    });

    it('DMs a Discord-only manager a /auth/login link and never rotates the admin token', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

        const res = await dmManagerLink('abc', 'discord');

        expect(res).toMatchObject({ success: true });
        expect(mockSend).toHaveBeenCalledWith(
            { telegramChatId: null, discordUserId: '123456789012345678' },
            expect.objectContaining({ html: expect.stringContaining('http://localhost:3000/auth/login?token=') }),
            expect.anything(),
            // A requested login link is never suppressed by a DM opt-out.
            { respectOptOut: false }
        );
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('binds the 15-minute login token to the stored manager identity, storing only a hash', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);
        const before = Date.now();

        await dmManagerLink('abc', 'discord');

        const data = mockPrisma.loginToken.create.mock.calls[0][0].data;
        expect(data).toMatchObject({
            chatId: null,
            telegramUsername: null,
            discordId: '123456789012345678',
            discordUsername: 'GmSteve',
        });
        expect(data.token).toMatch(/^[0-9a-f]{64}$/);
        const html = mockSend.mock.calls[0][1].html as string;
        expect(html).not.toContain(data.token);
        const ttl = (data.expiresAt as Date).getTime() - before;
        expect(ttl).toBeGreaterThan(14 * 60_000);
        expect(ttl).toBeLessThanOrEqual(15 * 60_000 + 1000);
    });

    it('mints one token per platform so neither DM can log in as the other identity', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(bothEvent);
        mockSend
            .mockResolvedValueOnce({ telegram: sent, discord: skipped })
            .mockResolvedValueOnce({ telegram: skipped, discord: sent });

        const res = await recoverManagerLink('abc', 'steve');

        expect(res).toMatchObject({ success: true, message: expect.stringContaining('Telegram and Discord') });
        expect(mockPrisma.loginToken.create).toHaveBeenCalledTimes(2);
        expect(mockSend).toHaveBeenCalledTimes(2);

        const [tgCall, dcCall] = mockSend.mock.calls;
        const [tgRow, dcRow] = mockPrisma.loginToken.create.mock.calls.map((c) => c[0].data);

        // Telegram DM: Telegram-only token.
        expect(tgCall[0]).toEqual({ telegramChatId: '555', discordUserId: null });
        expect(tgRow).toMatchObject({ chatId: '555', telegramUsername: 'steve', discordId: null, discordUsername: null });
        // Discord DM: Discord-only token.
        expect(dcCall[0]).toEqual({ telegramChatId: null, discordUserId: '123456789012345678' });
        expect(dcRow).toMatchObject({ chatId: null, telegramUsername: null, discordId: '123456789012345678', discordUsername: 'Steve' });

        // Each DM carries a different raw token.
        const tokenOf = (html: string) => html.match(/token=([0-9a-f-]+)/)![1];
        expect(tokenOf(tgCall[1].html)).not.toBe(tokenOf(dcCall[1].html));
    });

    it('escapes the event title in the HTML DM', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...discordOnlyEvent, title: '<a href="https://evil">x</a>' });

        await dmManagerLink('abc', 'discord');

        const html = mockSend.mock.calls[0][1].html as string;
        expect(html).not.toContain('<a href="https://evil">');
        expect(html).toContain('&lt;a href=');
    });

    it('matches a Discord username case-insensitively, ignoring a leading @', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

        const res = await recoverManagerLink('abc', '@gmsteve');

        expect(res).toMatchObject({ success: true, message: expect.stringContaining('Discord') });
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('rejects a non-matching handle without writing anything or sending', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

        const res = await recoverManagerLink('abc', 'someoneelse');

        expect(res).toHaveProperty('error');
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('sends to both platforms when the manager linked both, reporting partial delivery', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(bothEvent);
        mockSend
            .mockResolvedValueOnce({ telegram: { status: 'failed', error: 'blocked' }, discord: skipped })
            .mockResolvedValueOnce({ telegram: skipped, discord: sent });

        const res = await recoverManagerLink('abc', 'steve');

        expect(mockSend).toHaveBeenNthCalledWith(1, { telegramChatId: '555', discordUserId: null }, expect.anything(), expect.anything(), { respectOptOut: false });
        expect(mockSend).toHaveBeenNthCalledWith(2, { telegramChatId: null, discordUserId: '123456789012345678' }, expect.anything(), expect.anything(), { respectOptOut: false });
        expect(res).toMatchObject({ success: true, message: 'Login link sent to your Discord DMs!' });
    });

    it.each([
        ['telegram', { telegramChatId: '555', discordUserId: null }, { chatId: '555', discordId: null }],
        ['discord', { telegramChatId: null, discordUserId: '123456789012345678' }, { chatId: null, discordId: '123456789012345678' }],
    ] as const)('dmManagerLink(slug, %s) mints and sends only that platform', async (platform, recipient, row) => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...discordOnlyEvent, managerTelegram: '@steve_tg', managerChatId: '555' });
        mockSend.mockResolvedValue(platform === 'telegram' ? { telegram: sent, discord: skipped } : { telegram: skipped, discord: sent });

        const res = await dmManagerLink('abc', platform);

        expect(res).toMatchObject({ success: true });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend.mock.calls[0][0]).toEqual(recipient);
        expect(mockPrisma.loginToken.create).toHaveBeenCalledTimes(1);
        expect(mockPrisma.loginToken.create.mock.calls[0][0].data).toMatchObject(row);
        // The cooldown only checks the targeted identity, so the other button is not blocked.
        expect(mockPrisma.loginToken.findFirst.mock.calls[0][0].where.OR).toEqual([
            platform === 'telegram' ? { chatId: '555' } : { discordId: '123456789012345678' },
        ]);
    });

    it('dmManagerLink(slug, discord) errors when only Telegram is linked', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({
            ...discordOnlyEvent, managerTelegram: '@steve_tg', managerChatId: '555', managerDiscordId: null, managerDiscordUsername: null,
        });

        expect(await dmManagerLink('abc', 'discord')).toEqual({ error: 'No linked manager to notify' });
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('dmManagerLink rejects an unknown platform before any lookup', async () => {
        expect(await dmManagerLink('abc', 'email' as never)).toHaveProperty('error');
        expect(mockPrisma.event.findUnique).not.toHaveBeenCalled();
    });

    it('dmManagerLink(slug, telegram) errors when only Discord is linked', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

        expect(await dmManagerLink('abc', 'telegram')).toEqual({ error: 'No linked manager to notify' });
        expect(mockSend).not.toHaveBeenCalled();
        expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
    });

    // Catches: ignoring the tab (a handle shared by both platforms would DM both), or swapping
    // the Telegram and Discord branches.
    it.each([
        ['telegram', { telegramChatId: '555', discordUserId: null }, { chatId: '555' }, 'Telegram'],
        ['discord', { telegramChatId: null, discordUserId: '123456789012345678' }, { discordId: '123456789012345678' }, 'Discord'],
    ] as const)('recoverManagerLink on the %s tab DMs only that platform, even when the handle matches both', async (tab, recipient, identity, name) => {
        mockPrisma.event.findUnique.mockResolvedValue(bothEvent);
        mockSend.mockResolvedValue(tab === 'telegram' ? { telegram: sent, discord: skipped } : { telegram: skipped, discord: sent });

        const res = await recoverManagerLink('abc', 'steve', tab);

        expect(res).toMatchObject({ success: true, message: `Login link sent to your ${name} DMs!` });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend.mock.calls[0][0]).toEqual(recipient);
        expect(mockPrisma.loginToken.create).toHaveBeenCalledTimes(1);
        expect(mockPrisma.loginToken.findFirst.mock.calls[0][0].where.OR).toEqual([identity]);
    });

    it('recoverManagerLink on a tab only matches that platform handle', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...discordOnlyEvent, managerTelegram: '@steve_tg', managerChatId: '555' });

        // The Discord username typed on the Telegram tab does not match.
        expect(await recoverManagerLink('abc', 'gmsteve', 'telegram')).toEqual({ error: 'Handle does not match our records.' });
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('recoverManagerLink without a tab DMs only the platform whose handle matched', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...discordOnlyEvent, managerTelegram: '@steve_tg', managerChatId: '555' });
        mockSend.mockResolvedValue({ telegram: sent, discord: skipped });

        const res = await recoverManagerLink('abc', 'steve_tg');

        expect(res).toMatchObject({ success: true, message: 'Login link sent to your Telegram DMs!' });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend.mock.calls[0][0]).toEqual({ telegramChatId: '555', discordUserId: null });
    });

    // Catches: falling back to the other platform's account, which may belong to someone else.
    it.each([
        ['telegram', 'steve_tg', { managerTelegram: '@steve_tg', managerChatId: null }, 'Telegram', 'Discord'],
        ['discord', 'gmsteve', { managerTelegram: '@steve_tg', managerChatId: '555', managerDiscordId: null }, 'Discord', 'Telegram'],
    ] as const)('recoverManagerLink on the %s tab refuses when that account is not registered, pointing to the other', async (tab, handle, overrides, name, other) => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...discordOnlyEvent, ...overrides });

        const res = await recoverManagerLink('abc', handle, tab);

        expect(res).toEqual({
            error: `Handle matched, but that ${name} account is not registered for login links yet. Try the ${other} option instead.`,
        });
        expect(mockSend).not.toHaveBeenCalled();
        expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
    });

    it('recoverManagerLink rejects an unknown tab before any lookup', async () => {
        expect(await recoverManagerLink('abc', 'steve', 'email' as never)).toHaveProperty('error');
        expect(mockPrisma.event.findUnique).not.toHaveBeenCalled();
    });

    it('reports an error when no platform delivered', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);
        mockSend.mockResolvedValue({ telegram: skipped, discord: { status: 'failed', error: 'blocked' } });

        const res = await dmManagerLink('abc', 'discord');

        expect(res).toHaveProperty('error');
    });

    it('with no linked manager: errors without touching the DB', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({
            ...discordOnlyEvent, managerDiscordId: null, managerDiscordUsername: null,
        });

        expect(await dmManagerLink('abc', 'discord')).toEqual({ error: 'No linked manager to notify' });
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    describe('per-manager cooldown (database, shared by every instance)', () => {
        it('refuses with code rate_limited when a LoginToken for this manager was created in the last 60 s', async () => {
            mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);
            mockPrisma.loginToken.findFirst.mockResolvedValue({ token: 'x'.repeat(64) });

            expect(await dmManagerLink('abc', 'discord')).toMatchObject({ code: 'rate_limited' });
            expect(await recoverManagerLink('abc', 'gmsteve')).toMatchObject({ code: 'rate_limited' });
            expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('queries by the manager identity (chat id or discord id) within the last 60 s', async () => {
            mockPrisma.event.findUnique.mockResolvedValue(bothEvent);
            const before = Date.now();

            expect(await recoverManagerLink('abc', 'steve')).toMatchObject({ success: true });

            const where = mockPrisma.loginToken.findFirst.mock.calls[0][0].where;
            expect(where.OR).toEqual([{ chatId: '555' }, { discordId: '123456789012345678' }]);
            const since = (where.createdAt.gt as Date).getTime();
            expect(before - since).toBeGreaterThanOrEqual(59_000);
            expect(before - since).toBeLessThanOrEqual(61_000);
        });

        it('closes the check-then-create race: refuses and deletes its tokens when another link landed in the window', async () => {
            mockPrisma.event.findUnique.mockResolvedValue(bothEvent);
            // The pre-check saw nothing, but a concurrent request created a Discord token meanwhile.
            mockPrisma.loginToken.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

            expect(await recoverManagerLink('abc', 'steve')).toMatchObject({ code: 'rate_limited' });

            expect(mockPrisma.loginToken.create).toHaveBeenCalledTimes(2);
            const hashes = mockPrisma.loginToken.create.mock.calls.map((c) => c[0].data.token);
            expect(mockPrisma.loginToken.deleteMany).toHaveBeenCalledWith({ where: { token: { in: hashes } } });
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('counts tokens for each identity inside the cooldown window after creating', async () => {
            mockPrisma.event.findUnique.mockResolvedValue(bothEvent);
            mockSend.mockResolvedValue({ telegram: sent, discord: sent });

            expect(await recoverManagerLink('abc', 'steve')).toMatchObject({ success: true });

            const wheres = mockPrisma.loginToken.count.mock.calls.map((c) => c[0].where);
            expect(wheres[0]).toMatchObject({ chatId: '555' });
            expect(wheres[1]).toMatchObject({ discordId: '123456789012345678' });
            expect(mockPrisma.loginToken.count.mock.invocationCallOrder[0])
                .toBeGreaterThan(mockPrisma.loginToken.create.mock.invocationCallOrder[0]);
            expect(mockPrisma.loginToken.deleteMany).not.toHaveBeenCalled();
        });

        it('only includes the platforms the manager linked', async () => {
            mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

            await dmManagerLink('abc', 'discord');

            expect(mockPrisma.loginToken.findFirst.mock.calls[0][0].where.OR).toEqual([{ discordId: '123456789012345678' }]);
        });
    });
});

describe('admin-only recovery setup actions', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockPrisma.event.update.mockResolvedValue({});
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);
    });

    it('startTelegramRecovery refuses a non-admin and writes nothing', async () => {
        mockAdmin.mockResolvedValue(false);

        expect(await startTelegramRecovery('abc')).toMatchObject({ code: 'forbidden' });
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('startTelegramRecovery returns a short token for the admin and stores only its hash', async () => {
        mockAdmin.mockResolvedValue(true);

        const res = await startTelegramRecovery('abc');

        expect(res).toMatchObject({ success: true, token: expect.stringMatching(/^[0-9a-f]{8}$/) });
        const data = mockPrisma.event.update.mock.calls[0][0].data;
        expect(data.recoveryToken).toMatch(/^[0-9a-f]{64}$/);
        expect(data.recoveryToken).not.toBe((res as { token: string }).token);
    });

    it('connectCommandForAdmin refuses a non-admin', async () => {
        mockAdmin.mockResolvedValue(false);

        expect(await connectCommandForAdmin('abc')).toMatchObject({ code: 'forbidden' });
    });

    it('connectCommandForAdmin returns the /connect command with the HMAC code', async () => {
        mockAdmin.mockResolvedValue(true);

        expect(await connectCommandForAdmin('abc')).toEqual({
            success: true,
            command: `/connect abc ${connectCodeFor('abc', discordOnlyEvent.adminToken, null, 'n1')}`,
        });
    });
});
