import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { createHmac } from 'node:crypto';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';

const { lookupMock, requestMock } = vi.hoisted(() => ({ lookupMock: vi.fn(), requestMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({ default: { lookup: lookupMock }, lookup: lookupMock }));
vi.mock('node:https', () => ({ default: { request: requestMock }, request: requestMock }));

import { deliverWebhook, WebhookRefusedError } from './deliver';

const row = { id: 'wh-1', eventId: 7, url: 'https://example.com/hook', payload: '{"type":"CREATED"}' };

function resolvesTo(...addresses: string[]) {
    lookupMock.mockResolvedValue(addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })));
}

/** Fake `https.request`: records the call and answers with `status` once the body is sent. */
function respondWith(status: number) {
    requestMock.mockImplementation((_url: URL, _opts: unknown, onResponse: (res: unknown) => void) => {
        const req = Object.assign(new EventEmitter(), {
            end: vi.fn(() => queueMicrotask(() => onResponse({ statusCode: status, resume: vi.fn() }))),
        });
        return req;
    });
}

function failWith(error: Error) {
    requestMock.mockImplementation(() => {
        const req = Object.assign(new EventEmitter(), {
            end: vi.fn(() => queueMicrotask(() => req.emit('error', error))),
        });
        return req;
    });
}

type Lookup = (host: string, opts: { all?: boolean; family?: number }, cb: (...args: unknown[]) => void) => void;

function pinnedLookup(): Lookup {
    return requestMock.mock.calls[0][1].lookup;
}

function callLookup(lookup: Lookup, opts: { all?: boolean; family?: number }) {
    let result: unknown[] = [];
    lookup('example.com', opts, (...args) => { result = args; });
    return result;
}

describe('deliverWebhook', () => {
    beforeEach(() => {
        requestMock.mockReset();
        lookupMock.mockReset();
        stubConfigEnv({ SESSION_SECRET: 'session-secret-for-tests', CRON_SECRET: 'cron-secret-for-tests' });
        resetServerConfigForTests();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        resetServerConfigForTests();
    });

    it('POSTs the signed raw body to the URL with a timeout and no pooled socket', async () => {
        resolvesTo('93.184.216.34');
        respondWith(200);

        await expect(deliverWebhook(row)).resolves.toBeUndefined();

        const [url, opts] = requestMock.mock.calls[0];
        expect(String(url)).toBe(row.url);
        expect(opts.method).toBe('POST');
        expect(opts.signal).toBeInstanceOf(AbortSignal);
        expect(opts.agent).toBe(false);
        expect(opts.headers['X-Webhook-Id']).toBe('wh-1');
        expect(opts.headers['Content-Length']).toBe(String(Buffer.byteLength(row.payload)));
        const req = requestMock.mock.results[0].value;
        expect(req.end).toHaveBeenCalledWith(row.payload);
        const key = createHmac('sha256', 'session-secret-for-tests').update('webhook-signing').digest('hex');
        const expected = createHmac('sha256', key).update(row.payload).digest('hex');
        expect(opts.headers['X-Tabletop-Signature']).toBe(`sha256=${expected}`);
    });

    it('always signs, even when CRON_SECRET is not set', async () => {
        stubConfigEnv({ SESSION_SECRET: 'session-secret-for-tests' });
        resetServerConfigForTests();
        resolvesTo('93.184.216.34');
        respondWith(200);

        await deliverWebhook(row);

        expect(requestMock.mock.calls[0][1].headers['X-Tabletop-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
    });

    it('connects only to the address it vetted, without resolving the host again', async () => {
        resolvesTo('93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946');
        respondWith(200);

        await deliverWebhook(row);

        // The host now rebinds to loopback: the socket must still go to the vetted addresses.
        resolvesTo('127.0.0.1');
        const lookup = pinnedLookup();
        expect(callLookup(lookup, { all: true })).toEqual([null, [
            { address: '93.184.216.34', family: 4 },
            { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
        ]]);
        expect(callLookup(lookup, {})).toEqual([null, '93.184.216.34', 4]);
        expect(callLookup(lookup, { family: 6 })).toEqual([null, '2606:2800:220:1:248:1893:25c8:1946', 6]);
        expect(lookupMock).toHaveBeenCalledTimes(1);
    });

    it('refuses a hostname that resolves to 127.0.0.1 and never connects', async () => {
        resolvesTo('127.0.0.1');

        await expect(deliverWebhook(row)).rejects.toBeInstanceOf(WebhookRefusedError);
        expect(requestMock).not.toHaveBeenCalled();
    });

    it('refuses when any resolved address is private', async () => {
        resolvesTo('93.184.216.34', '10.0.0.5');

        await expect(deliverWebhook(row)).rejects.toBeInstanceOf(WebhookRefusedError);
        expect(requestMock).not.toHaveBeenCalled();
    });

    it('refuses a non-https destination without resolving it', async () => {
        await expect(deliverWebhook({ ...row, url: 'http://example.com/hook' })).rejects.toBeInstanceOf(WebhookRefusedError);
        expect(lookupMock).not.toHaveBeenCalled();
        expect(requestMock).not.toHaveBeenCalled();
    });

    it('treats a redirect response as a failed attempt and does not follow it', async () => {
        resolvesTo('93.184.216.34');
        respondWith(302);

        await expect(deliverWebhook(row)).rejects.toThrow('HTTP 302');
        expect(requestMock).toHaveBeenCalledTimes(1);
    });

    it('rejects on a network error', async () => {
        resolvesTo('93.184.216.34');
        failWith(new Error('ECONNRESET'));

        await expect(deliverWebhook(row)).rejects.toThrow('ECONNRESET');
    });
});
