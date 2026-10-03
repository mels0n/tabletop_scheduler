import { describe, it, expect, afterEach, vi } from 'vitest';
import { requireCronAuth } from './cron-auth';
import { UnauthorizedError } from '@/shared/errors';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';

function useEnv(overrides: Record<string, string>) {
    stubConfigEnv(overrides);
    resetServerConfigForTests();
}

function req(url: string, headers: Record<string, string> = {}) {
    return new Request(url, { headers });
}

function expect401(fn: () => void) {
    try {
        fn();
    } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedError);
        expect((e as UnauthorizedError).status).toBe(401);
        return;
    }
    throw new Error('expected requireCronAuth to throw');
}

afterEach(() => {
    vi.unstubAllEnvs();
    resetServerConfigForTests();
});

const HOSTED = { NEXT_PUBLIC_IS_HOSTED: 'true', NEXT_PUBLIC_BASE_URL: 'https://tabletoptime.us', CRON_SECRET: 's3cret' };

describe('requireCronAuth', () => {
    it('accepts the right bearer token', () => {
        useEnv(HOSTED);
        expect(() => requireCronAuth(req('https://tabletoptime.us/api/cron/reminders', { authorization: 'Bearer s3cret' }))).not.toThrow();
    });

    it('accepts the right bearer token on a self-host box', () => {
        useEnv({ CRON_SECRET: 's3cret' });
        expect(() => requireCronAuth(req('http://127.0.0.1:3000/api/cron/webhooks', { authorization: 'Bearer s3cret' }))).not.toThrow();
    });

    it('rejects a wrong bearer token', () => {
        useEnv(HOSTED);
        expect401(() => requireCronAuth(req('https://tabletoptime.us/api/cron/reminders', { authorization: 'Bearer nope' })));
    });

    it('rejects a token of a different length and a non-bearer scheme', () => {
        useEnv(HOSTED);
        expect401(() => requireCronAuth(req('https://tabletoptime.us/x', { authorization: 'Bearer s3cret-longer' })));
        expect401(() => requireCronAuth(req('https://tabletoptime.us/x', { authorization: 's3cret' })));
    });

    it('rejects a missing header when a secret is configured, even from loopback', () => {
        useEnv({ CRON_SECRET: 's3cret' });
        expect401(() => requireCronAuth(req('http://127.0.0.1:3000/api/cron/cleanup', { host: '127.0.0.1:3000' })));
    });

    it('fails closed when hosted and no secret is configured', () => {
        useEnv({ NEXT_PUBLIC_IS_HOSTED: 'true', NEXT_PUBLIC_BASE_URL: 'https://tabletoptime.us' });
        // Invalid config (hosted without CRON_SECRET) must never let the request through.
        expect(() => requireCronAuth(req('http://localhost:3000/api/cron/cleanup', { host: 'localhost:3000' }))).toThrow();
    });

    it('fails closed on a self-host box with no secret, whatever the Host header says', () => {
        useEnv({});
        expect401(() => requireCronAuth(req('http://127.0.0.1:3000/api/cron/cleanup', { host: '127.0.0.1:3000' })));
        expect401(() => requireCronAuth(req('http://localhost:3000/api/cron/cleanup', { host: 'localhost:3000' })));
        expect401(() => requireCronAuth(req('http://example.com/api/cron/cleanup', { host: 'example.com', authorization: 'Bearer anything' })));
    });

    it('warns once that CRON_SECRET is unset', async () => {
        useEnv({});
        vi.resetModules();
        const fresh = await import('./cron-auth');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            expect(() => fresh.requireCronAuth(req('http://127.0.0.1:3000/x'))).toThrow();
            expect(() => fresh.requireCronAuth(req('http://127.0.0.1:3000/x'))).toThrow();
            const hits = warn.mock.calls.filter((c) => String(c[0]).includes('CRON_SECRET'));
            expect(hits).toHaveLength(1);
        } finally {
            warn.mockRestore();
            vi.resetModules();
        }
    });
});
