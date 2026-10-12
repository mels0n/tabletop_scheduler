import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import type { PrismaClient } from '@prisma/client';
import { createSqliteTestDb, generatedClientIsSqlite, type SqliteTestDb } from './sqlite-db';

// Everything issued before the 128-bit token change must keep working. Rows are seeded in the
// old formats and the real entry points are driven against a real SQLite database. Only the
// outbound Telegram sends and the dashboard sync (which would hit Telegram/Discord) are mocked.
const holder = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock('@/shared/lib/prisma', () => ({
    get default() {
        return holder.prisma;
    },
}));
vi.mock('@/features/telegram/lib/telegram-client', () => ({
    sendTelegramMessage: vi.fn(async () => 555),
    pinChatMessage: vi.fn(async () => undefined),
}));
vi.mock('@/features/event-management', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/event-management')>()),
    syncDashboard: vi.fn(async () => undefined),
}));

import { GET as getEvent } from '@/app/api/event/[slug]/route';
import { GET as magicLink } from '@/app/api/event/[slug]/auth/route';
import { POST as postLocation } from '@/app/api/event/[slug]/location/route';
import { GET as globalLogin } from '@/app/auth/login/route';
import { verifyEventAdmin } from '@/features/auth';
import { handleTelegramUpdate, resetProcessedUpdatesForTests } from '@/features/telegram/server/update-handler';
import { connectCodeFor } from '@/features/telegram/model/connect-code';
import { slugParam } from '@/shared/lib/action-params';
import { hashToken, newToken } from '@/shared/lib/token';
import type { TelegramUpdate } from '@/features/telegram/model/types';

const SECRET = 'legacy-formats-test-secret';
const ORIGIN = 'http://selfhost.lan:3000';

const HEX_SLUG = '59f98164';
const BASE62_14_SLUG = 'aB3dE5gH7jK9mN';
const NEW_SLUG = newToken();

let db: SqliteTestDb;
let nextUpdateId = 1;

function setRequestContext(opts: { cookie?: Record<string, string>; header?: Record<string, string> } = {}) {
    const store = {
        get: vi.fn((name: string) => (opts.cookie?.[name] !== undefined ? { name, value: opts.cookie[name] } : undefined)),
        set: vi.fn(),
        delete: vi.fn(),
        getAll: vi.fn(() => []),
        has: vi.fn(),
    };
    vi.mocked(cookies).mockResolvedValue(store as never);
    vi.mocked(headers).mockResolvedValue({
        get: (name: string) => opts.header?.[name.toLowerCase()] ?? null,
    } as never);
    return store;
}

async function seedEvent(slug: string, data: Record<string, unknown> = {}) {
    return db.prisma.event.create({ data: { slug, title: `Event ${slug}`, adminToken: hashToken('unused'), ...data } as never });
}

async function adminTokenOf(slug: string) {
    return (await db.prisma.event.findUniqueOrThrow({ where: { slug } })).adminToken;
}

function magicCall(slug: string, token: string) {
    const req = new NextRequest(`${ORIGIN}/api/event/${slug}/auth?token=${encodeURIComponent(token)}`);
    return magicLink(req, { params: Promise.resolve({ slug }) });
}

function locationCall(slug: string) {
    const req = new Request(`${ORIGIN}/api/event/${slug}/location`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ location: 'The Dragon Inn' }),
    });
    return postLocation(req, { params: Promise.resolve({ slug }) });
}

function tgUpdate(text: string, chatType: string, chatId: number, username = 'chris'): TelegramUpdate {
    return {
        update_id: nextUpdateId++,
        message: { text, chat: { id: chatId, type: chatType }, from: { id: 4242, username } },
    };
}

describe.skipIf(!generatedClientIsSqlite())('legacy token and slug formats (SQLite integration)', () => {
    beforeAll(async () => {
        db = await createSqliteTestDb();
        holder.prisma = db.prisma;
    }, 60_000);

    afterAll(async () => {
        await db?.cleanup();
    });

    beforeEach(() => {
        process.env.SESSION_SECRET = SECRET;
        process.env.TELEGRAM_BOT_TOKEN = 'test-token';
        resetProcessedUpdatesForTests();
        setRequestContext();
    });

    describe('slugs', () => {
        it.each([
            ['8 hex chars', HEX_SLUG],
            ['14 base62 chars', BASE62_14_SLUG],
            ['22 base62 chars', NEW_SLUG],
        ])('%s: the public event read finds the event and the shared validator accepts the slug', async (_label, slug) => {
            await seedEvent(slug, { title: `Slug ${slug}` });

            expect(slugParam.safeParse(slug).success).toBe(true);

            const res = await getEvent(new Request(`${ORIGIN}/api/event/${slug}`), { params: Promise.resolve({ slug }) });
            expect(res.status).toBe(200);
            expect((await res.json()).title).toBe(`Slug ${slug}`);
        });

        it('an unknown slug is still a 404', async () => {
            const res = await getEvent(new Request(`${ORIGIN}/api/event/nope`), { params: Promise.resolve({ slug: 'deadbeef' }) });
            expect(res.status).toBe(404);
        });
    });

    describe('admin tokens', () => {
        const uuid = randomUUID();
        const slug = 'adm0a1b2';

        beforeAll(async () => {
            await seedEvent(slug, { adminToken: hashToken(uuid) });
        });

        it('magic link accepts a UUID token stored as its hash and sets the admin cookie', async () => {
            const store = setRequestContext();
            const res = await magicCall(slug, uuid);
            expect(res.headers.get('location')).toBe(`${ORIGIN}/e/${slug}/manage`);
            expect(store.set).toHaveBeenCalledWith(`tabletop_admin_${slug}`, uuid, expect.anything());
        });

        it('magic link rejects a wrong token and the stored hash itself', async () => {
            const store = setRequestContext();
            for (const bad of [randomUUID(), hashToken(uuid)]) {
                const res = await magicCall(slug, bad);
                expect(res.headers.get('location')).toBe(`${ORIGIN}/e/${slug}?error=invalid_token`);
            }
            expect(store.set).not.toHaveBeenCalled();
        });

        it('Authorization: Bearer <uuid> passes verifyEventAdmin and an admin route', async () => {
            setRequestContext({ header: { authorization: `Bearer ${uuid}` } });
            expect(await verifyEventAdmin(slug)).toBe(true);

            const res = await locationCall(slug);
            expect(res.status).toBe(200);
            expect((await db.prisma.event.findUniqueOrThrow({ where: { slug } })).location).toBe('The Dragon Inn');
        });

        it('a 14-char slug event works through the magic link and a bearer admin route', async () => {
            const token = randomUUID();
            const s14 = 'Zq8Wm2Lp5Tn7Rk';
            await seedEvent(s14, { adminToken: hashToken(token) });

            const store = setRequestContext();
            const res = await magicCall(s14, token);
            expect(res.headers.get('location')).toBe(`${ORIGIN}/e/${s14}/manage`);
            expect(store.set).toHaveBeenCalledWith(`tabletop_admin_${s14}`, token, expect.anything());

            setRequestContext({ header: { authorization: `Bearer ${token}` } });
            expect((await locationCall(s14)).status).toBe(200);
            expect((await db.prisma.event.findUniqueOrThrow({ where: { slug: s14 } })).location).toBe('The Dragon Inn');
        });

        it('the admin cookie holding the UUID passes verifyEventAdmin', async () => {
            setRequestContext({ cookie: { [`tabletop_admin_${slug}`]: uuid } });
            expect(await verifyEventAdmin(slug)).toBe(true);
        });

        it('a wrong bearer token is rejected by verifyEventAdmin and the admin route', async () => {
            setRequestContext({ header: { authorization: `Bearer ${randomUUID()}` } });
            expect(await verifyEventAdmin(slug)).toBe(false);
            expect((await locationCall(slug)).status).toBe(403);
        });

        it('another event never accepts this UUID', async () => {
            await seedEvent('other0001', { adminToken: hashToken(randomUUID()) });
            setRequestContext({ header: { authorization: `Bearer ${uuid}` } });
            expect(await verifyEventAdmin('other0001')).toBe(false);
        });

        it('control: a newly minted 22-char base62 token works through the same paths', async () => {
            const token = newToken();
            const newSlug = newToken();
            await seedEvent(newSlug, { adminToken: hashToken(token) });

            expect(token).toMatch(/^[0-9A-Za-z]{22}$/);

            const store = setRequestContext();
            const res = await magicCall(newSlug, token);
            expect(res.headers.get('location')).toBe(`${ORIGIN}/e/${newSlug}/manage`);
            expect(store.set).toHaveBeenCalledWith(`tabletop_admin_${newSlug}`, token, expect.anything());

            setRequestContext({ header: { authorization: `Bearer ${token}` } });
            expect(await verifyEventAdmin(newSlug)).toBe(true);
            setRequestContext({ header: { authorization: `Bearer ${newToken()}` } });
            expect(await verifyEventAdmin(newSlug)).toBe(false);
        });
    });

    describe('very old plaintext admin token', () => {
        it('magic link accepts the plaintext UUID, upgrades the row to its hash, and keeps working', async () => {
            const uuid = randomUUID();
            const slug = 'plain001';
            await seedEvent(slug, { adminToken: uuid });

            setRequestContext();
            const first = await magicCall(slug, uuid);
            expect(first.headers.get('location')).toBe(`${ORIGIN}/e/${slug}/manage`);
            expect(await adminTokenOf(slug)).toBe(hashToken(uuid));

            const second = await magicCall(slug, uuid);
            expect(second.headers.get('location')).toBe(`${ORIGIN}/e/${slug}/manage`);
            // The hash is not a token, so it cannot be replayed after the upgrade.
            const replay = await magicCall(slug, hashToken(uuid));
            expect(replay.headers.get('location')).toBe(`${ORIGIN}/e/${slug}?error=invalid_token`);
        });

        it('a bearer plaintext UUID passes verifyEventAdmin, upgrades the row, and keeps working', async () => {
            const uuid = randomUUID();
            const slug = 'plain002';
            await seedEvent(slug, { adminToken: uuid });

            setRequestContext({ header: { authorization: `Bearer ${uuid}` } });
            expect(await verifyEventAdmin(slug)).toBe(true);
            expect(await adminTokenOf(slug)).toBe(hashToken(uuid));
            expect(await verifyEventAdmin(slug)).toBe(true);

            setRequestContext({ header: { authorization: `Bearer ${randomUUID()}` } });
            expect(await verifyEventAdmin(slug)).toBe(false);
        });
    });

    describe('login tokens (/auth/login)', () => {
        function loginCall(token: string) {
            return globalLogin(new NextRequest(`${ORIGIN}/auth/login?token=${encodeURIComponent(token)}`));
        }

        it('redeems a UUID token stored as its hash', async () => {
            const uuid = randomUUID();
            await db.prisma.loginToken.create({
                data: { token: hashToken(uuid), chatId: '777', telegramUsername: 'ada', expiresAt: new Date(Date.now() + 15 * 60_000) },
            });
            const store = setRequestContext();

            const res = await loginCall(uuid);

            expect(res.headers.get('location')).toBe(`${ORIGIN}/profile?success=logged_in`);
            expect(store.set.mock.calls.map((c) => c[0])).toContain('tabletop_user_telegram_name');
        });

        it('redeems a new base62 token, and rejects an unknown or expired one', async () => {
            const token = newToken();
            await db.prisma.loginToken.create({
                data: { token: hashToken(token), chatId: '778', expiresAt: new Date(Date.now() + 15 * 60_000) },
            });
            const expired = randomUUID();
            await db.prisma.loginToken.create({
                data: { token: hashToken(expired), chatId: '779', expiresAt: new Date(Date.now() - 60_000) },
            });

            expect((await loginCall(token)).headers.get('location')).toBe(`${ORIGIN}/profile?success=logged_in`);
            expect((await loginCall(randomUUID())).headers.get('location')).toBe(`${ORIGIN}/profile?error=invalid_token`);
            expect((await loginCall(expired)).headers.get('location')).toBe(`${ORIGIN}/profile?error=expired_token`);
        });
    });

    describe('telegram recovery (/start rec_<token>)', () => {
        it.each([
            ['legacy 8-hex token', 'cafef00d', 'rec00001'],
            ['new base62 token', newToken(), 'rec00002'],
        ])('redeems a %s in a private chat', async (_label, recToken, slug) => {
            await seedEvent(slug, {
                recoveryToken: hashToken(recToken),
                recoveryTokenExpires: new Date(Date.now() + 10 * 60_000),
            });

            await handleTelegramUpdate(tgUpdate(`/start rec_${recToken}`, 'private', 4242, 'chris'));

            const row = await db.prisma.event.findUniqueOrThrow({ where: { slug } });
            expect(row.managerChatId).toBe('4242');
            expect(row.managerTelegram).toBe('chris');
            expect(row.recoveryToken).toBeNull();
            expect(row.recoveryTokenExpires).toBeNull();
        });

        it('does not redeem an unknown token', async () => {
            await seedEvent('rec00003', {
                recoveryToken: hashToken('cafef00d1'),
                recoveryTokenExpires: new Date(Date.now() + 10 * 60_000),
            });
            await handleTelegramUpdate(tgUpdate('/start rec_cafef00d', 'private', 4242, 'chris'));
            const row = await db.prisma.event.findUniqueOrThrow({ where: { slug: 'rec00003' } });
            expect(row.managerChatId).toBeNull();
            expect(row.recoveryToken).toBe(hashToken('cafef00d1'));
        });
    });

    describe('telegram connect (/connect <slug> <code>)', () => {
        const legacyCode = (slug: string, adminHash: string, chatId: string | null, nonce: string | null) =>
            createHmac('sha256', SECRET)
                .update(`connect:${slug}:${adminHash}:${chatId ?? ''}:${nonce ?? ''}`)
                .digest('hex')
                .slice(0, 8);

        async function seedConnectable(slug: string, nonce: string | null) {
            const adminHash = hashToken(randomUUID());
            await seedEvent(slug, { adminToken: adminHash, telegramConnectNonce: nonce });
            return adminHash;
        }

        it('binds with a legacy 8-hex code against a legacy hex nonce, then retires legacy codes', async () => {
            const slug = '59f98165';
            const nonce = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
            const adminHash = await seedConnectable(slug, nonce);

            await handleTelegramUpdate(tgUpdate(`/connect ${slug} ${legacyCode(slug, adminHash, null, nonce)}`, 'group', -1001));

            const bound = await db.prisma.event.findUniqueOrThrow({ where: { slug } });
            expect(bound.telegramChatId).toBe('-1001');
            expect(bound.telegramConnectNonce).toMatch(/^v2_/);

            // A legacy-style code for the new nonce is rejected, even for a reconnect.
            const stale = legacyCode(slug, adminHash, '-1001', bound.telegramConnectNonce);
            await handleTelegramUpdate(tgUpdate(`/connect ${slug} ${stale}`, 'group', -2002));
            const afterStale = await db.prisma.event.findUniqueOrThrow({ where: { slug } });
            expect(afterStale.telegramChatId).toBe('-1001');
            expect(afterStale.telegramConnectNonce).toBe(bound.telegramConnectNonce);

            // The new 22-char code works.
            const fresh = connectCodeFor(slug, adminHash, '-1001', bound.telegramConnectNonce);
            expect(fresh).toMatch(/^[0-9A-Za-z]{22}$/);
            await handleTelegramUpdate(tgUpdate(`/connect ${slug} ${fresh}`, 'group', -2002));
            const rebound = await db.prisma.event.findUniqueOrThrow({ where: { slug } });
            expect(rebound.telegramChatId).toBe('-2002');
            expect(rebound.telegramConnectNonce).not.toBe(bound.telegramConnectNonce);
        });

        it('binds a 14-char slug event with a legacy 8-hex code', async () => {
            const slug = 'Hk4Pz9Qa2Wc7Ux';
            const nonce = 'ffeeddccbbaa99887766554433221100';
            const adminHash = await seedConnectable(slug, nonce);

            await handleTelegramUpdate(tgUpdate(`/connect ${slug} ${legacyCode(slug, adminHash, null, nonce)}`, 'group', -4004));

            const bound = await db.prisma.event.findUniqueOrThrow({ where: { slug } });
            expect(bound.telegramChatId).toBe('-4004');
            expect(bound.telegramConnectNonce).toMatch(/^v2_/);
        });

        it('accepts the legacy code in uppercase', async () => {
            const slug = '1e9ac0de';
            const nonce = '00112233445566778899aabbccddeeff';
            const adminHash = await seedConnectable(slug, nonce);

            const code = legacyCode(slug, adminHash, null, nonce).toUpperCase();
            await handleTelegramUpdate(tgUpdate(`/connect ${slug} ${code}`, 'group', -3003));

            const row = await db.prisma.event.findUniqueOrThrow({ where: { slug } });
            expect(row.telegramChatId).toBe('-3003');
            expect(row.telegramConnectNonce).toMatch(/^v2_/);
        });

        it('accepts a legacy code for an event that never had a nonce (null nonce)', async () => {
            const slug = 'a0b1c2d3';
            const adminHash = await seedConnectable(slug, null);

            await handleTelegramUpdate(tgUpdate(`/connect ${slug} ${legacyCode(slug, adminHash, null, null)}`, 'group', -4004));

            expect((await db.prisma.event.findUniqueOrThrow({ where: { slug } })).telegramChatId).toBe('-4004');
        });

        it('rejects a wrong legacy code and leaves the event untouched', async () => {
            const slug = 'bad0c0de';
            const nonce = 'ffeeddccbbaa99887766554433221100';
            await seedConnectable(slug, nonce);

            await handleTelegramUpdate(tgUpdate(`/connect ${slug} 00000000`, 'group', -5005));

            const row = await db.prisma.event.findUniqueOrThrow({ where: { slug } });
            expect(row.telegramChatId).toBeNull();
            expect(row.telegramConnectNonce).toBe(nonce);
        });

        it('a new 22-char code also binds a 22-char-slug event still on a legacy nonce', async () => {
            const slug = newToken();
            const nonce = '0f0e0d0c0b0a09080706050403020100';
            const adminHash = await seedConnectable(slug, nonce);

            await handleTelegramUpdate(tgUpdate(`/connect ${slug} ${connectCodeFor(slug, adminHash, null, nonce)}`, 'group', -6006));

            expect((await db.prisma.event.findUniqueOrThrow({ where: { slug } })).telegramChatId).toBe('-6006');
        });
    });
});
