import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSqliteTestDb, generatedClientIsSqlite, type SqliteTestDb } from './sqlite-db';
import { isDmOptedOut, setDmOptOut } from '@/entities/notification-preference';

describe.skipIf(!generatedClientIsSqlite())('DM preference (SQLite integration)', () => {
    let db: SqliteTestDb;

    beforeEach(async () => {
        db = await createSqliteTestDb();
    });

    afterEach(async () => {
        await db.cleanup();
    });

    it('reads as not opted out when no preference row exists', async () => {
        expect(await isDmOptedOut(db.prisma, 'telegram', '111')).toBe(false);
        expect(await db.prisma.dmPreference.count()).toBe(0);
    });

    it('creates the row on opt-out and is idempotent on repeats', async () => {
        await setDmOptOut(db.prisma, 'discord', '222', true);
        await setDmOptOut(db.prisma, 'discord', '222', true);
        expect(await isDmOptedOut(db.prisma, 'discord', '222')).toBe(true);
        expect(await db.prisma.dmPreference.count()).toBe(1);
    });

    it('deletes the row when DMs are turned back on, leaving no record', async () => {
        await setDmOptOut(db.prisma, 'discord', '222', true);

        await setDmOptOut(db.prisma, 'discord', '222', false);

        expect(await isDmOptedOut(db.prisma, 'discord', '222')).toBe(false);
        expect(await db.prisma.dmPreference.count()).toBe(0);
    });

    it('turning DMs on with no existing row is a no-op', async () => {
        await setDmOptOut(db.prisma, 'telegram', '444', false);
        expect(await db.prisma.dmPreference.count()).toBe(0);
    });

    it('keys the preference by platform as well as id', async () => {
        await setDmOptOut(db.prisma, 'telegram', '333', true);

        expect(await isDmOptedOut(db.prisma, 'telegram', '333')).toBe(true);
        expect(await isDmOptedOut(db.prisma, 'discord', '333')).toBe(false);
    });
});
