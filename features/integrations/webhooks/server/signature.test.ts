import { describe, it, expect, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';
import { signWebhookBody, webhookSigningKeyFor } from './signature';

afterEach(() => {
    vi.unstubAllEnvs();
    resetServerConfigForTests();
});

describe('signWebhookBody', () => {
    it('is sha256=<hex HMAC-SHA256 of the raw body>, keyed with the per-destination key', () => {
        stubConfigEnv({ SESSION_SECRET: 's3ssion' });
        resetServerConfigForTests();
        const body = '{"type":"CREATED"}';
        const key = createHmac('sha256', 's3ssion').update('webhook-signing\0https://hooks.example').digest('hex');
        const expected = createHmac('sha256', key).update(body).digest('hex');
        expect(webhookSigningKeyFor('https://hooks.example/a/b?c=1')).toBe(key);
        expect(signWebhookBody(body, 'https://hooks.example/a/b?c=1')).toBe(`sha256=${expected}`);
    });

    it('derives a different key for each destination origin, and the same key across paths of one origin', () => {
        stubConfigEnv({ SESSION_SECRET: 's3ssion' });
        resetServerConfigForTests();
        const a = webhookSigningKeyFor('https://a.example/hook');
        expect(webhookSigningKeyFor('https://a.example/other?x=1')).toBe(a);
        expect(webhookSigningKeyFor('https://b.example/hook')).not.toBe(a);
        expect(webhookSigningKeyFor('https://a.example:8443/hook')).not.toBe(a);
        expect(signWebhookBody('{}', 'https://a.example/hook')).not.toBe(signWebhookBody('{}', 'https://b.example/hook'));
    });

    it('does not depend on CRON_SECRET', () => {
        stubConfigEnv({ SESSION_SECRET: 's3ssion' });
        resetServerConfigForTests();
        const without = signWebhookBody('{}', 'https://hooks.example/');
        stubConfigEnv({ SESSION_SECRET: 's3ssion', CRON_SECRET: 'cron' });
        resetServerConfigForTests();
        expect(signWebhookBody('{}', 'https://hooks.example/')).toBe(without);
    });
});
