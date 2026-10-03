import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createSqliteTestDb, generatedClientIsSqlite, type SqliteTestDb } from './sqlite-db';

// The action under test imports the shared client; point it at the throwaway database.
const holder = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, eventRowsAtBroadcast: -1 }));
vi.mock('@/shared/lib/prisma', () => ({
    get default() {
        return holder.prisma;
    },
}));
vi.mock('@/features/auth/server/verify', () => ({ verifyEventAdmin: vi.fn(async () => true) }));
vi.mock('@/features/notifications', () => ({
    broadcastToEvent: vi.fn(async (event: { id: number }) => {
        holder.eventRowsAtBroadcast = await holder.prisma.event.count({ where: { id: event.id } });
        return { telegram: { status: 'skipped' }, discord: { status: 'skipped' } };
    }),
}));

import { deleteEvent } from '@/features/event-management/server/actions';
import { broadcastToEvent } from '@/features/notifications';

async function seedEventWithChildren(prisma: PrismaClient, slug: string) {
    const event = await prisma.event.create({
        data: { slug, title: 'Cascade test', adminToken: 'hash', fromUrl: 'https://partner.example/hook' },
    });
    const slot = await prisma.timeSlot.create({
        data: {
            eventId: event.id,
            startTime: new Date('2030-01-01T18:00:00Z'),
            endTime: new Date('2030-01-01T22:00:00Z'),
        },
    });
    const participant = await prisma.participant.create({ data: { eventId: event.id, name: 'Ada' } });
    await prisma.vote.create({ data: { participantId: participant.id, timeSlotId: slot.id, preference: 'YES' } });
    await prisma.finalizedSession.create({ data: { eventId: event.id, timeSlotId: slot.id } });
    await prisma.webhookEvent.create({
        data: { eventId: event.id, url: 'https://partner.example/hook', payload: '{}', status: 'PENDING', nextAttempt: new Date() },
    });
    // The event also points back at a participant (finalized host), which makes the graph cyclic.
    await prisma.event.update({ where: { id: event.id }, data: { status: 'FINALIZED', finalizedHostId: participant.id } });
    return { event, slot, participant };
}

async function childCounts(prisma: PrismaClient, eventId: number) {
    const [slots, participants, votes, sessions, webhooks] = await Promise.all([
        prisma.timeSlot.count({ where: { eventId } }),
        prisma.participant.count({ where: { eventId } }),
        prisma.vote.count({ where: { timeSlot: { eventId } } }),
        prisma.finalizedSession.count({ where: { eventId } }),
        prisma.webhookEvent.count({ where: { eventId } }),
    ]);
    return { slots, participants, votes, sessions, webhooks };
}

const NONE = { slots: 0, participants: 0, votes: 0, sessions: 0, webhooks: 0 };

describe.skipIf(!generatedClientIsSqlite())('event deletion cascades (SQLite integration)', () => {
    let db: SqliteTestDb;

    beforeAll(async () => {
        db = await createSqliteTestDb();
        holder.prisma = db.prisma;
    }, 60_000);

    afterAll(async () => {
        await db?.cleanup();
    });

    it('prisma.event.delete removes slots, participants, votes, finalized sessions and webhook rows', async () => {
        const { event } = await seedEventWithChildren(db.prisma, 'cascade-raw');
        expect(await childCounts(db.prisma, event.id)).toEqual({ slots: 1, participants: 1, votes: 1, sessions: 1, webhooks: 1 });

        await db.prisma.event.delete({ where: { id: event.id } });

        expect(await db.prisma.event.count({ where: { id: event.id } })).toBe(0);
        expect(await childCounts(db.prisma, event.id)).toEqual(NONE);
    });

    it('deleteEvent succeeds for an event with webhook rows and announces only after the commit', async () => {
        vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
        vi.stubEnv('DISCORD_BOT_TOKEN', '');
        const { event } = await seedEventWithChildren(db.prisma, 'cascade-action');

        const result = await deleteEvent('cascade-action');

        expect(result).toEqual({ success: true });
        expect(await db.prisma.event.count({ where: { id: event.id } })).toBe(0);
        expect(await childCounts(db.prisma, event.id)).toEqual(NONE);
        expect(broadcastToEvent).toHaveBeenCalledTimes(1);
        expect(holder.eventRowsAtBroadcast).toBe(0);
        vi.unstubAllEnvs();
    });
});
