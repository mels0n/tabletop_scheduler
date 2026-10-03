import { describe, it, expect, vi, beforeEach } from 'vitest';

const { lookupMock, cookieJar } = vi.hoisted(() => ({
    lookupMock: vi.fn(),
    cookieJar: new Map<string, string>(),
}));
vi.mock('node:dns/promises', () => ({ default: { lookup: lookupMock }, lookup: lookupMock }));
vi.mock('@/shared/lib/prisma');
// after() callbacks are queued here and run by flushAfter(), standing in for Next running
// them once the response has been sent.
const { afterQueue } = vi.hoisted(() => ({ afterQueue: [] as Array<() => unknown> }));
vi.mock('next/server', async (importOriginal) => ({
    ...(await importOriginal<typeof import('next/server')>()),
    after: (task: () => unknown) => { afterQueue.push(task); },
}));
vi.mock('@/features/integrations/webhooks', () => ({ processWebhookRow: vi.fn() }));
vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    }),
    headers: async () => new Headers(),
}));

import prisma from '@/shared/lib/prisma';
import { signValue } from '@/shared/lib/session';
import { processWebhookRow } from '@/features/integrations/webhooks';
import { POST } from './route';

async function flushAfter() {
    while (afterQueue.length) await afterQueue.shift()!();
}

const mockPrisma = prisma as any;

const slot = { startTime: '2026-11-01T18:00:00.000Z', endTime: '2026-11-01T22:00:00.000Z' };
const valid = { title: 'Game Night', description: '', minPlayers: 3, maxPlayers: null, eventType: 'ONE_SHOT', timezone: 'Europe/London', slots: [slot], fromUrl: null, fromUrlId: null };

function request(body: unknown) {
    return new Request('https://tabletop.example/api/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function p2002() {
    return Object.assign(new Error('Unique constraint failed on the fields: (`slug`)'), {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
    });
}

describe('POST /api/event', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        cookieJar.clear();
        afterQueue.length = 0;
        (processWebhookRow as any).mockResolvedValue('delivered');
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
        mockPrisma.event.create.mockImplementation(async ({ data }: any) => ({ id: 11, slug: data.slug, title: data.title }));
        mockPrisma.webhookEvent.create.mockResolvedValue({ id: 'wh-1' });
        lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    });

    it('creates an event with an unguessable alphanumeric slug of at least 64 bits', async () => {
        const res = await POST(request(valid));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.slug).toMatch(/^[A-Za-z0-9]{14}$/);
        expect(body.adminToken).toBeTruthy();
        const data = mockPrisma.event.create.mock.calls[0][0].data;
        expect(data.timezone).toBe('Europe/London');
        expect(data.timeSlots.create[0].startTime).toEqual(new Date(slot.startTime));
    });

    it('retries once with a new slug on a slug collision', async () => {
        mockPrisma.$transaction
            .mockImplementationOnce(async () => { throw p2002(); })
            .mockImplementation((cb: any) => cb(mockPrisma));

        const res = await POST(request(valid));

        expect(res.status).toBe(200);
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('returns 409 when the slug collides twice', async () => {
        mockPrisma.$transaction.mockImplementation(async () => { throw p2002(); });

        const res = await POST(request(valid));

        expect(res.status).toBe(409);
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('rejects an invalid timezone with 400', async () => {
        const res = await POST(request({ ...valid, timezone: 'Mars/Olympus_Mons' }));

        expect(res.status).toBe(400);
        expect(await res.json()).toMatchObject({ code: 'validation' });
        expect(mockPrisma.event.create).not.toHaveBeenCalled();
    });

    it('rejects garbage dates and string minPlayers with 400 instead of 500', async () => {
        expect((await POST(request({ ...valid, slots: [{ startTime: 'garbage', endTime: 'x' }] }))).status).toBe(400);
        expect((await POST(request({ ...valid, minPlayers: '3' }))).status).toBe(400);
    });

    it('rejects a fromUrl pointing at a private address with 400 and creates nothing', async () => {
        lookupMock.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

        const res = await POST(request({ ...valid, fromUrl: 'https://localhost.example/hook' }));

        expect(res.status).toBe(400);
        expect(mockPrisma.event.create).not.toHaveBeenCalled();
        expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
    });

    it('rejects http://127.0.0.1:3000 as fromUrl', async () => {
        const res = await POST(request({ ...valid, fromUrl: 'http://127.0.0.1:3000/api/cron/cleanup' }));

        expect(res.status).toBe(400);
        expect(mockPrisma.event.create).not.toHaveBeenCalled();
    });

    it('enqueues the CREATED webhook without sending it inline', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');

        const res = await POST(request({ ...valid, fromUrl: 'https://hooks.example.com/tt', fromUrlId: 'ext-1' }));

        expect(res.status).toBe(200);
        expect(mockPrisma.webhookEvent.create).toHaveBeenCalledTimes(1);
        const wh = mockPrisma.webhookEvent.create.mock.calls[0][0].data;
        expect(wh.url).toBe('https://hooks.example.com/tt');
        expect(wh.status).toBe('PENDING');
        expect(JSON.parse(wh.payload)).toMatchObject({ type: 'CREATED', fromUrlId: 'ext-1' });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(mockPrisma.webhookEvent.findUnique).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    it('attempts delivery of the new CREATED row right after the response', async () => {
        const res = await POST(request({ ...valid, fromUrl: 'https://hooks.example.com/tt', fromUrlId: 'ext-1' }));

        expect(res.status).toBe(200);
        expect(afterQueue).toHaveLength(1);
        expect(processWebhookRow).not.toHaveBeenCalled();
        await flushAfter();
        expect(processWebhookRow).toHaveBeenCalledWith('wh-1');
    });

    it('swallows a failed immediate attempt (the cron retries the row)', async () => {
        (processWebhookRow as any).mockRejectedValue(new Error('db down'));

        await POST(request({ ...valid, fromUrl: 'https://hooks.example.com/tt' }));

        await expect(flushAfter()).resolves.toBeUndefined();
        expect(processWebhookRow).toHaveBeenCalledWith('wh-1');
    });

    it('schedules no delivery attempt when there is no fromUrl', async () => {
        await POST(request(valid));

        expect(afterQueue).toHaveLength(0);
    });

    it('ignores an unsigned identity cookie when setting the manager', async () => {
        cookieJar.set('tabletop_user_discord_id', '123456789012345678');
        cookieJar.set('tabletop_user_discord_name', 'Victim');

        await POST(request(valid));

        const data = mockPrisma.event.create.mock.calls[0][0].data;
        expect(data.managerDiscordId).toBeNull();
        expect(data.managerDiscordUsername).toBeNull();
    });

    it('uses a signed identity cookie for the manager', async () => {
        cookieJar.set('tabletop_user_discord_id', signValue('identity:discord', '123456789012345678'));
        cookieJar.set('tabletop_user_discord_name', 'Owner');

        await POST(request(valid));

        const data = mockPrisma.event.create.mock.calls[0][0].data;
        expect(data.managerDiscordId).toBe('123456789012345678');
        expect(data.managerDiscordUsername).toBe('Owner');
    });
});
