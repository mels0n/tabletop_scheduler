import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { cookieJar, cookieOptions } = vi.hoisted(() => ({
    cookieJar: new Map<string, string>(),
    cookieOptions: new Map<string, Record<string, unknown> | undefined>(),
}));
vi.mock('@/shared/lib/prisma');
vi.mock('next/headers', () => ({
    cookies: async () => ({
        set: (name: string, value: string, options?: Record<string, unknown>) => {
            cookieJar.set(name, value);
            cookieOptions.set(name, options);
        },
        get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    }),
}));

import prisma from '@/shared/lib/prisma';
import { hashToken } from '@/shared/lib/token';
import { IDENTITY_COOKIES, verifyValue, IDENTITY_PURPOSES } from '@/shared/lib/session';
import { GET } from './route';

const mockPrisma = prisma as any;
const future = () => new Date(Date.now() + 10 * 60_000);
const login = () => GET(new NextRequest('https://tabletop.example/auth/login?token=raw-token'));

describe('GET /auth/login', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        cookieJar.clear();
        cookieOptions.clear();
    });

    it('a Telegram-only token sets only the Telegram identity cookies', async () => {
        mockPrisma.loginToken.findUnique.mockResolvedValue({
            chatId: '555', telegramUsername: 'steve_tg', discordId: null, discordUsername: null, expiresAt: future(),
        });

        const res = await login();

        expect(res.headers.get('location')).toContain('/profile?success=logged_in');
        expect(verifyValue(IDENTITY_PURPOSES.telegram, cookieJar.get(IDENTITY_COOKIES.telegram))).toBe('555');
        expect(cookieJar.get('tabletop_user_telegram_name')).toBe('steve_tg');
        expect(cookieJar.has(IDENTITY_COOKIES.discord)).toBe(false);
        expect(cookieJar.has('tabletop_user_discord_name')).toBe(false);
    });

    it('a Discord-only token sets only the Discord identity cookies', async () => {
        mockPrisma.loginToken.findUnique.mockResolvedValue({
            chatId: null, telegramUsername: null, discordId: '123456789012345678', discordUsername: 'GmSteve', expiresAt: future(),
        });

        await login();

        expect(verifyValue(IDENTITY_PURPOSES.discord, cookieJar.get(IDENTITY_COOKIES.discord))).toBe('123456789012345678');
        expect(cookieJar.get('tabletop_user_discord_name')).toBe('GmSteve');
        expect(cookieJar.has(IDENTITY_COOKIES.telegram)).toBe(false);
        expect(cookieJar.has('tabletop_user_telegram_name')).toBe(false);
    });

    it('an expired token sets no cookie', async () => {
        mockPrisma.loginToken.findUnique.mockResolvedValue({
            chatId: '555', telegramUsername: null, discordId: null, discordUsername: null, expiresAt: new Date(Date.now() - 1000),
        });

        const res = await login();

        expect(res.headers.get('location')).toContain('error=expired_token');
        expect(cookieJar.size).toBe(0);
    });

    // Catches: looking the token up by its raw value (tokens are stored hashed, so every login
    // would fail) or comparing plaintext.
    it('looks the token up by its hash, never the raw value', async () => {
        mockPrisma.loginToken.findUnique.mockResolvedValue(null);

        await login();

        expect(mockPrisma.loginToken.findUnique).toHaveBeenCalledTimes(1);
        expect(mockPrisma.loginToken.findUnique).toHaveBeenCalledWith({ where: { token: hashToken('raw-token') } });
        expect(mockPrisma.loginToken.findUnique.mock.calls[0][0].where.token).not.toBe('raw-token');
    });

    // Catches: dropping httpOnly (script-readable session), weakening sameSite, or losing maxAge
    // (the identity would become a session cookie and vanish on browser restart).
    it('sets the identity cookie httpOnly, sameSite lax, with a maxAge', async () => {
        mockPrisma.loginToken.findUnique.mockResolvedValue({
            chatId: '555', telegramUsername: null, discordId: '123456789012345678', discordUsername: null, expiresAt: future(),
        });

        await login();

        for (const name of [IDENTITY_COOKIES.telegram, IDENTITY_COOKIES.discord]) {
            const options = cookieOptions.get(name);
            expect(options, name).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
            expect(options!.maxAge as number, name).toBeGreaterThan(0);
        }
    });

    // Catches: treating an unknown hash as valid, or setting cookies before validating.
    it('redirects an unknown token to invalid_token and sets no cookies', async () => {
        mockPrisma.loginToken.findUnique.mockResolvedValue(null);

        const res = await login();

        expect(res.headers.get('location')).toContain('/profile?error=invalid_token');
        expect(cookieJar.size).toBe(0);
        expect(cookieOptions.size).toBe(0);
    });

    // Catches: querying with an undefined token instead of short-circuiting.
    it('redirects a request without a token to missing_token without a lookup or cookies', async () => {
        const res = await GET(new NextRequest('https://tabletop.example/auth/login'));

        expect(res.headers.get('location')).toContain('/profile?error=missing_token');
        expect(mockPrisma.loginToken.findUnique).not.toHaveBeenCalled();
        expect(cookieJar.size).toBe(0);
    });
});
