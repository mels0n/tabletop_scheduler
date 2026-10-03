import { describe, it, expect, vi, beforeEach } from 'vitest';

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({ default: { lookup: lookupMock }, lookup: lookupMock }));

import { assertSafeWebhookUrl, isPrivateAddress, resolveSafeWebhookTarget, DNS_LOOKUP_TIMEOUT_MS } from './webhook-sender';

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

describe('resolveSafeWebhookTarget', () => {
    beforeEach(() => { lookupMock.mockReset(); });

    it('resolves once and returns every vetted address with its family', async () => {
        resolvesTo('93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946');
        const target = await resolveSafeWebhookTarget('https://example.com/hook');
        expect(target.url.hostname).toBe('example.com');
        expect(target.addresses).toEqual([
            { address: '93.184.216.34', family: 4 },
            { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
        ]);
        expect(lookupMock).toHaveBeenCalledTimes(1);
        expect(lookupMock).toHaveBeenCalledWith('example.com', { all: true, verbatim: true });
    });

    it('refuses a hostname that resolves to loopback', async () => {
        resolvesTo('127.0.0.1');
        await expect(resolveSafeWebhookTarget('https://rebind.example/hook')).rejects.toThrow('public address');
    });
});

describe('DNS lookup timeout', () => {
    beforeEach(() => {
        lookupMock.mockReset();
    });

    it('treats a lookup that does not settle within 5 s as unresolvable', async () => {
        vi.useFakeTimers();
        try {
            lookupMock.mockReturnValue(new Promise(() => {}));
            const pending = resolveSafeWebhookTarget('https://slow.example/hook');
            const assertion = expect(pending).rejects.toThrow('does not resolve');
            expect(DNS_LOOKUP_TIMEOUT_MS).toBe(5_000);
            await vi.advanceTimersByTimeAsync(DNS_LOOKUP_TIMEOUT_MS);
            await assertion;
        } finally {
            vi.useRealTimers();
        }
    });
});
