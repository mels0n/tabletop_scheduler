import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import prisma from '@/shared/lib/prisma';

vi.mock('@/shared/lib/prisma');

function makeRequest(slugs: string[]) {
    return new NextRequest('http://localhost/api/events/validate', {
        method: 'POST',
        body: JSON.stringify({ slugs }),
    });
}

describe('POST /api/events/validate', () => {
    it('returns each event\'s numeric id alongside status/scheduledDate', async () => {
        (prisma.event.findMany as any).mockResolvedValue([
            {
                id: 42,
                slug: 'my-event',
                status: 'ACTIVE',
                finalizedSlotId: null,
                timeSlots: [],
                finalizedSessions: [],
            },
        ]);

        const res = await POST(makeRequest(['my-event']));
        const body = await res.json();

        expect(body.validSlugs).toEqual(['my-event']);
        expect(body.events).toEqual([
            { slug: 'my-event', id: 42, status: 'ACTIVE', scheduledDate: undefined },
        ]);
    });

    it('returns empty arrays without querying the DB when no slugs are given', async () => {
        const res = await POST(makeRequest([]));
        const body = await res.json();

        expect(body).toEqual({ validSlugs: [], events: [] });
        expect(prisma.event.findMany).not.toHaveBeenCalled();
    });
});
