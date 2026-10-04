#!/usr/bin/env node
// ==============================================================================
// Data migration runner.
//
// Applies every pending entry of scripts/data-migrations/index.mjs, in order, to
// the database at DATABASE_URL. Each entry's `up` runs in one transaction with the
// insert of its AppMigration row, so an entry is applied exactly once, and a failed
// entry leaves nothing behind and is retried on the next run.
//
// Runs after the schema is in place:
//   - self-host: start.sh, right after `prisma db push` (every container start)
//   - hosted:    scripts/vercel-build.sh, right after `prisma migrate deploy`
//                (production builds only)
//
// Uses only the Prisma client API, so the same file works with the SQLite client
// (self-host) and the Postgres client (hosted). Exits non-zero on any failure.
// ==============================================================================
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Interactive transaction limits: a backfill may touch many rows. */
const TRANSACTION_OPTIONS = { maxWait: 30_000, timeout: 10 * 60_000 };

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isUniqueViolation(error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

/**
 * Apply every migration in `migrations` that has no AppMigration row yet.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {import('./data-migrations/index.mjs').DataMigration[]} migrations
 * @param {{ log?: (message: string) => void }} [options]
 * @returns {Promise<{ applied: string[], skipped: string[] }>}
 */
export async function runDataMigrations(prisma, migrations, { log = console.log } = {}) {
    const seen = new Set();
    for (const migration of migrations) {
        if (!migration.id || typeof migration.up !== 'function') {
            throw new Error(`data migration ${JSON.stringify(migration.id)} needs an id and an up function`);
        }
        if (seen.has(migration.id)) throw new Error(`duplicate data migration id ${migration.id}`);
        seen.add(migration.id);
    }

    const done = new Set((await prisma.appMigration.findMany({ select: { id: true } })).map((row) => row.id));
    /** @type {{ applied: string[], skipped: string[] }} */
    const result = { applied: [], skipped: [] };

    for (const migration of migrations) {
        if (done.has(migration.id)) {
            result.skipped.push(migration.id);
            log(`skipped  ${migration.id} (already applied)`);
            continue;
        }

        try {
            await prisma.$transaction(async (tx) => {
                await migration.up(tx);
                await tx.appMigration.create({ data: { id: migration.id } });
            }, TRANSACTION_OPTIONS);
        } catch (error) {
            // Another runner (a concurrent build) recorded it first; our transaction
            // rolled back, so its work is not applied twice.
            if (isUniqueViolation(error) && (await prisma.appMigration.count({ where: { id: migration.id } })) === 1) {
                result.skipped.push(migration.id);
                log(`skipped  ${migration.id} (applied by a concurrent run)`);
                continue;
            }
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`data migration ${migration.id} failed and was rolled back: ${reason}`, { cause: error });
        }

        result.applied.push(migration.id);
        log(`applied  ${migration.id}: ${migration.description}`);
    }

    return result;
}

async function main() {
    // @prisma/client is CommonJS; take the default export so this works under plain node.
    const { default: prismaPkg } = await import('@prisma/client');
    const { dataMigrations } = await import('./data-migrations/index.mjs');
    const prisma = new prismaPkg.PrismaClient();

    try {
        const { applied, skipped } = await runDataMigrations(prisma, dataMigrations, {
            log: (message) => console.log(`[data-migrations] ${message}`),
        });
        console.log(`[data-migrations] done: ${applied.length} applied, ${skipped.length} already applied`);
    } catch (error) {
        console.error(`[data-migrations] ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
