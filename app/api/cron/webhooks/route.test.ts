import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import prisma from '@/shared/lib/prisma';
import { deliverWebhook, WebhookRefusedError } from '@/features/integrations/webhooks/server/deliver';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/integrations/webhooks/server/deliver', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/integrations/webhooks/server/deliver')>()),
    deliverWebhook: vi.fn(),
}));

const SECRET = 'cron-secret';
const wh = prisma.webhookEvent as unknown as Record<'findMany' | 'update' | 'updateMany', ReturnType<typeof vi.fn>>;

function req(auth: string | null = `Bearer ${SECRET}`) {
    return new Request('http://localhost/api/cron/webhooks', {
        headers: auth ? { authorization: auth } : {},
    });
}

function row(overrides: Record<string, unknown> = {}) {
    return { id: 'w1', eventId: 7, url: 'https://hooks.example/x', payload: '{}', attempts: 0, ...overrides };
}

beforeEach(() => {
    vi.clearAllMocks();
    stubConfigEnv({ CRON_SECRET: SECRET });
    resetServerConfigForTests();
});

afterEach(() => {
    vi.unstubAllEnvs();
    resetServerConfigForTests();
});

describe('GET /api/cron/webhooks', () => {
    it('rejects an unauthenticated call with 401 and touches nothing', async () => {
        const res = await GET(req(null));
        expect(res.status).toBe(401);
        expect(wh.findMany).not.toHaveBeenCalled();
        expect(deliverWebhook).not.toHaveBeenCalled();
    });

    it('rejects a wrong secret with 401', async () => {
        const res = await GET(req('Bearer nope'));
        expect(res.status).toBe(401);
    });

    it('processes a row once across two overlapping runs', async () => {
        wh.findMany
            .mockResolvedValueOnce([{ id: 'w1' }])   // run A: candidates
            .mockResolvedValueOnce([{ id: 'w1' }])   // run B: candidates (sees it before A locks)
            .mockResolvedValueOnce([row()]);         // run A: claimed rows
        wh.updateMany
            .mockResolvedValueOnce({ count: 1 })     // A wins the claim
            .mockResolvedValueOnce({ count: 0 });    // B loses it
        (deliverWebhook as any).mockResolvedValue(undefined);

        const [a, b] = await Promise.all([GET(req()), GET(req())]);
        const bodies = [await a.json(), await b.json()];

        expect(deliverWebhook).toHaveBeenCalledTimes(1);
        expect(bodies.map(x => x.processed).sort()).toEqual([0, 1]);
        expect(wh.update).toHaveBeenCalledTimes(1);
    });

    it('claims with a lock stamp and a stale-lock check', async () => {
        wh.findMany.mockResolvedValueOnce([{ id: 'w1' }]).mockResolvedValueOnce([row()]);
        wh.updateMany.mockResolvedValue({ count: 1 });
        (deliverWebhook as any).mockResolvedValue(undefined);

        await GET(req());

        const claim = wh.updateMany.mock.calls[0][0];
        expect(claim.data.lockedAt).toBeInstanceOf(Date);
        expect(claim.where.OR).toEqual([{ lockedAt: null }, { lockedAt: { lt: expect.any(Date) } }]);
        expect(claim.where.status).toEqual({ in: ['PENDING', 'RETRY'] });
        expect(wh.findMany.mock.calls[0][0].take).toBe(50);
    });

    it('marks a delivered row DELIVERED and releases the lock', async () => {
        wh.findMany.mockResolvedValueOnce([{ id: 'w1' }]).mockResolvedValueOnce([row()]);
        wh.updateMany.mockResolvedValue({ count: 1 });
        (deliverWebhook as any).mockResolvedValue(undefined);

        const res = await GET(req());

        expect(await res.json()).toEqual({ processed: 1, sent: 1, retried: 0, failed: 0, deferred: 0 });
        expect(wh.update).toHaveBeenCalledWith({
            where: { id: 'w1' },
            data: { status: 'DELIVERED', attempts: { increment: 1 }, lockedAt: null },
        });
    });

    it('schedules a RETRY with attempts 1 and a 5 minute backoff after a failure', async () => {
        wh.findMany.mockResolvedValueOnce([{ id: 'w1' }]).mockResolvedValueOnce([row()]);
        wh.updateMany.mockResolvedValue({ count: 1 });
        (deliverWebhook as any).mockRejectedValue(new Error('HTTP 500'));

        const before = Date.now();
        const res = await GET(req());

        expect(await res.json()).toEqual({ processed: 1, sent: 0, retried: 1, failed: 0, deferred: 0 });
        const data = wh.update.mock.calls[0][0].data;
        expect(data.status).toBe('RETRY');
        expect(data.attempts).toBe(1);
        expect(data.lockedAt).toBeNull();
        expect(data.nextAttempt.getTime() - before).toBeGreaterThanOrEqual(5 * 60 * 1000);
        expect(data.nextAttempt.getTime() - before).toBeLessThan(5 * 60 * 1000 + 5000);
    });

    it('backs off quadratically (attempt 3 waits 45 minutes)', async () => {
        wh.findMany.mockResolvedValueOnce([{ id: 'w1' }]).mockResolvedValueOnce([row({ attempts: 2 })]);
        wh.updateMany.mockResolvedValue({ count: 1 });
        (deliverWebhook as any).mockRejectedValue(new Error('timeout'));

        const before = Date.now();
        await GET(req());

        const data = wh.update.mock.calls[0][0].data;
        expect(data.attempts).toBe(3);
        expect(data.nextAttempt.getTime() - before).toBeGreaterThanOrEqual(45 * 60 * 1000);
    });

    it('marks a row FAILED when the 12th attempt fails', async () => {
        wh.findMany.mockResolvedValueOnce([{ id: 'w1' }]).mockResolvedValueOnce([row({ attempts: 11 })]);
        wh.updateMany.mockResolvedValue({ count: 1 });
        (deliverWebhook as any).mockRejectedValue(new Error('HTTP 503'));

        const res = await GET(req());

        expect(await res.json()).toEqual({ processed: 1, sent: 0, retried: 0, failed: 1, deferred: 0 });
        expect(wh.update).toHaveBeenCalledWith({
            where: { id: 'w1' },
            data: { status: 'FAILED', attempts: 12, lockedAt: null },
        });
    });

    it('marks a refused destination FAILED on the first attempt, without retrying', async () => {
        wh.findMany.mockResolvedValueOnce([{ id: 'w1' }]).mockResolvedValueOnce([row()]);
        wh.updateMany.mockResolvedValue({ count: 1 });
        (deliverWebhook as any).mockRejectedValue(new WebhookRefusedError('Webhook URL must resolve to a public address'));

        const res = await GET(req());

        expect(await res.json()).toEqual({ processed: 1, sent: 0, retried: 0, failed: 1, deferred: 0 });
        expect(wh.update).toHaveBeenCalledWith({
            where: { id: 'w1' },
            data: { status: 'FAILED', attempts: 1, lockedAt: null },
        });
    });

    it('stops starting rows after 45 seconds and releases the rest of the claim', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            const start = new Date('2026-10-03T12:00:00Z');
            vi.setSystemTime(start);
            wh.findMany
                .mockResolvedValueOnce([{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }, { id: 'w4' }])
                .mockResolvedValueOnce([row({ id: 'w1' }), row({ id: 'w2' }), row({ id: 'w3' }), row({ id: 'w4' })]);
            wh.updateMany.mockResolvedValue({ count: 4 });
            // Each delivery takes 30 seconds: w1 starts at 0 s, w2 at 30 s, w3 would start at 60 s.
            (deliverWebhook as any).mockImplementation(async () => {
                vi.setSystemTime(new Date(Date.now() + 30_000));
            });

            const res = await GET(req());

            expect(deliverWebhook).toHaveBeenCalledTimes(2);
            expect(await res.json()).toEqual({ processed: 2, sent: 2, retried: 0, failed: 0, deferred: 2 });
            expect(wh.updateMany).toHaveBeenLastCalledWith({
                where: { id: { in: ['w3', 'w4'] }, lockedAt: start },
                data: { lockedAt: null },
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it('returns 500 only when the run itself throws', async () => {
        wh.findMany.mockRejectedValueOnce(new Error('db down'));
        const res = await GET(req());
        expect(res.status).toBe(500);
    });
});
