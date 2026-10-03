import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { signWebhookBody } from './signature';

describe('signWebhookBody', () => {
    it('is sha256=<hex HMAC-SHA256 of the raw body>', () => {
        const body = '{"type":"CREATED"}';
        const expected = createHmac('sha256', 's3cret').update(body).digest('hex');
        expect(signWebhookBody(body, 's3cret')).toBe(`sha256=${expected}`);
    });
});
