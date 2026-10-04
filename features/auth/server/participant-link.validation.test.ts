import { describe, it, expect, vi, beforeEach } from 'vitest';
import { linkParticipant, unlinkParticipant } from './participant-link';
import { cookies } from 'next/headers';
import prisma from '@/shared/lib/prisma';

vi.mock('@/shared/lib/prisma');

const mockPrisma = prisma as unknown as {
    event: { findUnique: ReturnType<typeof vi.fn> },
    participant: { findUnique: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn>, updateMany: ReturnType<typeof vi.fn> }
};

const valid = { slug: 'my-slug', participantId: 5, platform: 'telegram' as const };

const badParams: [string, unknown][] = [
    ['undefined', undefined],
    ['null', null],
    ['a string', 'my-slug'],
    ['missing fields', {}],
    ['non-string slug', { ...valid, slug: 123 }],
    ['slug with a space', { ...valid, slug: 'my slug' }],
    ['slug with a slash', { ...valid, slug: 'a/b' }],
    ['oversized slug', { ...valid, slug: 'x'.repeat(65) }],
    ['string participant id', { ...valid, participantId: '5' }],
    ['fractional participant id', { ...valid, participantId: 5.5 }],
    ['zero participant id', { ...valid, participantId: 0 }],
    ['negative participant id', { ...valid, participantId: -1 }],
    ['participant id beyond 32 bits', { ...valid, participantId: 2 ** 40 }],
    ['unknown platform', { ...valid, platform: 'slack' }],
    ['object platform', { ...valid, platform: { toString: () => 'telegram' } }],
];

describe('participant-link actions validate their arguments before any lookup', () => {
    const mockCookieStore = { get: vi.fn(), set: vi.fn() };

    beforeEach(() => {
        vi.resetAllMocks();
        (cookies as any).mockReturnValue(mockCookieStore);
        mockPrisma.event.findUnique.mockResolvedValue(null);
    });

    describe.each([
        ['linkParticipant', linkParticipant],
        ['unlinkParticipant', unlinkParticipant],
    ])('%s', (_name, action) => {
        it.each(badParams)('rejects %s', async (_label, params) => {
            expect(await action(params as typeof valid)).toEqual({ error: 'Invalid request.' });

            expect(mockPrisma.event.findUnique).not.toHaveBeenCalled();
            expect(mockPrisma.participant.findUnique).not.toHaveBeenCalled();
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
            expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
            expect(mockCookieStore.set).not.toHaveBeenCalled();
        });

        it('still reaches the event lookup for valid arguments', async () => {
            expect(await action(valid)).toEqual({ error: 'Event not found.' });
            expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({
                where: { slug: 'my-slug' },
                select: { id: true, slug: true },
            });
        });
    });
});
