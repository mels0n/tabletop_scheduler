import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/prisma');

import prisma from '@/shared/lib/prisma';
import { GET } from './route';

const mockPrisma = prisma as any;
const start = new Date('2026-11-01T18:00:00Z');
const end = new Date('2026-11-01T22:00:00Z');

const event = {
    id: 1,
    slug: 'evt',
    status: 'FINALIZED',
    eventType: 'ONE_SHOT',
    title: 'Night\r\nATTENDEE:mailto:evil@example.com',
    description: 'Bring snacks; dice, and a \\ backslash\nSecond line',
    finalizedSlotId: 3,
    finalizedHost: { name: 'Dee, Host' },
    timeSlots: [{ id: 3, startTime: start, endTime: end }],
};

const params = { params: Promise.resolve({ slug: 'evt' }) };

describe('GET /api/event/[slug]/ics', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockPrisma.event.findUnique.mockResolvedValue(event);
    });

    it('escapes user text so a newline cannot inject properties', async () => {
        const res = await GET(new Request('https://tabletop.example/api/event/evt/ics'), params);
        const ics = await res.text();
        const lines = ics.split('\r\n');

        expect(lines.some((l) => l.startsWith('ATTENDEE'))).toBe(false);
        expect(ics).toContain('SUMMARY:Night\\nATTENDEE:mailto:evil@example.com');
        expect(ics).toContain('Bring snacks\\; dice\\, and a \\\\ backslash\\nSecond line');
        expect(ics).toContain('Hosted by Dee\\, Host.');
        expect(lines[0]).toBe('BEGIN:VCALENDAR');
        expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    });

    it('escapes campaign summaries and player names', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...event, eventType: 'CAMPAIGN', finalizedSlotId: null });
        const sessions = [{ id: 9, timeSlot: { startTime: start, endTime: end } }];
        mockPrisma.finalizedSession.findMany.mockResolvedValue(sessions);
        mockPrisma.participant.findMany.mockResolvedValue([{ name: 'Mal;lory\nX-INJECT:1' }]);

        const res = await GET(new Request('https://tabletop.example/api/event/evt/ics'), params);
        const ics = await res.text();

        expect(ics.split('\r\n').some((l) => l.startsWith('X-INJECT'))).toBe(false);
        expect(ics).toContain('Players: Mal\\;lory\\nX-INJECT:1');
    });

    it('returns 404 for an event that is not finalized', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...event, status: 'DRAFT' });
        const res = await GET(new Request('https://tabletop.example/api/event/evt/ics'), params);
        expect(res.status).toBe(404);
    });
});
