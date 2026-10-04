import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import prisma from '@/shared/lib/prisma';
import { sendDirectMessage } from '@/features/notifications';
import { verifyEventAdmin } from '@/features/auth/server/verify';
import { redirect } from 'next/navigation';
import { stubConfigEnv } from '@/shared/config/test-env';
import { resetServerConfigForTests } from '@/shared/config/server';

// The real url module is used on purpose: these tests prove that finalizing on a self-hosted
// install with no NEXT_PUBLIC_BASE_URL (and no bots) commits and answers normally.
vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/verify', () => ({ verifyEventAdmin: vi.fn() }));
vi.mock('@/features/notifications', () => ({ sendDirectMessage: vi.fn(), broadcastToEvent: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
// The immediate webhook attempt is scheduled with after(); here it is only recorded.
vi.mock('next/server', async (importOriginal) => ({
    ...(await importOriginal<typeof import('next/server')>()),
    after: vi.fn(),
}));

const mockPrisma = prisma as any;
const at = new Date('2026-01-01T00:00:00Z');
const meta = { id: 1, status: 'DRAFT', maxPlayers: 4, minPlayers: 1, title: 'Game Night', eventType: 'ONE_SHOT', minSessions: null, timezone: 'UTC' };
const finalized = {
    id: 1, slug: 'evt', title: 'Game Night', fromUrl: 'https://hooks.example/f', fromUrlId: null,
    telegramChatId: null, pinnedMessageId: null, discordChannelId: null, discordMessageId: null,
    timeSlots: [{ id: 3, startTime: at, endTime: at }], finalizedSlotId: 3, location: null,
    description: null, finalizedHost: null, timezone: 'UTC',
};
const vote = { participantId: 7, preference: 'YES', createdAt: at, participant: { id: 7, name: 'Dee', chatId: 'c-7', discordId: null } };
const params = { params: Promise.resolve({ slug: 'evt' }) };

describe('POST /api/event/[slug]/finalize without NEXT_PUBLIC_BASE_URL', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        stubConfigEnv({});
        resetServerConfigForTests();
        (verifyEventAdmin as any).mockResolvedValue(true);
        mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.vote.findMany.mockResolvedValue([vote]);
        mockPrisma.participant.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.finalizedSession.createMany.mockResolvedValue({ count: 1 });
        mockPrisma.webhookEvent.create.mockResolvedValue({ id: 'wh-1' });
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        resetServerConfigForTests();
    });

    it('finalizes a one-shot, redirects, and queues a webhook without a link', async () => {
        mockPrisma.event.findUnique.mockResolvedValueOnce(meta).mockResolvedValueOnce(finalized);
        mockPrisma.timeSlot.findFirst.mockResolvedValue({ id: 3, eventId: 1, startTime: at, endTime: at });
        const form = new FormData();
        form.set('slotId', '3');

        const res = await POST({ formData: async () => form, headers: new Headers() } as unknown as Request, params);

        expect(res).toBeUndefined();
        expect(redirect).toHaveBeenCalledWith('/e/evt/manage');
        expect(mockPrisma.event.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1, status: 'DRAFT' } }));
        const payload = JSON.parse(mockPrisma.webhookEvent.create.mock.calls[0][0].data.payload);
        expect(payload.type).toBe('FINALIZED');
        expect(payload).not.toHaveProperty('link');
        const dm = (sendDirectMessage as any).mock.calls[0][1].html as string;
        expect(dm).toContain('You made the cut!');
        expect(dm).not.toContain('href');
    });

    it('finalizes a campaign with 200', async () => {
        mockPrisma.event.findUnique
            .mockResolvedValueOnce({ ...meta, eventType: 'CAMPAIGN' })
            .mockResolvedValueOnce({ ...finalized, finalizedSlotId: null });
        mockPrisma.timeSlot.findMany.mockResolvedValue([{ id: 3, eventId: 1, startTime: at, endTime: at }]);

        const res = await POST({ json: async () => ({ slotIds: [3] }), headers: new Headers({ 'content-type': 'application/json' }) } as unknown as Request, params);

        expect(res!.status).toBe(200);
        expect(mockPrisma.finalizedSession.createMany).toHaveBeenCalled();
        const payload = JSON.parse(mockPrisma.webhookEvent.create.mock.calls[0][0].data.payload);
        expect(payload).not.toHaveProperty('link');
    });
});
