import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { setAdminCookie } from './actions';
import { cookies } from 'next/headers';

// verifyEventAdmin is covered by verify.test.ts.
describe('setAdminCookie', () => {
    const mockCookieStore = {
        set: vi.fn(),
        get: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        (cookies as any).mockReturnValue(mockCookieStore);
    });

    it('sets a secure http-only cookie scoped to the event', async () => {
        await setAdminCookie('my-slug', 'my-token');

        expect(mockCookieStore.set).toHaveBeenCalledWith(
            'tabletop_admin_my-slug',
            'my-token',
            expect.objectContaining({
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: expect.any(Number),
            })
        );
    });

    it.each([
        ['a slug with cookie syntax', 'abc; Path=/', 'tok'],
        ['an empty slug', '', 'tok'],
        ['a token with cookie syntax', 'abc', 'tok; Domain=evil'],
        ['a non-string token', 'abc', 42 as unknown as string],
    ])('refuses %s and sets nothing', async (_label, slug, token) => {
        await expect(setAdminCookie(slug, token)).rejects.toThrow();
        expect(mockCookieStore.set).not.toHaveBeenCalled();
    });
});

describe('admin verification is never a server action', () => {
    it('no "use server" module in the auth slice exports verifyEventAdmin, requireEventAdmin or isAdminToken', () => {
        const offenders = readdirSync(__dirname)
            .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
            .filter((f) => {
                const src = readFileSync(path.join(__dirname, f), 'utf8');
                const exported =
                    /export\s+(async\s+)?(function|const|let)\s+(verifyEventAdmin|requireEventAdmin|isAdminToken)\b/.test(src)
                    || /export\s*\{[^}]*\b(verifyEventAdmin|requireEventAdmin|isAdminToken)\b/.test(src);
                return /^\s*["']use server["']/.test(src) && exported;
            });
        expect(offenders).toEqual([]);
    });
});
