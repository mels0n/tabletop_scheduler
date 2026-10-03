import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createSqliteTestDb, generatedClientIsSqlite, type SqliteTestDb } from './sqlite-db';

const holder = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock('@/shared/lib/prisma', () => ({
    get default() {
        return holder.prisma;
    },
}));
vi.mock('@/features/telegram', () => ({ unpinChatMessage: vi.fn() }));
vi.mock('@/features/integrations/discord/model/discord', () => ({ unpinDiscordMessage: vi.fn() }));

import { GET } from '@/app/api/cron/cleanup/route';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * DAY);
const daysAhead = (n: number) => new Date(now + n * DAY);

let seq = 0;
async function makeEvent(
    prisma: PrismaClient,
    data: { status: string; eventType?: string; updatedAt?: Date; createdAt?: Date },
) {
    seq += 1;
    return prisma.event.create({ data: { slug: `e-${seq}`, title: `Event ${seq}`, ...data } });
}

async function addSlot(prisma: PrismaClient, eventId: number, start: Date, hours = 4) {
    return prisma.timeSlot.create({
        data: { eventId, startTime: start, endTime: new Date(start.getTime() + hours * 3600_000) },
    });
}

async function exists(prisma: PrismaClient, id: number) {
    return (await prisma.event.count({ where: { id } })) === 1;
}

function cronRequest() {
    return new Request('http://localhost/api/cron/cleanup', {
        headers: { authorization: 'Bearer test-cron-secret' },
    });
}

describe.skipIf(!generatedClientIsSqlite())('cleanup cron retention (SQLite integration)', () => {
    let db: SqliteTestDb;

    beforeAll(async () => {
        db = await createSqliteTestDb();
        holder.prisma = db.prisma;
    }, 60_000);

    afterAll(async () => {
        await db?.cleanup();
    });

    beforeEach(async () => {
        vi.stubEnv('CRON_SECRET', 'test-cron-secret');
        vi.stubEnv('CLEANUP_RETENTION_DAYS_FINALIZED', '');
        vi.stubEnv('CLEANUP_RETENTION_DAYS_DRAFT', '');
        vi.stubEnv('CLEANUP_RETENTION_DAYS_CANCELLED', '');
        await db.prisma.event.deleteMany({});
        await db.prisma.loginToken.deleteMany({});
    });

    it('retires a campaign whose last session ended before the cutoff and keeps one with a future session', async () => {
        const p = db.prisma;
        const finished = await makeEvent(p, { status: 'FINALIZED', eventType: 'CAMPAIGN' });
        for (const start of [daysAgo(10), daysAgo(3)]) {
            const slot = await addSlot(p, finished.id, start);
            await p.finalizedSession.create({ data: { eventId: finished.id, timeSlotId: slot.id } });
        }
        await p.participant.create({ data: { eventId: finished.id, name: 'Ada', discordId: '123' } });

        const ongoing = await makeEvent(p, { status: 'FINALIZED', eventType: 'CAMPAIGN' });
        for (const start of [daysAgo(10), daysAhead(5)]) {
            const slot = await addSlot(p, ongoing.id, start);
            await p.finalizedSession.create({ data: { eventId: ongoing.id, timeSlotId: slot.id } });
        }

        const res = await GET(cronRequest());
        expect(res.status).toBe(200);

        expect(await exists(p, finished.id)).toBe(false);
        expect(await p.participant.count({ where: { eventId: finished.id } })).toBe(0);
        expect(await exists(p, ongoing.id)).toBe(true);
    });

    it('keeps a campaign whose last session ended inside the retention window', async () => {
        const p = db.prisma;
        const recent = await makeEvent(p, { status: 'FINALIZED', eventType: 'CAMPAIGN' });
        // Ends about 20 hours ago: inside the default 1-day window.
        const slot = await addSlot(p, recent.id, new Date(now - 24 * 3600_000), 4);
        await p.finalizedSession.create({ data: { eventId: recent.id, timeSlotId: slot.id } });

        await GET(cronRequest());
        expect(await exists(p, recent.id)).toBe(true);
    });

    it('deletes a one-shot one day after its finalized slot ends', async () => {
        const p = db.prisma;
        const past = await makeEvent(p, { status: 'FINALIZED' });
        const pastSlot = await addSlot(p, past.id, daysAgo(2));
        await p.event.update({ where: { id: past.id }, data: { finalizedSlotId: pastSlot.id } });

        // Started 25 hours ago but a 4 hour slot ended only 21 hours ago: still inside the day.
        const justEnded = await makeEvent(p, { status: 'FINALIZED' });
        const justEndedSlot = await addSlot(p, justEnded.id, new Date(now - 25 * 3600_000));
        await p.event.update({ where: { id: justEnded.id }, data: { finalizedSlotId: justEndedSlot.id } });

        const upcoming = await makeEvent(p, { status: 'FINALIZED' });
        const upcomingSlot = await addSlot(p, upcoming.id, daysAhead(2));
        // An older unchosen slot must not make the event look expired.
        await addSlot(p, upcoming.id, daysAgo(5));
        await p.event.update({ where: { id: upcoming.id }, data: { finalizedSlotId: upcomingSlot.id } });

        await GET(cronRequest());
        expect(await exists(p, past.id)).toBe(false);
        expect(await exists(p, justEnded.id)).toBe(true);
        expect(await exists(p, upcoming.id)).toBe(true);
    });

    it('deletes a draft one day after its last proposed slot ends, whatever its last edit', async () => {
        const p = db.prisma;
        // Edited an hour ago, but every proposed time is two days gone: an edit does not extend it.
        const lapsed = await makeEvent(p, { status: 'DRAFT', createdAt: daysAgo(10), updatedAt: new Date(now - 3600_000) });
        await addSlot(p, lapsed.id, daysAgo(5));
        await addSlot(p, lapsed.id, daysAgo(2));

        const withFutureSlot = await makeEvent(p, { status: 'DRAFT', createdAt: daysAgo(60), updatedAt: daysAgo(40) });
        await addSlot(p, withFutureSlot.id, daysAgo(5));
        await addSlot(p, withFutureSlot.id, daysAhead(3));

        // Last slot ended 21 hours ago: still inside the one day window.
        const recent = await makeEvent(p, { status: 'DRAFT', createdAt: daysAgo(10), updatedAt: daysAgo(10) });
        await addSlot(p, recent.id, new Date(now - 25 * 3600_000));

        await GET(cronRequest());
        expect(await exists(p, lapsed.id)).toBe(false);
        expect(await exists(p, withFutureSlot.id)).toBe(true);
        expect(await exists(p, recent.id)).toBe(true);
    });

    it('deletes a draft with no slots one day after creation', async () => {
        const p = db.prisma;
        const old = await makeEvent(p, { status: 'DRAFT', createdAt: daysAgo(2), updatedAt: new Date(now - 3600_000) });
        const fresh = await makeEvent(p, { status: 'DRAFT', createdAt: new Date(now - 3600_000) });

        await GET(cronRequest());
        expect(await exists(p, old.id)).toBe(false);
        expect(await exists(p, fresh.id)).toBe(true);
    });

    it('deletes cancelled events one day after cancellation', async () => {
        const p = db.prisma;
        const old = await makeEvent(p, { status: 'CANCELLED', updatedAt: daysAgo(2) });
        const fresh = await makeEvent(p, { status: 'CANCELLED', updatedAt: new Date(now - 3600_000) });
        // A cancelled event with future slots is still removed a day after cancellation.
        await addSlot(p, old.id, daysAhead(10));

        await GET(cronRequest());
        expect(await exists(p, old.id)).toBe(false);
        expect(await exists(p, fresh.id)).toBe(true);
    });

    it('deletes expired events that have webhook rows, across more than one batch', async () => {
        const p = db.prisma;
        await p.event.createMany({
            data: Array.from({ length: 205 }, (_, i) => ({
                slug: `bulk-${i}`,
                title: `Bulk ${i}`,
                status: 'CANCELLED',
                updatedAt: daysAgo(30),
            })),
        });
        const withWebhook = await p.event.findFirstOrThrow({ where: { slug: 'bulk-0' } });
        await p.webhookEvent.create({
            data: {
                eventId: withWebhook.id,
                url: 'https://partner.example/hook',
                payload: '{}',
                status: 'PENDING',
                nextAttempt: new Date(),
            },
        });

        const res = await GET(cronRequest());
        const body = await res.json();

        expect(body).toMatchObject({ success: true, deleted: 205, errors: 0 });
        expect(await p.event.count()).toBe(0);
        expect(await p.webhookEvent.count()).toBe(0);
    });

    it('removes expired login tokens', async () => {
        const p = db.prisma;
        await p.loginToken.create({ data: { token: 'expired-hash', chatId: '1', expiresAt: daysAgo(1) } });
        await p.loginToken.create({ data: { token: 'live-hash', chatId: '1', expiresAt: daysAhead(1) } });

        const body = await (await GET(cronRequest())).json();
        expect(body.deletedLoginTokens).toBe(1);
        expect(await p.loginToken.count()).toBe(1);
    });
});
