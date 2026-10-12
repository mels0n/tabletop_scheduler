import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { connectCodeFor, verifyConnectCode, parseConnectCommand, newConnectNonce } from './connect-code';
import { resetServerConfigForTests } from '@/shared/config/server';
import { toBase62 } from '@/shared/lib/token';

/** The expected code: the first 128 bits of the HMAC as base62. */
const hmacCode = (input: string) => toBase62(createHmac('sha256', 'connect-code-test-secret').update(input).digest().subarray(0, 16));
/** The pre-128-bit code: the first 8 hex chars of the same HMAC. */
const legacyCode = (input: string) => createHmac('sha256', 'connect-code-test-secret').update(input).digest('hex').slice(0, 8);

const HASH = 'a'.repeat(64);

describe('telegram connect code', () => {
    beforeEach(() => {
        process.env.SESSION_SECRET = 'connect-code-test-secret';
        resetServerConfigForTests();
    });

    it('is the first 128 bits of HMAC-SHA256(sessionSecret, connect:<slug>:<hash>:<chatId>:<nonce>) in base62', () => {
        expect(connectCodeFor('abc123', HASH, null, null)).toBe(hmacCode(`connect:abc123:${HASH}::`));
        expect(connectCodeFor('abc123', HASH, null, null)).toMatch(/^[0-9A-Za-z]{22}$/);
    });

    it('round trips', () => {
        const code = connectCodeFor('abc123', HASH, null, null);
        expect(verifyConnectCode('abc123', HASH, null, null, code)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, null, null, ` ${code} `)).toBe(true);
        const swapped = code.replace(/[a-zA-Z]/g, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()));
        if (swapped !== code) expect(verifyConnectCode('abc123', HASH, null, null, swapped)).toBe(false);
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
        expect(hmacCode(`connect:abc123:${HASH}:-1001:`)).toBe(rebind);
    });

    it('binds the code to the connect nonce, so rotating the nonce kills a code for the same chat', () => {
        const before = connectCodeFor('abc123', HASH, '-1001', 'n1');
        expect(verifyConnectCode('abc123', HASH, '-1001', 'n1', before)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, '-1001', 'n2', before)).toBe(false);
        expect(verifyConnectCode('abc123', HASH, '-1001', null, before)).toBe(false);
        expect(hmacCode(`connect:abc123:${HASH}:-1001:n1`)).toBe(before);
    });

    it('still accepts a pre-128-bit 8-char code while the nonce predates v2', () => {
        const full = connectCodeFor('abc123', HASH, '-1001', 'legacynonce');
        const short = legacyCode(`connect:abc123:${HASH}:-1001:legacynonce`);
        expect(verifyConnectCode('abc123', HASH, '-1001', 'legacynonce', short)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, '-1001', 'legacynonce', short.toUpperCase())).toBe(true);
        expect(verifyConnectCode('abc123', HASH, '-1001', null, legacyCode(`connect:abc123:${HASH}:-1001:`))).toBe(true);
        expect(verifyConnectCode('abc123', HASH, '-1001', 'legacynonce', full)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, '-1001', 'other', short)).toBe(false);
    });

    it('accepts only the full code once the event has a v2 nonce', () => {
        const nonce = newConnectNonce();
        expect(nonce).toMatch(/^v2_[0-9a-f]{32}$/);
        const full = connectCodeFor('abc123', HASH, '-1001', nonce);
        expect(verifyConnectCode('abc123', HASH, '-1001', nonce, full)).toBe(true);
        expect(verifyConnectCode('abc123', HASH, '-1001', nonce, legacyCode(`connect:abc123:${HASH}:-1001:${nonce}`))).toBe(false);
        expect(verifyConnectCode('abc123', HASH, '-1001', nonce, full.slice(0, 21))).toBe(false);
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
