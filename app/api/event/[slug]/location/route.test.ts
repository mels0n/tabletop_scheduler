import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/verify', () => ({ verifyEventAdmin: vi.fn() }));
vi.mock('@/features/event-management/server/dashboard-sync', () => ({ syncDashboard: vi.fn() }));

import { POST } from './route';
import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth/server/verify';
import { syncDashboard } from '@/features/event-management/server/dashboard-sync';

const mockPrisma = prisma as unknown as { event: { update: ReturnType<typeof vi.fn> } };

const call = (body: unknown = { location: 'New place' }) =>
    POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ slug: 's' }) });

describe('location update', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        (verifyEventAdmin as any).mockResolvedValue(true);
        mockPrisma.event.update.mockResolvedValue({ id: 7, location: 'New place' });
    });

    it('stores the location and re-renders the full dashboard through syncDashboard', async () => {
        const res = await call();

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ success: true, location: 'New place' });
        expect(mockPrisma.event.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { slug: 's' },
            data: { location: 'New place' },
        }));
        // syncDashboard rebuilds the message with attendee and waitlist names on both platforms.
        expect(syncDashboard).toHaveBeenCalledWith(7);
    });

    it('rejects non-admins with 403 and changes nothing', async () => {
        (verifyEventAdmin as any).mockResolvedValue(false);

        const res = await call();

        expect(res.status).toBe(403);
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(syncDashboard).not.toHaveBeenCalled();
    });

    it('rejects an invalid body with 400', async () => {
        const res = await call({ location: 'x'.repeat(201) });

        expect(res.status).toBe(400);
        expect(syncDashboard).not.toHaveBeenCalled();
    });
});
