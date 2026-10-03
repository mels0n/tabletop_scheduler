import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import prisma from '@/shared/lib/prisma';
import { cookies } from 'next/headers';
import { verifyEventAdmin } from '@/features/auth/server/verify';
import { verifyValue } from '@/shared/lib/session';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/verify', () => ({ verifyEventAdmin: vi.fn() }));

const mockPrisma = prisma as unknown as {
    event: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};
const mockAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;
const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>;

const NONCE = 'nonce-value-1234567890';
const DISCORD_USER = { id: '555555555555555555', username: 'Mallory' };
const GUILD = '111111111111111111';

type SetCall = [string, string, Record<string, unknown>?];

function jar(values: Record<string, string>) {
    return {
        get: (name: string) => (name in values ? { name, value: values[name] } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
    };
}

let store: ReturnType<typeof jar>;

function callback(state: unknown, extra = '') {
    const s = encodeURIComponent(typeof state === 'string' ? state : JSON.stringify(state));
    return new Request(`http://localhost:3000/api/auth/discord/callback?code=abc&state=${s}${extra}`);
}

function stubDiscord(tokenBody: Record<string, unknown> = { access_token: 'at' }) {
    const fetchMock = vi.fn(async (url: string) => {
        if (url.includes('/oauth2/token')) return new Response(JSON.stringify(tokenBody), { status: 200 });
        if (url.includes('/users/@me')) return new Response(JSON.stringify(DISCORD_USER), { status: 200 });
        return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function cookieSet(name: string): SetCall | undefined {
    return (store.set.mock.calls as SetCall[]).find((c) => c[0] === name);
}

describe('GET /api/auth/discord/callback', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.DISCORD_APP_ID = 'app-id';
        process.env.DISCORD_CLIENT_SECRET = 'client-secret';
        store = jar({ tabletop_oauth_nonce: NONCE });
        mockCookies.mockResolvedValue(store);
        mockAdmin.mockResolvedValue(false);
        mockPrisma.event.update.mockResolvedValue({});
        mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'abc', managerDiscordId: null });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('CSRF nonce', () => {
        it('rejects a callback when the nonce cookie is missing', async () => {
            store = jar({});
            mockCookies.mockResolvedValue(store);
            const fetchMock = stubDiscord();

            const res = await GET(callback({ nonce: NONCE, flow: 'login', returnTo: '/' }));

            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: 'Invalid OAuth state' });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('rejects a callback whose state nonce does not match the cookie', async () => {
            const fetchMock = stubDiscord();

            const res = await GET(callback({ nonce: 'attacker', flow: 'login', returnTo: '/' }));

            expect(res.status).toBe(400);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('rejects a state with no nonce', async () => {
            stubDiscord();
            const res = await GET(callback({ flow: 'login', returnTo: '/' }));
            expect(res.status).toBe(400);
        });

        it('consumes the nonce cookie on success', async () => {
            stubDiscord();
            await GET(callback({ nonce: NONCE, flow: 'login', returnTo: '/' }));
            expect(store.delete).toHaveBeenCalled();
        });
    });

    describe('returnTo', () => {
        it('never redirects off-site', async () => {
            stubDiscord();
            const res = await GET(callback({ nonce: NONCE, flow: 'login', returnTo: 'https://evil.example/x' }));
            expect(res.headers.get('location')).toBe('http://localhost:3000/');
        });

        it('treats a protocol-relative returnTo as unsafe', async () => {
            stubDiscord();
            const res = await GET(callback({ nonce: NONCE, flow: 'login', returnTo: '//evil.example' }));
            expect(new URL(res.headers.get('location')!).origin).toBe('http://localhost:3000');
        });

        it('falls back to / when returnTo is missing, without throwing', async () => {
            stubDiscord();
            const res = await GET(callback({ nonce: NONCE, flow: 'login' }));
            expect(res.status).toBe(307);
            expect(res.headers.get('location')).toBe('http://localhost:3000/');
        });

        it('keeps the error redirect on-site when the token exchange fails', async () => {
            vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 400 })));
            const res = await GET(callback({ nonce: NONCE, flow: 'login', returnTo: 'https://evil.example' }));
            expect(new URL(res.headers.get('location')!).origin).toBe('http://localhost:3000');
        });
    });

    describe('manager claim on the login flow', () => {
        it('does not claim the event for someone who is not already its admin', async () => {
            stubDiscord();

            await GET(callback({ nonce: NONCE, flow: 'login', returnTo: '/e/abc/manage' }));

            expect(mockAdmin).toHaveBeenCalledWith('abc');
            expect(mockPrisma.event.update).not.toHaveBeenCalled();
            expect(cookieSet('tabletop_admin_abc')).toBeUndefined();
        });

        it('links the Discord identity for a verified admin without rotating the admin token', async () => {
            mockAdmin.mockResolvedValue(true);
            stubDiscord();

            await GET(callback({ nonce: NONCE, flow: 'login', returnTo: '/e/abc/manage' }));

            expect(mockPrisma.event.update).toHaveBeenCalledTimes(1);
            const data = mockPrisma.event.update.mock.calls[0][0].data;
            expect(data).toEqual({ managerDiscordId: DISCORD_USER.id, managerDiscordUsername: 'Mallory' });
            expect(cookieSet('tabletop_admin_abc')).toBeUndefined();
        });

        it('never overwrites an existing Discord manager', async () => {
            mockAdmin.mockResolvedValue(true);
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'abc', managerDiscordId: '777777777777777777' });
            stubDiscord();

            await GET(callback({ nonce: NONCE, flow: 'login', returnTo: '/e/abc/manage' }));

            expect(mockPrisma.event.update).not.toHaveBeenCalled();
        });

        it('does not rotate the admin token when the manager logs back in', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'abc', managerDiscordId: DISCORD_USER.id });
            stubDiscord();

            await GET(callback({ nonce: NONCE, flow: 'login', returnTo: '/e/abc/manage' }));

            expect(mockPrisma.event.update).not.toHaveBeenCalled();
        });
    });

    describe('bot-add (connect) flow', () => {
        it('grants a signed, one-hour guild cookie to a verified admin', async () => {
            mockAdmin.mockResolvedValue(true);
            stubDiscord({ access_token: 'at', guild: { id: GUILD } });

            const res = await GET(callback({ nonce: NONCE, flow: 'connect', returnTo: '/e/abc/manage' }, `&guild_id=${GUILD}`));

            const set = cookieSet('tabletop_discord_guild_abc');
            expect(set).toBeDefined();
            expect(verifyValue('discord-guild:abc', set![1])).toBe(GUILD);
            expect(set![2]).toMatchObject({ httpOnly: true, maxAge: 3600 });
            const location = new URL(res.headers.get('location')!);
            expect(location.pathname).toBe('/e/abc/manage');
            expect(location.searchParams.get('guild_id')).toBe(GUILD);
            expect(location.searchParams.get('discord_connected')).toBe('true');
        });

        it('grants no guild cookie when the caller is not the admin', async () => {
            stubDiscord({ access_token: 'at', guild: { id: GUILD } });

            await GET(callback({ nonce: NONCE, flow: 'connect', returnTo: '/e/abc/manage' }, `&guild_id=${GUILD}`));

            expect(cookieSet('tabletop_discord_guild_abc')).toBeUndefined();
            expect(mockPrisma.event.update).not.toHaveBeenCalled();
        });

        it('grants no guild cookie for a malformed guild id', async () => {
            mockAdmin.mockResolvedValue(true);
            stubDiscord({ access_token: 'at', guild: { id: 'not-a-snowflake' } });

            await GET(callback({ nonce: NONCE, flow: 'connect', returnTo: '/e/abc/manage' }));

            expect(cookieSet('tabletop_discord_guild_abc')).toBeUndefined();
        });
    });
});
