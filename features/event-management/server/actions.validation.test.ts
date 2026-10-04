import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    checkManagerStatus,
    checkEventStatus,
    updateManagerHandle,
    updateTelegramInviteLink,
    deleteEvent,
    cancelEvent,
    updateReminderSettings,
    updateSessionReminderSettings,
} from './actions';
import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth/server/verify';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/verify', () => ({
    verifyEventAdmin: vi.fn(),
}));
vi.mock('@/features/telegram', () => ({
    unpinChatMessage: vi.fn(),
    editMessageText: vi.fn(),
}));

const mockAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
    event: {
        findUnique: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn>,
        updateMany: ReturnType<typeof vi.fn>, delete: ReturnType<typeof vi.fn>,
    },
    $transaction: ReturnType<typeof vi.fn>,
};

const badSlugs: unknown[] = [123, null, undefined, {}, ['abc'], '', 'a b', 'a/b', 'a.b', 'x'.repeat(65)];
const slugCases = badSlugs.map((s) => [JSON.stringify(s) ?? String(s), s] as const);

function expectUntouched() {
    expect(mockAdmin).not.toHaveBeenCalled();
    expect(mockPrisma.event.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.event.update).not.toHaveBeenCalled();
    expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.event.delete).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
}

describe('event-management actions validate their arguments before any lookup', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockAdmin.mockResolvedValue(true);
        mockPrisma.event.findUnique.mockResolvedValue(null);
    });

    describe('slug', () => {
        it.each(slugCases)('is rejected by every action: %s', async (_l, slug) => {
            const s = slug as string;
            expect(await checkManagerStatus(s)).toEqual({ hasManagerChatId: false });
            expect(await checkEventStatus(s)).toEqual({ hasTelegramChatId: false });
            expect(await updateManagerHandle(s, '@gm')).toEqual({ error: 'Invalid request' });
            expect(await updateTelegramInviteLink(s, 'https://t.me/x')).toEqual({ error: 'Invalid request' });
            expect(await deleteEvent(s)).toEqual({ error: 'Invalid request' });
            expect(await cancelEvent(s)).toEqual({ error: 'Invalid request' });
            expect(await updateReminderSettings(s, true, '09:00', [1])).toEqual({ success: false, error: 'Invalid request' });
            expect(await updateSessionReminderSettings(s, true, 120)).toEqual({ success: false, error: 'Invalid request' });
            expectUntouched();
        });
    });

    describe('updateManagerHandle', () => {
        it.each([
            ['a number', 42],
            ['an object', { a: 1 }],
            ['an array', ['gm']],
            ['null', null],
            ['an oversized string', 'x'.repeat(65)],
        ])('rejects %s', async (_l, handle) => {
            expect(await updateManagerHandle('abc', handle as string)).toEqual({ error: 'Invalid request' });
            expectUntouched();
        });

        it('still normalises and stores a valid handle', async () => {
            mockPrisma.event.update.mockResolvedValue({});
            expect(await updateManagerHandle('abc', '@GmSteve')).toEqual({ success: true, handle: '@gmsteve' });
            expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { slug: 'abc' }, data: { managerTelegram: 'gmsteve' } });
        });

        it('keeps its own message for a blank handle', async () => {
            expect(await updateManagerHandle('abc', '  ')).toEqual({ error: 'Handle must be at least 2 characters.' });
            expect(mockPrisma.event.update).not.toHaveBeenCalled();
        });
    });

    describe('updateTelegramInviteLink', () => {
        it.each([
            ['a number', 42],
            ['an object', { startsWith: () => true }],
            ['an array', ['https://t.me/x']],
            ['null', null],
            ['an oversized link', 'https://t.me/' + 'x'.repeat(200)],
        ])('rejects %s', async (_l, link) => {
            expect(await updateTelegramInviteLink('abc', link as string)).toEqual({ error: 'Invalid request' });
            expectUntouched();
        });

        it('still stores a valid link', async () => {
            mockPrisma.event.update.mockResolvedValue({});
            expect(await updateTelegramInviteLink('abc', 'https://t.me/joinchat/abc')).toEqual({ success: true });
            expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { slug: 'abc' }, data: { telegramLink: 'https://t.me/joinchat/abc' } });
        });

        it('keeps its own message for a link that is not a t.me link', async () => {
            expect(await updateTelegramInviteLink('abc', 'https://example.com')).toEqual({
                error: 'Invalid Telegram link. It should start with https://t.me/',
            });
        });
    });

    describe('updateReminderSettings', () => {
        it.each([
            ['non-boolean enabled', 'yes', '09:00', [1]],
            ['non-string time', true, 900, [1]],
            ['non-array days', true, '09:00', '1,2'],
            ['out of range days', true, '09:00', [9]],
            ['oversized days', true, '09:00', [0, 1, 2, 3, 4, 5, 6, 6]],
        ])('rejects %s without writing', async (_l, enabled, time, days) => {
            const res = await updateReminderSettings('abc', enabled as boolean, time as string, days as number[]);
            expect(res).toMatchObject({ success: false });
            expect(mockPrisma.event.update).not.toHaveBeenCalled();
        });

        it('still reaches the lookup for valid arguments', async () => {
            expect(await updateReminderSettings('abc', true, '09:00', [1, 2])).toEqual({ success: false, error: 'Event not found' });
            expect(mockPrisma.event.findUnique).toHaveBeenCalledTimes(1);
        });
    });

    describe('updateSessionReminderSettings', () => {
        it.each([
            ['non-boolean enabled', 'yes', 120],
            ['string lead', true, '120'],
            ['unsupported lead', true, 7],
            ['NaN lead', true, NaN],
        ])('rejects %s without writing', async (_l, enabled, lead) => {
            const res = await updateSessionReminderSettings('abc', enabled as boolean, lead as number);
            expect(res).toEqual({ success: false, error: 'Invalid lead time' });
            expect(mockPrisma.event.update).not.toHaveBeenCalled();
        });

        it('still reaches the lookup for valid arguments', async () => {
            expect(await updateSessionReminderSettings('abc', true, 1440)).toEqual({ success: false, error: 'Event not found' });
            expect(mockPrisma.event.findUnique).toHaveBeenCalledTimes(1);
        });
    });

    describe('valid slugs still reach the existing path', () => {
        it.each([
            ['checkManagerStatus', () => checkManagerStatus('abc')],
            ['checkEventStatus', () => checkEventStatus('abc')],
            ['deleteEvent', () => deleteEvent('abc')],
            ['cancelEvent', () => cancelEvent('abc')],
        ])('%s', async (_name, call) => {
            await call();
            expect(mockPrisma.event.findUnique).toHaveBeenCalledTimes(1);
        });
    });
});
