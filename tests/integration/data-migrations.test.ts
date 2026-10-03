import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSqliteTestDb, generatedClientIsSqlite, type SqliteTestDb } from './sqlite-db';
import { runDataMigrations } from '../../scripts/run-data-migrations.mjs';
import { dataMigrations } from '../../scripts/data-migrations/index.mjs';

type Tx = Parameters<Parameters<SqliteTestDb['prisma']['$transaction']>[0]>[0];

const silent = () => {};

describe.skipIf(!generatedClientIsSqlite())('data migration runner (SQLite integration)', () => {
    let db: SqliteTestDb;

    beforeEach(async () => {
        db = await createSqliteTestDb();
    });

    afterEach(async () => {
        await db.cleanup();
    });

    it('applies a pending migration once and skips it on the next run', async () => {
        let runs = 0;
        const migrations = [
            {
                id: 'test-create-event',
                description: 'create one event',
                up: async (tx: Tx) => {
                    runs += 1;
                    await tx.event.create({ data: { slug: 'from-migration', title: 'From migration' } });
                },
            },
        ];

        const first = await runDataMigrations(db.prisma, migrations, { log: silent });
        expect(first).toEqual({ applied: ['test-create-event'], skipped: [] });

        const second = await runDataMigrations(db.prisma, migrations, { log: silent });
        expect(second).toEqual({ applied: [], skipped: ['test-create-event'] });

        expect(runs).toBe(1);
        expect(await db.prisma.event.count({ where: { slug: 'from-migration' } })).toBe(1);
        const rows = await db.prisma.appMigration.findMany();
        expect(rows.map((r) => r.id)).toEqual(['test-create-event']);
        expect(rows[0].appliedAt).toBeInstanceOf(Date);
    });

    it('rolls back a failing migration, records nothing and stops before later ones', async () => {
        let laterRan = false;
        const migrations = [
            {
                id: 'test-fails',
                description: 'writes a row, then throws',
                up: async (tx: Tx) => {
                    await tx.event.create({ data: { slug: 'half-done', title: 'Half done' } });
                    throw new Error('boom');
                },
            },
            {
                id: 'test-after-failure',
                description: 'must not run',
                up: async () => {
                    laterRan = true;
                },
            },
        ];

        await expect(runDataMigrations(db.prisma, migrations, { log: silent })).rejects.toThrow(
            /test-fails failed and was rolled back: boom/,
        );

        expect(laterRan).toBe(false);
        expect(await db.prisma.appMigration.count()).toBe(0);
        expect(await db.prisma.event.count({ where: { slug: 'half-done' } })).toBe(0);
    });

    it('rejects duplicate ids before running anything', async () => {
        const noop = async () => {};
        const migrations = [
            { id: 'dup', description: 'a', up: noop },
            { id: 'dup', description: 'b', up: noop },
        ];
        await expect(runDataMigrations(db.prisma, migrations, { log: silent })).rejects.toThrow(/duplicate/);
        expect(await db.prisma.appMigration.count()).toBe(0);
    });

    it('runs the shipped migration list cleanly', async () => {
        const result = await runDataMigrations(db.prisma, dataMigrations, { log: silent });
        expect(result.applied.length + result.skipped.length).toBe(dataMigrations.length);
    });
});
