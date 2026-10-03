import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import prisma from '@/shared/lib/prisma';
import { deliverWebhook, WebhookRefusedError } from './deliver';
import { processWebhookRow } from './process';
import { GET as cronGET } from '@/app/api/cron/webhooks/route';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';

vi.mock('@/shared/lib/prisma');
vi.mock('./deliver', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./deliver')>()),
    deliverWebhook: vi.fn(),
}));

const wh = prisma.webhookEvent as unknown as Record<'findFirst' | 'findMany' | 'update' | 'updateMany', ReturnType<typeof vi.fn>>;

function row(overrides: Record<string, unknown> = {}) {
    return { id: 'w1', eventId: 7, url: 'https://hooks.example/x', payload: '{}', attempts: 0, ...overrides };
}

beforeEach(() => {
    vi.clearAllMocks();
    wh.findFirst.mockReset();
    wh.findMany.mockReset();
    wh.update.mockReset();
    wh.updateMany.mockReset();
    (deliverWebhook as any).mockReset();
});

describe('processWebhookRow', () => {
    it('claims the single row with the same conditional update the cron uses', async () => {
        wh.updateMany.mockResolvedValue({ count: 1 });
        wh.findFirst.mockResolvedValue(row());
        (deliverWebhook as any).mockResolvedValue(undefined);

        await processWebhookRow('w1');

        const claim = wh.updateMany.mock.calls[0][0];
        expect(claim.where.id).toBe('w1');
        expect(claim.where.status).toEqual({ in: ['PENDING', 'RETRY'] });
        expect(claim.where.nextAttempt).toEqual({ lte: expect.any(Date) });
        expect(claim.where.OR).toEqual([{ lockedAt: null }, { lockedAt: { lt: expect.any(Date) } }]);
        expect(claim.data.lockedAt).toBeInstanceOf(Date);
        expect(wh.findFirst).toHaveBeenCalledWith({ where: { id: 'w1', lockedAt: claim.data.lockedAt } });
    });

    it('returns skipped and delivers nothing when the claim matches no row', async () => {
        wh.updateMany.mockResolvedValue({ count: 0 });

        expect(await processWebhookRow('w1')).toBe('skipped');
        expect(wh.findFirst).not.toHaveBeenCalled();
        expect(deliverWebhook).not.toHaveBeenCalled();
        expect(wh.update).not.toHaveBeenCalled();
    });

    it('returns skipped when the claimed row is gone by the time it is read', async () => {
        wh.updateMany.mockResolvedValue({ count: 1 });
        wh.findFirst.mockResolvedValue(null);

        expect(await processWebhookRow('w1')).toBe('skipped');
        expect(deliverWebhook).not.toHaveBeenCalled();
    });

    it('marks a delivered row DELIVERED and releases the lock', async () => {
        wh.updateMany.mockResolvedValue({ count: 1 });
        wh.findFirst.mockResolvedValue(row());
        (deliverWebhook as any).mockResolvedValue(undefined);

        expect(await processWebhookRow('w1')).toBe('delivered');
        expect(wh.update).toHaveBeenCalledWith({
            where: { id: 'w1' },
            data: { status: 'DELIVERED', attempts: { increment: 1 }, lockedAt: null },
        });
    });

    it('marks a refused destination FAILED at once', async () => {
        wh.updateMany.mockResolvedValue({ count: 1 });
        wh.findFirst.mockResolvedValue(row());
        (deliverWebhook as any).mockRejectedValue(new WebhookRefusedError('private address'));

        expect(await processWebhookRow('w1')).toBe('failed');
        expect(wh.update).toHaveBeenCalledWith({
            where: { id: 'w1' },
            data: { status: 'FAILED', attempts: 1, lockedAt: null },
        });
    });

    it('marks the row FAILED when the 12th attempt fails', async () => {
        wh.updateMany.mockResolvedValue({ count: 1 });
        wh.findFirst.mockResolvedValue(row({ attempts: 11 }));
        (deliverWebhook as any).mockRejectedValue(new Error('HTTP 503'));

        expect(await processWebhookRow('w1')).toBe('failed');
        expect(wh.update.mock.calls[0][0].data).toEqual({ status: 'FAILED', attempts: 12, lockedAt: null });
    });

    describe('a failed immediate attempt is left for the cron', () => {
        beforeEach(() => {
            stubConfigEnv({ CRON_SECRET: 'cron-secret' });
            resetServerConfigForTests();
        });
        afterEach(() => {
            vi.unstubAllEnvs();
            resetServerConfigForTests();
        });

        it('marks RETRY with a 5 minute backoff, then the cron delivers it', async () => {
            wh.updateMany.mockResolvedValue({ count: 1 });
            wh.findFirst.mockResolvedValue(row());
            (deliverWebhook as any).mockRejectedValueOnce(new Error('HTTP 500'));

            const before = Date.now();
            expect(await processWebhookRow('w1')).toBe('retry');
            const retry = wh.update.mock.calls[0][0];
            expect(retry.where).toEqual({ id: 'w1' });
            expect(retry.data.status).toBe('RETRY');
            expect(retry.data.attempts).toBe(1);
            expect(retry.data.lockedAt).toBeNull();
            expect(retry.data.nextAttempt.getTime() - before).toBeGreaterThanOrEqual(5 * 60 * 1000);

            // Later cron run: the RETRY row is due again and is claimed and delivered.
            wh.findMany
                .mockResolvedValueOnce([{ id: 'w1' }])
                .mockResolvedValueOnce([row({ attempts: 1 })]);
            (deliverWebhook as any).mockResolvedValueOnce(undefined);

            const res = await cronGET(new Request('http://localhost/api/cron/webhooks', {
                headers: { authorization: 'Bearer cron-secret' },
            }));

            expect(await res.json()).toEqual({ processed: 1, sent: 1, retried: 0, failed: 0, deferred: 0 });
            expect(wh.update).toHaveBeenLastCalledWith({
                where: { id: 'w1' },
                data: { status: 'DELIVERED', attempts: { increment: 1 }, lockedAt: null },
            });
        });
    });
});
