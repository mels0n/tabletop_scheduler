import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signValue, verifyValue, readIdentity, identityCookieOptions, IDENTITY_COOKIES } from './session';
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
        const signed = signValue('123456789012345678');
        expect(signed.startsWith('123456789012345678.')).toBe(true);
        expect(verifyValue(signed)).toBe('123456789012345678');
    });

    it('round-trips a value that itself contains dots', () => {
        expect(verifyValue(signValue('a.b.c'))).toBe('a.b.c');
    });

    it('uses an unpadded base64url signature', () => {
        const sig = signValue('x').split('.').pop()!;
        expect(sig).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(sig).toHaveLength(43);
    });

    it('rejects a tampered value', () => {
        const [, sig] = signValue('111').split('.');
        expect(verifyValue(`222.${sig}`)).toBeNull();
    });

    it('rejects a tampered signature', () => {
        const signed = signValue('111');
        const flipped = signed.slice(0, -1) + (signed.endsWith('A') ? 'B' : 'A');
        expect(verifyValue(flipped)).toBeNull();
    });

    it('rejects an unsigned raw ID', () => {
        expect(verifyValue('123456789012345678')).toBeNull();
    });

    it('rejects empty, null and undefined input', () => {
        expect(verifyValue('')).toBeNull();
        expect(verifyValue(null)).toBeNull();
        expect(verifyValue(undefined)).toBeNull();
        expect(verifyValue('.')).toBeNull();
        expect(verifyValue('abc.')).toBeNull();
    });

    it('rejects a value signed with a different secret', () => {
        const signed = signValue('111');
        useSecret('secret-two');
        expect(verifyValue(signed)).toBeNull();
    });
});

describe('readIdentity', () => {
    it('returns both IDs when the cookies are signed', () => {
        const ids = readIdentity(store({
            [IDENTITY_COOKIES.telegram]: signValue('42'),
            [IDENTITY_COOKIES.discord]: signValue('987654321098765432'),
        }));
        expect(ids).toEqual({ chatId: '42', discordId: '987654321098765432' });
    });

    it('ignores a forged unsigned discord cookie', () => {
        const ids = readIdentity(store({ tabletop_user_discord_id: '987654321098765432' }));
        expect(ids).toEqual({ chatId: null, discordId: null });
    });

    it('returns nulls for an empty store', () => {
        expect(readIdentity(store({}))).toEqual({ chatId: null, discordId: null });
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
