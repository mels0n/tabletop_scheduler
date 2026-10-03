import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));
vi.mock('@/shared/lib/prisma');
vi.mock('next/headers', () => ({
    cookies: async () => ({
        set: (name: string, value: string) => { cookieJar.set(name, value); },
        get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    }),
}));

import prisma from '@/shared/lib/prisma';
import { IDENTITY_COOKIES, verifyValue, IDENTITY_PURPOSES } from '@/shared/lib/session';
import { GET } from './route';

const mockPrisma = prisma as any;
const future = () => new Date(Date.now() + 10 * 60_000);
const login = () => GET(new NextRequest('https://tabletop.example/auth/login?token=raw-token'));

describe('GET /auth/login', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        cookieJar.clear();
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
});
