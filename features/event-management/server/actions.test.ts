import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteEvent, updateManagerHandle } from '@/features/event-management/server/actions';
import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth/server/actions';

// Mock Dependencies
vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/actions', () => ({
    verifyEventAdmin: vi.fn(),
}));
vi.mock('@/features/telegram', () => ({
    sendTelegramMessage: vi.fn(),
    unpinChatMessage: vi.fn(),
}));

// Cast mocks
const mockVerifyAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as { event: { findUnique: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn>, delete: ReturnType<typeof vi.fn> }, $transaction: ReturnType<typeof vi.fn> };

describe('Event Management Actions', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('deleteEvent', () => {
        it('should return unauthorized if verifyEventAdmin fails', async () => {
            mockVerifyAdmin.mockResolvedValue(false);
            const result = await deleteEvent('slug');
            expect(result).toEqual({ error: "Unauthorized" });
        });

        it('should return error if event not found', async () => {
            mockVerifyAdmin.mockResolvedValue(true);
            mockPrisma.event.findUnique.mockResolvedValue(null);

            const result = await deleteEvent('slug');
            expect(result).toEqual({ error: "Event not found" });
        });

        it('should delete event via transaction if found', async () => {
            mockVerifyAdmin.mockResolvedValue(true);
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, title: 'Test Event', slug: 'slug' });

            // Mock transaction execution
            mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

            const result = await deleteEvent('slug');
            expect(result).toEqual({ success: true });
            expect(mockPrisma.$transaction).toHaveBeenCalled();
        });
    });

    describe('updateManagerHandle', () => {
        it('should enforce handle length', async () => {
            mockVerifyAdmin.mockResolvedValue(true);
            const result = await updateManagerHandle('slug', 'a');
            expect(result.error).toContain('at least 2 characters');
        });

        it('should prepend @ to handle', async () => {
            mockVerifyAdmin.mockResolvedValue(true);
            await updateManagerHandle('slug', 'chris');

            expect(mockPrisma.event.update).toHaveBeenCalledWith(expect.objectContaining({
                data: { managerTelegram: '@chris' }
            }));
        });
    });
});
