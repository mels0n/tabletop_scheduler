import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    recoverManagerLink,
    dmManagerLink,
    startTelegramRecovery,
    connectCommandForAdmin,
} from './recovery';
import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth/server/verify';

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
    isDelivered: () => false,
}));

const mockPrisma = prisma as unknown as {
    event: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};
const mockAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;

const rejected = { error: 'Invalid request', code: 'validation' };

const badSlugs: unknown[] = [123, null, undefined, {}, '', 'a b', 'a/b', 'a.b', 'x'.repeat(65)];

describe('recovery actions validate their arguments before any lookup', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockPrisma.event.findUnique.mockResolvedValue(null);
        mockAdmin.mockResolvedValue(true);
    });

    describe('recoverManagerLink', () => {
        it.each(badSlugs.map((s) => [String(s), s]))('rejects slug %s', async (_l, slug) => {
            expect(await recoverManagerLink(slug as string, 'gm')).toEqual(rejected);
            expect(mockPrisma.event.findUnique).not.toHaveBeenCalled();
        });

        it.each([
            ['non-string handle', { a: 1 }],
            ['array handle', ['gm']],
            ['oversized handle', 'x'.repeat(65)],
        ])('rejects %s', async (_l, handle) => {
            expect(await recoverManagerLink('abc', handle as string)).toEqual(rejected);
            expect(mockPrisma.event.findUnique).not.toHaveBeenCalled();
        });

        it('still reaches the lookup for valid arguments', async () => {
            expect(await recoverManagerLink('abc', '@GmSteve')).toEqual({ error: 'No manager linked to this event.' });
            expect(mockPrisma.event.findUnique).toHaveBeenCalledTimes(1);
        });
    });

    describe('dmManagerLink', () => {
        it.each(badSlugs.map((s) => [String(s), s]))('rejects slug %s', async (_l, slug) => {
            expect(await dmManagerLink(slug as string, 'discord')).toEqual(rejected);
            expect(mockAdmin).not.toHaveBeenCalled();
            expect(mockPrisma.event.findUnique).not.toHaveBeenCalled();
        });

        it('still reaches the lookup for a valid slug', async () => {
            expect(await dmManagerLink('abc', 'discord')).toEqual({ error: 'No linked manager to notify' });
            expect(mockAdmin).toHaveBeenCalledWith('abc');
            expect(mockPrisma.event.findUnique).toHaveBeenCalledTimes(1);
        });
    });

    describe('startTelegramRecovery', () => {
        it.each(badSlugs.map((s) => [String(s), s]))('rejects slug %s', async (_l, slug) => {
            expect(await startTelegramRecovery(slug as string)).toEqual(rejected);
            expect(mockAdmin).not.toHaveBeenCalled();
            expect(mockPrisma.event.update).not.toHaveBeenCalled();
        });

        it('still mints a token for a valid slug', async () => {
            expect(await startTelegramRecovery('abc')).toMatchObject({ success: true });
            expect(mockPrisma.event.update).toHaveBeenCalledTimes(1);
        });
    });

    describe('connectCommandForAdmin', () => {
        it.each(badSlugs.map((s) => [String(s), s]))('rejects slug %s', async (_l, slug) => {
            expect(await connectCommandForAdmin(slug as string)).toEqual(rejected);
            expect(mockAdmin).not.toHaveBeenCalled();
            expect(mockPrisma.event.findUnique).not.toHaveBeenCalled();
        });

        it('still reaches the admin check for a valid slug', async () => {
            mockAdmin.mockResolvedValue(false);
            expect(await connectCommandForAdmin('abc')).toMatchObject({ code: 'forbidden' });
            expect(mockAdmin).toHaveBeenCalledWith('abc');
        });
    });
});
