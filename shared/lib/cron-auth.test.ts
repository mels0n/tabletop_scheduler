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

    it('allows loopback hosts on a self-host box with no secret', () => {
        useEnv({});
        expect(() => requireCronAuth(req('http://127.0.0.1:3000/api/cron/cleanup', { host: '127.0.0.1:3000' }))).not.toThrow();
        expect(() => requireCronAuth(req('http://localhost:3000/api/cron/cleanup', { host: 'localhost:3000' }))).not.toThrow();
    });

    it('rejects non-loopback hosts on a self-host box with no secret', () => {
        useEnv({});
        expect401(() => requireCronAuth(req('http://example.com/api/cron/cleanup', { host: 'example.com' })));
        expect401(() => requireCronAuth(req('http://localhost.evil.com:3000/x', { host: 'localhost.evil.com:3000' })));
        expect401(() => requireCronAuth(req('http://127.0.0.1.evil.com/x', { host: '127.0.0.1.evil.com' })));
    });
});

describe('requireCronAuth: hosted without a secret (defensive branch)', () => {
    it('rejects loopback when the config says hosted and the secret is null', async () => {
        vi.resetModules();
        vi.doMock('@/shared/config/server', () => ({
            getServerConfig: () => ({ isHosted: true, cronSecret: null }),
        }));
        const mod = await import('./cron-auth');
        const errors = await import('@/shared/errors');
        try {
            mod.requireCronAuth(req('http://localhost:3000/x', { host: 'localhost:3000' }));
            throw new Error('expected throw');
        } catch (e) {
            expect(e).toBeInstanceOf(errors.UnauthorizedError);
        }
        vi.doUnmock('@/shared/config/server');
        vi.resetModules();
    });
});
