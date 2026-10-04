import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/verify', () => ({ verifyEventAdmin: vi.fn() }));
vi.mock('@/features/event-management/server/dashboard-sync', () => ({ pushSlotUpdates: vi.fn() }));

import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth/server/verify';
import { POST } from './route';
import { PATCH, DELETE } from './[slotId]/route';
import { POST as SUGGEST } from './suggest/route';

const mockPrisma = prisma as any;
const slot = { startTime: '2026-11-01T18:00:00.000Z', endTime: '2026-11-01T22:00:00.000Z' };
const draft = { id: 1, slug: 'evt', status: 'DRAFT' };

function jsonRequest(body: unknown) {
    const json = vi.fn(async () => body);
    return { req: { json, headers: new Headers() } as unknown as Request, json };
}

const slugParams = { params: Promise.resolve({ slug: 'evt' }) };
const slotParams = (slotId: string) => ({ params: Promise.resolve({ slug: 'evt', slotId }) });

describe('slot routes', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        (verifyEventAdmin as any).mockResolvedValue(true);
        mockPrisma.event.findUnique.mockResolvedValue(draft);
        mockPrisma.timeSlot.create.mockResolvedValue({ id: 5, eventId: 1, ...slot, sessionReminderSentAt: null });
        mockPrisma.timeSlot.findFirst.mockResolvedValue({ id: 5, eventId: 1 });
        mockPrisma.$transaction.mockResolvedValue([]);
    });

    it('POST: non-admin gets 403 before the body is read', async () => {
        (verifyEventAdmin as any).mockResolvedValue(false);
        const { req, json } = jsonRequest(slot);

        const res = await POST(req, slugParams);

        expect(res.status).toBe(403);
        expect(json).not.toHaveBeenCalled();
    });

    it('POST: rejects invalid dates and end-before-start with 400', async () => {
        expect((await POST(jsonRequest({ startTime: 'garbage', endTime: slot.endTime }).req, slugParams)).status).toBe(400);
        expect((await POST(jsonRequest({ startTime: slot.endTime, endTime: slot.startTime }).req, slugParams)).status).toBe(400);
        expect(mockPrisma.timeSlot.create).not.toHaveBeenCalled();
    });

    it('POST: returns only public slot fields', async () => {
        const res = await POST(jsonRequest(slot).req, slugParams);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.slot).toEqual({ id: 5, startTime: slot.startTime, endTime: slot.endTime });
    });

    it('PATCH: a slot from another event is 404 and nothing changes', async () => {
        mockPrisma.timeSlot.findFirst.mockResolvedValue(null);

        const res = await PATCH(jsonRequest(slot).req, slotParams('999'));

        expect(res.status).toBe(404);
        expect(mockPrisma.timeSlot.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 999, eventId: 1 } }));
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('PATCH: non-numeric slot ID is 400', async () => {
        expect((await PATCH(jsonRequest(slot).req, slotParams('abc'))).status).toBe(400);
    });

    it('DELETE: non-admin is 403', async () => {
        (verifyEventAdmin as any).mockResolvedValue(false);
        expect((await DELETE(jsonRequest({}).req, slotParams('5'))).status).toBe(403);
    });

    it('DELETE: a slot from another event is 404', async () => {
        mockPrisma.timeSlot.findFirst.mockResolvedValue(null);
        expect((await DELETE(jsonRequest({}).req, slotParams('5'))).status).toBe(404);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('PATCH and DELETE refuse finalized events', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...draft, status: 'FINALIZED' });
        expect((await PATCH(jsonRequest(slot).req, slotParams('5'))).status).toBe(400);
        expect((await DELETE(jsonRequest({}).req, slotParams('5'))).status).toBe(400);
    });

    it('POST: refuses a new slot once the event has the maximum number of time options', async () => {
        mockPrisma.timeSlot.count.mockResolvedValue(500);

        const res = await POST(jsonRequest(slot).req, slugParams);

        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('This event already has the maximum number of time options.');
        expect(mockPrisma.timeSlot.count).toHaveBeenCalledWith({ where: { eventId: 1 } });
        expect(mockPrisma.timeSlot.create).not.toHaveBeenCalled();
    });

    it('POST: still adds a slot below the maximum', async () => {
        mockPrisma.timeSlot.count.mockResolvedValue(499);
        expect((await POST(jsonRequest(slot).req, slugParams)).status).toBe(200);
        expect(mockPrisma.timeSlot.create).toHaveBeenCalled();
    });

    it('SUGGEST: refuses a suggestion once the event has the maximum number of time options', async () => {
        mockPrisma.timeSlot.count.mockResolvedValue(500);

        const res = await SUGGEST(jsonRequest({ ...slot, suggesterName: 'Dee' }).req, slugParams);

        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('This event already has the maximum number of time options.');
        expect(mockPrisma.timeSlot.count).toHaveBeenCalledWith({ where: { eventId: 1 } });
        expect(mockPrisma.timeSlot.create).not.toHaveBeenCalled();
    });

    it('SUGGEST: validates the body', async () => {
        expect((await SUGGEST(jsonRequest({ ...slot, suggesterName: '' }).req, slugParams)).status).toBe(400);
        expect((await SUGGEST(jsonRequest({ ...slot, suggesterName: 'Dee' }).req, slugParams)).status).toBe(200);
    });
});
