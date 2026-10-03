import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({ default: { lookup: lookupMock }, lookup: lookupMock }));

import { deliverWebhook, WebhookRefusedError } from './deliver';

const row = { id: 'wh-1', eventId: 7, url: 'https://example.com/hook', payload: '{"type":"CREATED"}' };

function resolvesTo(...addresses: string[]) {
    lookupMock.mockResolvedValue(addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })));
}

describe('deliverWebhook', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        lookupMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        stubConfigEnv({ SESSION_SECRET: 'session-secret-for-tests', CRON_SECRET: 'cron-secret-for-tests' });
        resetServerConfigForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        resetServerConfigForTests();
    });

    it('signs the raw body, refuses redirects and sets a timeout', async () => {
        resolvesTo('93.184.216.34');
        fetchMock.mockResolvedValue({ ok: true, status: 200 });

        await expect(deliverWebhook(row)).resolves.toBeUndefined();

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(row.url);
        expect(init.method).toBe('POST');
        expect(init.redirect).toBe('manual');
        expect(init.signal).toBeInstanceOf(AbortSignal);
        expect(init.body).toBe(row.payload);
        expect(init.headers['X-Webhook-Id']).toBe('wh-1');
        const key = createHmac('sha256', 'session-secret-for-tests').update('webhook-signing').digest('hex');
        const expected = createHmac('sha256', key).update(row.payload).digest('hex');
        expect(init.headers['X-Tabletop-Signature']).toBe(`sha256=${expected}`);
    });

    it('always signs, even when CRON_SECRET is not set', async () => {
        stubConfigEnv({ SESSION_SECRET: 'session-secret-for-tests' });
        resetServerConfigForTests();
        resolvesTo('93.184.216.34');
        fetchMock.mockResolvedValue({ ok: true, status: 200 });

        await deliverWebhook(row);

        expect(fetchMock.mock.calls[0][1].headers['X-Tabletop-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
    });

    it('never sends to a URL that now resolves to a private address', async () => {
        resolvesTo('10.0.0.5');

        await expect(deliverWebhook(row)).rejects.toBeInstanceOf(WebhookRefusedError);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a non-https destination without resolving it', async () => {
        await expect(deliverWebhook({ ...row, url: 'http://example.com/hook' })).rejects.toBeInstanceOf(WebhookRefusedError);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('treats a redirect response as a failed attempt', async () => {
        resolvesTo('93.184.216.34');
        fetchMock.mockResolvedValue({ ok: false, status: 302 });

        await expect(deliverWebhook(row)).rejects.toThrow('HTTP 302');
    });
});
