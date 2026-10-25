import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

/**
 * Throwaway SQLite database for integration tests.
 *
 * Each call creates a fresh file under the OS temp dir, applies `prisma/schema.prisma`
 * to it with `db push` (the self-host contract), and returns a real PrismaClient bound to
 * that file. It never reads or connects to the ambient DATABASE_URL.
 */
export interface SqliteTestDb {
    prisma: PrismaClient;
    url: string;
    cleanup: () => Promise<void>;
}

const ROOT = process.cwd();
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');
const GENERATED_SCHEMA = path.join(ROOT, 'node_modules', '.prisma', 'client', 'schema.prisma');

/**
 * True when the generated Prisma client targets SQLite. After `prisma generate` for the
 * hosted (Postgres) schema the client cannot talk to a SQLite file, so callers skip.
 */
export function generatedClientIsSqlite(): boolean {
    if (!existsSync(GENERATED_SCHEMA)) return false;
    return /provider\s*=\s*"sqlite"/.test(readFileSync(GENERATED_SCHEMA, 'utf8'));
}

export async function createSqliteTestDb(): Promise<SqliteTestDb> {
    const dir = mkdtempSync(path.join(tmpdir(), 'tt-integration-'));
    const file = path.join(dir, `${randomUUID()}.db`).split(path.sep).join('/');
    const url = `file:${file}`;

    execFileSync(
        process.execPath,
        [PRISMA_CLI, 'db', 'push', '--schema=prisma/schema.prisma', '--skip-generate', '--force-reset'],
        { cwd: ROOT, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' },
    );

    const prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();

    return {
        prisma,
        url,
        cleanup: async () => {
            await prisma.$disconnect();
            // Windows can hold the SQLite file briefly after disconnect; retry instead of failing on EPERM.
            // The promise form is used because rmSync does not retry EPERM on current Node versions.
            await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        },
    };
}
