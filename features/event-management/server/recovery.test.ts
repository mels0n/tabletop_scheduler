import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    recoverManagerLink,
    dmManagerLink,
    startTelegramRecovery,
    connectCommandForAdmin,
} from './recovery';
import { resetManagerLinkCooldownForTests } from './recovery-tokens';
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
    loginToken: { create: ReturnType<typeof vi.fn> };
};
const mockSend = sendDirectMessage as unknown as ReturnType<typeof vi.fn>;
const mockAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;

const skipped = { status: 'skipped', reason: 'not_linked' };
const sent = { status: 'sent', messageId: '1' };

const discordOnlyEvent = {
    id: 1,
    slug: 'abc',
    title: 'Game Night',
    adminToken: 'f'.repeat(64),
    managerTelegram: null,
    managerChatId: null,
    managerDiscordId: '123456789012345678',
    managerDiscordUsername: 'GmSteve',
};

describe('manager recovery (platform-neutral, login-token based)', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        resetManagerLinkCooldownForTests();
        mockPrisma.event.update.mockResolvedValue({});
        mockPrisma.loginToken.create.mockResolvedValue({});
        mockSend.mockResolvedValue({ telegram: skipped, discord: sent });
    });

    it('DMs a Discord-only manager a /auth/login link and never rotates the admin token', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

        const res = await dmManagerLink('abc');

        expect(res).toMatchObject({ success: true });
        expect(mockSend).toHaveBeenCalledWith(
            { telegramChatId: null, discordUserId: '123456789012345678' },
            expect.objectContaining({ html: expect.stringContaining('http://localhost:3000/auth/login?token=') }),
            expect.anything()
        );
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('binds the 15-minute login token to the stored manager identity, storing only a hash', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...discordOnlyEvent, managerTelegram: '@steve_tg', managerChatId: '555' });
        const before = Date.now();

        await dmManagerLink('abc');

        const data = mockPrisma.loginToken.create.mock.calls[0][0].data;
        expect(data).toMatchObject({
            chatId: '555',
            telegramUsername: 'steve_tg',
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

    it('escapes the event title in the HTML DM', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...discordOnlyEvent, title: '<a href="https://evil">x</a>' });

        await dmManagerLink('abc');

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

    it('sends to both platforms when the manager linked both', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({
            ...discordOnlyEvent, managerTelegram: '@steve_tg', managerChatId: '555',
        });
        mockSend.mockResolvedValue({ telegram: sent, discord: sent });

        const res = await recoverManagerLink('abc', 'steve_tg');

        expect(mockSend).toHaveBeenCalledWith(
            { telegramChatId: '555', discordUserId: '123456789012345678' },
            expect.anything(),
            expect.anything()
        );
        expect(res).toMatchObject({ success: true, message: expect.stringContaining('Telegram and Discord') });
    });

    it('reports an error when no platform delivered', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);
        mockSend.mockResolvedValue({ telegram: skipped, discord: { status: 'failed', error: 'blocked' } });

        const res = await dmManagerLink('abc');

        expect(res).toHaveProperty('error');
    });

    it('with no admin and no linked manager: errors without touching the DB', async () => {
        mockAdmin.mockResolvedValue(false);
        mockPrisma.event.findUnique.mockResolvedValue({
            ...discordOnlyEvent, managerDiscordId: null, managerDiscordUsername: null,
        });

        expect(await dmManagerLink('abc')).toEqual({ error: 'No linked manager to notify' });
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(mockPrisma.loginToken.create).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    describe('per-event cooldown', () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        it('refuses a second request within 60 s with code rate_limited', async () => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
            mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);

            expect(await dmManagerLink('abc')).toMatchObject({ success: true });
            vi.setSystemTime(new Date('2026-10-02T12:00:30Z'));
            expect(await recoverManagerLink('abc', 'gmsteve')).toMatchObject({ code: 'rate_limited' });
            expect(mockPrisma.loginToken.create).toHaveBeenCalledTimes(1);
            expect(mockSend).toHaveBeenCalledTimes(1);

            vi.setSystemTime(new Date('2026-10-02T12:01:01Z'));
            expect(await dmManagerLink('abc')).toMatchObject({ success: true });
        });

        it('keys the cooldown by event', async () => {
            mockPrisma.event.findUnique.mockResolvedValue(discordOnlyEvent);
            await dmManagerLink('abc');

            mockPrisma.event.findUnique.mockResolvedValue({ ...discordOnlyEvent, slug: 'xyz' });
            expect(await dmManagerLink('xyz')).toMatchObject({ success: true });
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
            command: `/connect abc ${connectCodeFor('abc', discordOnlyEvent.adminToken, null)}`,
        });
    });
});
