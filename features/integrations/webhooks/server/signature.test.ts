import { describe, it, expect, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';
import { signWebhookBody } from './signature';

afterEach(() => {
    vi.unstubAllEnvs();
    resetServerConfigForTests();
});

describe('signWebhookBody', () => {
    it('is sha256=<hex HMAC-SHA256 of the raw body>, keyed with the key derived from SESSION_SECRET', () => {
        stubConfigEnv({ SESSION_SECRET: 's3ssion' });
        resetServerConfigForTests();
        const body = '{"type":"CREATED"}';
        const key = createHmac('sha256', 's3ssion').update('webhook-signing').digest('hex');
        const expected = createHmac('sha256', key).update(body).digest('hex');
        expect(signWebhookBody(body)).toBe(`sha256=${expected}`);
    });

    it('does not depend on CRON_SECRET', () => {
        stubConfigEnv({ SESSION_SECRET: 's3ssion' });
        resetServerConfigForTests();
        const without = signWebhookBody('{}');
        stubConfigEnv({ SESSION_SECRET: 's3ssion', CRON_SECRET: 'cron' });
        resetServerConfigForTests();
        expect(signWebhookBody('{}')).toBe(without);
    });
});
