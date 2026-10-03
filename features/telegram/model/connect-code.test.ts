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

    it('is the first 8 hex chars of HMAC-SHA256(sessionSecret, connect:<slug>:<hash>:<chatId>)', () => {
        const expected = createHmac('sha256', 'connect-code-test-secret')
            .update(`connect:abc123:${HASH}:`)
            .digest('hex')
            .slice(0, 8);
        expect(connectCodeFor('abc123', HASH, null)).toBe(expected);
        expect(connectCodeFor('abc123', HASH, null)).toMatch(/^[0-9a-f]{8}$/);
    });

    it('round trips', () => {
        const code = connectCodeFor('abc123', HASH, null);
        expect(verifyConnectCode('abc123', HASH, null, code)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, null, code.toUpperCase())).toBe(true);
    });

    it('rejects a code for another slug, another admin token, or a different secret', () => {
        const code = connectCodeFor('abc123', HASH, null);
        expect(verifyConnectCode('other', HASH, null, code)).toBe(false);
        expect(verifyConnectCode('abc123', 'b'.repeat(64), null, code)).toBe(false);

        process.env.SESSION_SECRET = 'another-secret';
        resetServerConfigForTests();
        expect(verifyConnectCode('abc123', HASH, null, code)).toBe(false);
    });

    it('binds the code to the current chat binding, so a used code dies once the chat is set', () => {
        const unbound = connectCodeFor('abc123', HASH, null);
        expect(verifyConnectCode('abc123', HASH, '', unbound)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, '-1001', unbound)).toBe(false);

        const rebind = connectCodeFor('abc123', HASH, '-1001');
        expect(rebind).not.toBe(unbound);
        expect(verifyConnectCode('abc123', HASH, '-1001', rebind)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, '-2002', rebind)).toBe(false);
        expect(createHmac('sha256', 'connect-code-test-secret')
            .update(`connect:abc123:${HASH}:-1001`).digest('hex').slice(0, 8)).toBe(rebind);
    });

    it('rejects malformed input without throwing', () => {
        expect(verifyConnectCode('abc123', HASH, null, '')).toBe(false);
        expect(verifyConnectCode('abc123', HASH, null, 'short')).toBe(false);
        expect(verifyConnectCode('abc123', HASH, null, 'zzzzzzzz')).toBe(false);
        expect(verifyConnectCode('abc123', HASH, null, connectCodeFor('abc123', HASH, null) + '0')).toBe(false);
        expect(verifyConnectCode('abc123', null, null, connectCodeFor('abc123', HASH, null))).toBe(false);
        expect(verifyConnectCode('abc123', HASH, null, undefined)).toBe(false);
    });

    it('parses /connect <slug> <code>, tolerating @botname and extra spaces', () => {
        expect(parseConnectCommand('/connect abc123 deadbeef')).toEqual({ slug: 'abc123', code: 'deadbeef' });
        expect(parseConnectCommand('/connect@TabletopBot   abc123  deadbeef ')).toEqual({ slug: 'abc123', code: 'deadbeef' });
        expect(parseConnectCommand('/connect abc123')).toEqual({ slug: 'abc123', code: null });
        expect(parseConnectCommand('/connect')).toEqual({ slug: null, code: null });
    });
});
