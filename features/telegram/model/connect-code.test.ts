import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { connectCodeFor, verifyConnectCode, parseConnectCommand } from './connect-code';
import { resetServerConfigForTests } from '@/shared/config/server';

const HASH = 'a'.repeat(64);

describe('telegram connect code', () => {
    beforeEach(() => {
        process.env.SESSION_SECRET = 'connect-code-test-secret';
        resetServerConfigForTests();
    });

    it('is the first 8 hex chars of HMAC-SHA256(sessionSecret, connect:<slug>:<hash>)', () => {
        const expected = createHmac('sha256', 'connect-code-test-secret')
            .update(`connect:abc123:${HASH}`)
            .digest('hex')
            .slice(0, 8);
        expect(connectCodeFor('abc123', HASH)).toBe(expected);
        expect(connectCodeFor('abc123', HASH)).toMatch(/^[0-9a-f]{8}$/);
    });

    it('round trips', () => {
        const code = connectCodeFor('abc123', HASH);
        expect(verifyConnectCode('abc123', HASH, code)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, code.toUpperCase())).toBe(true);
    });

    it('rejects a code for another slug, another admin token, or a different secret', () => {
        const code = connectCodeFor('abc123', HASH);
        expect(verifyConnectCode('other', HASH, code)).toBe(false);
        expect(verifyConnectCode('abc123', 'b'.repeat(64), code)).toBe(false);

        process.env.SESSION_SECRET = 'another-secret';
        resetServerConfigForTests();
        expect(verifyConnectCode('abc123', HASH, code)).toBe(false);
    });

    it('rejects malformed input without throwing', () => {
        expect(verifyConnectCode('abc123', HASH, '')).toBe(false);
        expect(verifyConnectCode('abc123', HASH, 'short')).toBe(false);
        expect(verifyConnectCode('abc123', HASH, 'zzzzzzzz')).toBe(false);
        expect(verifyConnectCode('abc123', HASH, connectCodeFor('abc123', HASH) + '0')).toBe(false);
        expect(verifyConnectCode('abc123', null, connectCodeFor('abc123', HASH))).toBe(false);
        expect(verifyConnectCode('abc123', HASH, undefined)).toBe(false);
    });

    it('parses /connect <slug> <code>, tolerating @botname and extra spaces', () => {
        expect(parseConnectCommand('/connect abc123 deadbeef')).toEqual({ slug: 'abc123', code: 'deadbeef' });
        expect(parseConnectCommand('/connect@TabletopBot   abc123  deadbeef ')).toEqual({ slug: 'abc123', code: 'deadbeef' });
        expect(parseConnectCommand('/connect abc123')).toEqual({ slug: 'abc123', code: null });
        expect(parseConnectCommand('/connect')).toEqual({ slug: null, code: null });
    });
});
