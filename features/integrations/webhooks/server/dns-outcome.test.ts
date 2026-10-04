import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import prisma from '@/shared/lib/prisma';
import { DNS_LOOKUP_TIMEOUT_MS } from '@/shared/lib/webhook-sender';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';

const { lookupMock, requestMock } = vi.hoisted(() => ({ lookupMock: vi.fn(), requestMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({ default: { lookup: lookupMock }, lookup: lookupMock }));
vi.mock('node:https', () => ({ default: { request: requestMock }, request: requestMock }));
vi.mock('@/shared/lib/prisma');

import { attemptClaimedWebhook } from './process';

const wh = prisma.webhookEvent as unknown as Record<'update', ReturnType<typeof vi.fn>>;
const row = { id: 'w1', eventId: 7, url: 'https://hooks.example/x', payload: '{}', attempts: 0 };

function recordedStatus(): string {
    return wh.update.mock.calls[0][0].data.status;
}

describe('webhook outcome when the destination cannot be vetted', () => {
    beforeEach(() => {
        lookupMock.mockReset();
        requestMock.mockReset();
        wh.update.mockReset();
        stubConfigEnv({ SESSION_SECRET: 'session-secret-for-tests' });
        resetServerConfigForTests();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
        resetServerConfigForTests();
    });

    it('schedules a RETRY when the DNS lookup times out', async () => {
        vi.useFakeTimers();
        lookupMock.mockReturnValue(new Promise(() => {}));

        const pending = attemptClaimedWebhook(row);
        await vi.advanceTimersByTimeAsync(DNS_LOOKUP_TIMEOUT_MS);

        expect(await pending).toBe('retry');
        expect(recordedStatus()).toBe('RETRY');
        expect(requestMock).not.toHaveBeenCalled();
    });

    it('schedules a RETRY on a temporary resolver failure (EAI_AGAIN)', async () => {
        lookupMock.mockRejectedValue(Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' }));

        expect(await attemptClaimedWebhook(row)).toBe('retry');
        expect(recordedStatus()).toBe('RETRY');
    });

    it('marks the row FAILED when the host resolves to a private address', async () => {
        lookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

        expect(await attemptClaimedWebhook(row)).toBe('failed');
        expect(recordedStatus()).toBe('FAILED');
        expect(requestMock).not.toHaveBeenCalled();
    });
});
