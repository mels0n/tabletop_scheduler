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

    it('is the first 8 hex chars of HMAC-SHA256(sessionSecret, connect:<slug>:<hash>:<chatId>:<nonce>)', () => {
        const expected = createHmac('sha256', 'connect-code-test-secret')
            .update(`connect:abc123:${HASH}::`)
            .digest('hex')
            .slice(0, 8);
        expect(connectCodeFor('abc123', HASH, null, null)).toBe(expected);
        expect(connectCodeFor('abc123', HASH, null, null)).toMatch(/^[0-9a-f]{8}$/);
    });

    it('round trips', () => {
        const code = connectCodeFor('abc123', HASH, null, null);
        expect(verifyConnectCode('abc123', HASH, null, null, code)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, null, null, code.toUpperCase())).toBe(true);
    });

    it('rejects a code for another slug, another admin token, or a different secret', () => {
        const code = connectCodeFor('abc123', HASH, null, null);
        expect(verifyConnectCode('other', HASH, null, null, code)).toBe(false);
        expect(verifyConnectCode('abc123', 'b'.repeat(64), null, null, code)).toBe(false);

        process.env.SESSION_SECRET = 'another-secret';
        resetServerConfigForTests();
        expect(verifyConnectCode('abc123', HASH, null, null, code)).toBe(false);
    });

    it('binds the code to the current chat binding, so a used code dies once the chat is set', () => {
        const unbound = connectCodeFor('abc123', HASH, null, null);
        expect(verifyConnectCode('abc123', HASH, '', null, unbound)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, '-1001', null, unbound)).toBe(false);

        const rebind = connectCodeFor('abc123', HASH, '-1001', null);
        expect(rebind).not.toBe(unbound);
        expect(verifyConnectCode('abc123', HASH, '-1001', null, rebind)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, '-2002', null, rebind)).toBe(false);
        expect(createHmac('sha256', 'connect-code-test-secret')
            .update(`connect:abc123:${HASH}:-1001:`).digest('hex').slice(0, 8)).toBe(rebind);
    });

    it('binds the code to the connect nonce, so rotating the nonce kills a code for the same chat', () => {
        const before = connectCodeFor('abc123', HASH, '-1001', 'n1');
        expect(verifyConnectCode('abc123', HASH, '-1001', 'n1', before)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, '-1001', 'n2', before)).toBe(false);
        expect(verifyConnectCode('abc123', HASH, '-1001', null, before)).toBe(false);
        expect(createHmac('sha256', 'connect-code-test-secret')
            .update(`connect:abc123:${HASH}:-1001:n1`).digest('hex').slice(0, 8)).toBe(before);
    });

    it('rejects malformed input without throwing', () => {
        expect(verifyConnectCode('abc123', HASH, null, null, '')).toBe(false);
        expect(verifyConnectCode('abc123', HASH, null, null, 'short')).toBe(false);
        expect(verifyConnectCode('abc123', HASH, null, null, 'zzzzzzzz')).toBe(false);
        expect(verifyConnectCode('abc123', HASH, null, null, connectCodeFor('abc123', HASH, null, null) + '0')).toBe(false);
        expect(verifyConnectCode('abc123', null, null, null, connectCodeFor('abc123', HASH, null, null))).toBe(false);
        expect(verifyConnectCode('abc123', HASH, null, null, undefined)).toBe(false);
    });

    it('parses /connect <slug> <code>, tolerating @botname and extra spaces', () => {
        expect(parseConnectCommand('/connect abc123 deadbeef')).toEqual({ slug: 'abc123', code: 'deadbeef' });
        expect(parseConnectCommand('/connect@TabletopBot   abc123  deadbeef ')).toEqual({ slug: 'abc123', code: 'deadbeef' });
        expect(parseConnectCommand('/connect abc123')).toEqual({ slug: 'abc123', code: null });
        expect(parseConnectCommand('/connect')).toEqual({ slug: null, code: null });
    });
});
