import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth', () => ({ verifyEventAdmin: vi.fn() }));
vi.mock('@/features/notifications', () => ({ sendDirectMessage: vi.fn() }));
vi.mock('@/features/event-management', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/event-management')>()),
    processWaitlistPromotion: vi.fn(),
    syncDashboard: vi.fn(),
}));

import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth';
import { sendDirectMessage } from '@/features/notifications';
import { processWaitlistPromotion, syncDashboard } from '@/features/event-management';
import { DELETE } from './route';

const mockPrisma = prisma as any;
const verifyAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;
const dm = sendDirectMessage as unknown as ReturnType<typeof vi.fn>;
const promote = processWaitlistPromotion as unknown as ReturnType<typeof vi.fn>;
const sync = syncDashboard as unknown as ReturnType<typeof vi.fn>;

const EVIL_TITLE = '<a href="https://evil">x</a>';

function call(slug = 'abc123', participantId = '42') {
    return DELETE(
        new Request(`https://tabletop.example/api/event/${slug}/participant/${participantId}`, { method: 'DELETE' }) as any,
        { params: Promise.resolve({ slug, participantId }) },
    );
}

function participant(overrides: Record<string, unknown> = {}) {
    return {
        id: 42,
        eventId: 7,
        status: 'ACCEPTED',
        chatId: '555',
        discordId: null,
        event: { status: 'FINALIZED', title: 'Game Night' },
        ...overrides,
    };
}

describe('DELETE /api/event/[slug]/participant/[participantId]', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        verifyAdmin.mockResolvedValue(true);
        mockPrisma.participant.findFirst.mockResolvedValue(participant());
        mockPrisma.participant.delete.mockResolvedValue({});
        mockPrisma.vote.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.$transaction.mockImplementation((arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma)));
        dm.mockResolvedValue({});
    });

    // Catches: deleting the verifyEventAdmin guard, or inverting it.
    it('returns 403 and performs no reads or writes for a non-admin', async () => {
        verifyAdmin.mockResolvedValue(false);

        const res = await call();

        expect(res.status).toBe(403);
        expect(verifyAdmin).toHaveBeenCalledWith('abc123');
        expect(mockPrisma.participant.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(mockPrisma.vote.deleteMany).not.toHaveBeenCalled();
        expect(mockPrisma.participant.delete).not.toHaveBeenCalled();
        expect(dm).not.toHaveBeenCalled();
        expect(promote).not.toHaveBeenCalled();
        expect(sync).not.toHaveBeenCalled();
    });

    // Catches: dropping the `event: { slug }` scope from the lookup, which would let an admin
    // of one event delete a participant of another by guessing ids (IDOR).
    it('returns 404 for a participant of another event and scopes the lookup by the event slug', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue(null);

        const res = await call('abc123', '42');

        expect(res.status).toBe(404);
        expect(mockPrisma.participant.findFirst).toHaveBeenCalledTimes(1);
        const arg = mockPrisma.participant.findFirst.mock.calls[0][0];
        expect(arg.where).toEqual({ id: 42, event: { slug: 'abc123' } });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(mockPrisma.participant.delete).not.toHaveBeenCalled();
        expect(dm).not.toHaveBeenCalled();
        expect(sync).not.toHaveBeenCalled();
    });

    // Catches: removing the idParam validation (a garbage id reaching Prisma).
    it('returns 400 for a malformed participant id and touches nothing', async () => {
        const res = await call('abc123', 'not-a-number');

        expect(res.status).toBe(400);
        expect(mockPrisma.participant.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.participant.delete).not.toHaveBeenCalled();
    });

    // Catches: removing the DM, sending it twice, or interpolating the title unescaped
    // (stored HTML injection into the Telegram message).
    it('sends exactly one DM with the escaped title for an ACCEPTED participant on a FINALIZED event', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue(
            participant({ chatId: '555', discordId: '999', event: { status: 'FINALIZED', title: EVIL_TITLE } }),
        );

        const res = await call();

        expect(res.status).toBe(200);
        expect(dm).toHaveBeenCalledTimes(1);
        const [targets, message, meta] = dm.mock.calls[0];
        expect(targets).toEqual({ telegramChatId: '555', discordUserId: '999' });
        expect(message.html).toContain('&lt;a href=&quot;https://evil&quot;&gt;x&lt;/a&gt;');
        expect(message.html).not.toContain(EVIL_TITLE);
        expect(message.discord).not.toContain(EVIL_TITLE);
        expect(meta).toMatchObject({ slug: 'abc123', participantId: 42, kind: 'participant-removed' });
    });

    // Catches: widening the DM condition so waitlisted/pending players are told they were removed
    // from an event they never had a seat in.
    it.each([
        ['PENDING participant on a FINALIZED event', { status: 'PENDING' }],
        ['ACCEPTED participant on an event that is not finalized', { event: { status: 'OPEN', title: 'Game Night' } }],
    ])('sends no DM for a %s', async (_label, overrides) => {
        mockPrisma.participant.findFirst.mockResolvedValue(participant(overrides));

        const res = await call();

        expect(res.status).toBe(200);
        expect(dm).not.toHaveBeenCalled();
        expect(mockPrisma.participant.delete).toHaveBeenCalledTimes(1);
    });

    // Catches: reordering (participant FK would fail with votes left), or deleting outside
    // the transaction so a crash leaves a half-removed participant.
    it('deletes votes then the participant inside one $transaction array', async () => {
        const order: string[] = [];
        mockPrisma.vote.deleteMany.mockImplementation(() => { order.push('vote.deleteMany'); return Promise.resolve({ count: 3 }); });
        mockPrisma.participant.delete.mockImplementation(() => { order.push('participant.delete'); return Promise.resolve({}); });

        await call();

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        const ops = mockPrisma.$transaction.mock.calls[0][0];
        expect(Array.isArray(ops)).toBe(true);
        expect(ops).toHaveLength(2);
        expect(order).toEqual(['vote.deleteMany', 'participant.delete']);
        expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
            where: { participantId: 42, participant: { eventId: 7 } },
        });
        expect(mockPrisma.participant.delete).toHaveBeenCalledWith({ where: { id: 42, eventId: 7 } });
    });

    // Catches: dropping the waitlist promotion or dashboard sync after a removal, or running
    // them before the delete has happened.
    it('runs waitlist promotion and dashboard sync with the event id after the delete', async () => {
        const order: string[] = [];
        mockPrisma.$transaction.mockImplementation(async (arg: any) => { order.push('transaction'); return Promise.all(arg); });
        promote.mockImplementation(async () => { order.push('promote'); });
        sync.mockImplementation(async () => { order.push('sync'); });

        const res = await call();

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ success: true });
        expect(promote).toHaveBeenCalledWith(7);
        expect(sync).toHaveBeenCalledWith(7);
        expect(order).toEqual(['transaction', 'promote', 'sync']);
    });
});
