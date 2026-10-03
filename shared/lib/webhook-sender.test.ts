import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({ default: { lookup: lookupMock }, lookup: lookupMock }));
vi.mock('@/shared/lib/prisma');

import prisma from '@/shared/lib/prisma';
import { assertSafeWebhookUrl, isPrivateAddress, processWebhook } from './webhook-sender';

const mockPrisma = prisma as any;

function resolvesTo(...addresses: string[]) {
    lookupMock.mockResolvedValue(addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })));
}

describe('isPrivateAddress', () => {
    it.each([
        '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
        '0.0.0.0', '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1',
        '::ffff:10.0.0.1', '::ffff:c0a8:101',
    ])('rejects %s', (ip) => {
        expect(isPrivateAddress(ip)).toBe(true);
    });

    it.each(['8.8.8.8', '172.32.0.1', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('allows %s', (ip) => {
        expect(isPrivateAddress(ip)).toBe(false);
    });
});

describe('assertSafeWebhookUrl', () => {
    beforeEach(() => { lookupMock.mockReset(); });

    it('rejects http://127.0.0.1:3000 (non-https, loopback)', async () => {
        resolvesTo('127.0.0.1');
        await expect(assertSafeWebhookUrl('http://127.0.0.1:3000/api/cron/cleanup')).rejects.toThrow();
    });

    it('rejects https to a loopback IP literal', async () => {
        resolvesTo('127.0.0.1');
        await expect(assertSafeWebhookUrl('https://127.0.0.1/hook')).rejects.toThrow();
    });

    it('rejects a hostname when any resolved address is private', async () => {
        resolvesTo('93.184.216.34', '10.0.0.5');
        await expect(assertSafeWebhookUrl('https://rebind.example/hook')).rejects.toThrow();
        expect(lookupMock).toHaveBeenCalledWith('rebind.example', { all: true, verbatim: true });
    });

    it('rejects IPv6 loopback literals', async () => {
        resolvesTo('::1');
        await expect(assertSafeWebhookUrl('https://[::1]/hook')).rejects.toThrow();
        expect(lookupMock).toHaveBeenCalledWith('::1', expect.anything());
    });

    it('rejects when DNS fails', async () => {
        lookupMock.mockImplementation(() => {
            throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
        });
        await expect(assertSafeWebhookUrl('https://nope.example/hook')).rejects.toThrow('does not resolve');
    });

    it('rejects unparseable URLs', async () => {
        await expect(assertSafeWebhookUrl('not a url')).rejects.toThrow();
    });

    it('accepts an https URL that resolves to public addresses', async () => {
        resolvesTo('93.184.216.34');
        await expect(assertSafeWebhookUrl('https://example.com/hook')).resolves.toBeUndefined();
    });
});

describe('processWebhook', () => {
    const fetchMock = vi.fn();
    const webhook = {
        id: 'wh-1', eventId: 7, url: 'https://example.com/hook', payload: '{"type":"CREATED"}',
        attempts: 0, createdAt: new Date(),
    };

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock);
        fetchMock.mockReset();
        lookupMock.mockReset();
        mockPrisma.webhookEvent.findUnique = vi.fn().mockResolvedValue(webhook);
        mockPrisma.webhookEvent.update = vi.fn().mockResolvedValue({});
        process.env.CRON_SECRET = 'cron-secret-for-tests';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete process.env.CRON_SECRET;
    });

    it('signs the raw body, refuses redirects, and marks the row delivered', async () => {
        resolvesTo('93.184.216.34');
        fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

        const result = await processWebhook('wh-1');

        expect(result.status).toBe('DELIVERED');
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(webhook.url);
        expect(init.redirect).toBe('manual');
        expect(init.body).toBe(webhook.payload);
        const expected = createHmac('sha256', 'cron-secret-for-tests').update(webhook.payload).digest('hex');
        expect(init.headers['X-Tabletop-Signature']).toBe(`sha256=${expected}`);
    });

    it('never sends to a URL that now resolves to a private address', async () => {
        resolvesTo('10.0.0.5');

        const result = await processWebhook('wh-1');

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'wh-1' },
            data: expect.objectContaining({ status: 'FAILED' }),
        }));
    });

    it('treats a redirect response as a failed attempt', async () => {
        resolvesTo('93.184.216.34');
        fetchMock.mockResolvedValue({ ok: false, status: 302, statusText: 'Found' });

        const result = await processWebhook('wh-1');

        expect(result.status).toBe('RETRY');
    });
});
