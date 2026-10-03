import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkManagerStatus } from './actions';
import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth/server/actions';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/actions', () => ({ verifyEventAdmin: vi.fn() }));

const mockPrisma = prisma as unknown as { event: { findUnique: ReturnType<typeof vi.fn> } };
const mockAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;

describe('checkManagerStatus', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockPrisma.event.findUnique.mockResolvedValue({ managerChatId: '555', managerTelegram: '@steve' });
    });

    it('returns only a boolean to a non-admin (the manager handle is not public)', async () => {
        mockAdmin.mockResolvedValue(false);
        expect(await checkManagerStatus('abc')).toEqual({ hasManagerChatId: true });
    });

    it('includes the handle for the admin', async () => {
        mockAdmin.mockResolvedValue(true);
        expect(await checkManagerStatus('abc')).toEqual({ hasManagerChatId: true, handle: '@steve' });
    });
});
