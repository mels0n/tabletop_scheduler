import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    signValue,
    verifyValue,
    readIdentity,
    identityCookieOptions,
    IDENTITY_COOKIES,
    IDENTITY_PURPOSES,
    participantCookieName,
    participantPurpose,
} from './session';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';

function useSecret(secret: string, extra: Record<string, string> = {}) {
    stubConfigEnv({ SESSION_SECRET: secret, ...extra });
    resetServerConfigForTests();
}

/** Minimal cookie store matching the `{ get(name) }` shape of next/headers cookies(). */
function store(values: Record<string, string>) {
    return { get: (name: string) => (name in values ? { name, value: values[name] } : undefined) };
}

beforeEach(() => useSecret('secret-one'));
afterEach(() => {
    vi.unstubAllEnvs();
    resetServerConfigForTests();
});

describe('signValue / verifyValue', () => {
    it('round-trips a value', () => {
        const signed = signValue('t', '123456789012345678');
        expect(signed.startsWith('123456789012345678.')).toBe(true);
        expect(verifyValue('t', signed)).toBe('123456789012345678');
    });

    it('round-trips a value that itself contains dots', () => {
        expect(verifyValue('t', signValue('t', 'a.b.c'))).toBe('a.b.c');
    });

    it('uses an unpadded base64url signature', () => {
        const sig = signValue('t', 'x').split('.').pop()!;
        expect(sig).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(sig).toHaveLength(43);
    });

    it('rejects a tampered value', () => {
        const [, sig] = signValue('t', '111').split('.');
        expect(verifyValue('t', `222.${sig}`)).toBeNull();
    });

    it('rejects a tampered signature', () => {
        const signed = signValue('t', '111');
        const flipped = signed.slice(0, -1) + (signed.endsWith('A') ? 'B' : 'A');
        expect(verifyValue('t', flipped)).toBeNull();
    });

    it('rejects an unsigned raw ID', () => {
        expect(verifyValue('t', '123456789012345678')).toBeNull();
    });

    it('rejects empty, null and undefined input', () => {
        expect(verifyValue('t', '')).toBeNull();
        expect(verifyValue('t', null)).toBeNull();
        expect(verifyValue('t', undefined)).toBeNull();
        expect(verifyValue('t', '.')).toBeNull();
        expect(verifyValue('t', 'abc.')).toBeNull();
    });

    it('rejects a value signed with a different secret', () => {
        const signed = signValue('t', '111');
        useSecret('secret-two');
        expect(verifyValue('t', signed)).toBeNull();
    });

    it('is domain separated: a value signed for one purpose verifies as null under another', () => {
        const signed = signValue('participant:abc', '42');
        expect(verifyValue('participant:abc', signed)).toBe('42');
        expect(verifyValue('participant:xyz', signed)).toBeNull();
        expect(verifyValue(IDENTITY_PURPOSES.telegram, signed)).toBeNull();
        expect(verifyValue(IDENTITY_PURPOSES.discord, signValue(IDENTITY_PURPOSES.telegram, '42'))).toBeNull();
    });

    it('refuses an empty purpose or one containing the separator', () => {
        expect(() => signValue('', '1')).toThrow();
        expect(() => signValue('a\0b', '1')).toThrow();
    });
});

describe('readIdentity', () => {
    it('returns both IDs when the cookies are signed', () => {
        const ids = readIdentity(store({
            [IDENTITY_COOKIES.telegram]: signValue(IDENTITY_PURPOSES.telegram, '42'),
            [IDENTITY_COOKIES.discord]: signValue(IDENTITY_PURPOSES.discord, '987654321098765432'),
        }));
        expect(ids).toEqual({ chatId: '42', discordId: '987654321098765432' });
    });

    it('ignores a forged unsigned discord cookie', () => {
        const ids = readIdentity(store({ tabletop_user_discord_id: '987654321098765432' }));
        expect(ids).toEqual({ chatId: null, discordId: null });
    });

    it('ignores a participant cookie copied into an identity cookie', () => {
        const participant = signValue(participantPurpose('abc'), '42');
        const ids = readIdentity(store({ [IDENTITY_COOKIES.telegram]: participant, [IDENTITY_COOKIES.discord]: participant }));
        expect(ids).toEqual({ chatId: null, discordId: null });
    });

    it('ignores a telegram identity cookie copied into the discord slot', () => {
        const ids = readIdentity(store({ [IDENTITY_COOKIES.discord]: signValue(IDENTITY_PURPOSES.telegram, '42') }));
        expect(ids).toEqual({ chatId: null, discordId: null });
    });

    it('returns nulls for an empty store', () => {
        expect(readIdentity(store({}))).toEqual({ chatId: null, discordId: null });
    });
});

describe('participant cookie helpers', () => {
    it('names the cookie and purpose per slug', () => {
        expect(participantCookieName('abc')).toBe('tabletop_participant_abc');
        expect(participantPurpose('abc')).toBe('participant:abc');
    });
});

describe('identityCookieOptions', () => {
    it('is httpOnly, lax, root path, 400 days', () => {
        expect(identityCookieOptions()).toEqual({
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 400,
        });
    });

    it('is secure in production', () => {
        useSecret('prod-secret', { NODE_ENV: 'production' });
        expect(identityCookieOptions().secure).toBe(true);
    });
});
