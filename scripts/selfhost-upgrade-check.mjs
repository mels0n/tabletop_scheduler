#!/usr/bin/env node
// ==============================================================================
// Self-host upgrade check.
//
// Proves that every self-host database shape we have ever shipped (one snapshot
// per release under prisma/compat/) upgrades to the CURRENT prisma/schema.prisma
// with a plain `prisma db push`, exactly as start.sh runs it on container boot:
// no --accept-data-loss, no manual step, and the existing rows survive.
//
// For each snapshot:
//   1. create a fresh temporary SQLite file
//   2. `prisma db push --force-reset` the snapshot schema into it
//   3. seed one Event, TimeSlot, Participant and Vote with raw INSERTs that use
//      only the columns that snapshot has (read from the snapshot's models)
//   4. `prisma db push` the current schema WITHOUT --accept-data-loss (must exit 0)
//   5. read the rows back through the generated client for the current schema
//
// Never touches DATABASE_URL from the environment; every database is a temp file.
// Requires `npx prisma generate` for prisma/schema.prisma (the SQLite client).
//
// Usage: npm run db:upgrade-check
// ==============================================================================
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPAT_DIR = path.join(ROOT, 'prisma', 'compat');
const CURRENT_SCHEMA = path.join(ROOT, 'prisma', 'schema.prisma');
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');
const GENERATED_SCHEMA = path.join(ROOT, 'node_modules', '.prisma', 'client', 'schema.prisma');

const SEED_SLUG = 'upgrade-check-event';
const SEED_TITLE = 'Upgrade check event';
const SEED_TIME = Date.UTC(2026, 0, 15, 18, 0, 0); // Prisma stores SQLite DateTime as epoch ms

/** Parse `model X { ... }` blocks into scalar field descriptors. */
export function readModels(schemaSource) {
    const lines = schemaSource.split(/\r?\n/);
    const blocks = new Map();
    let current = null;
    for (const raw of lines) {
        const line = raw.replace(/\/\/.*$/, '').trim();
        if (!line) continue;
        if (current === null) {
            const open = line.match(/^(model|enum)\s+(\w+)\s*\{$/);
            if (open) current = { kind: open[1], name: open[2], lines: [] };
            continue;
        }
        if (line === '}') {
            blocks.set(current.name, current);
            current = null;
            continue;
        }
        current.lines.push(line);
    }

    const typeNames = new Set(blocks.keys());
    const models = new Map();
    for (const block of blocks.values()) {
        if (block.kind !== 'model') continue;
        const fields = [];
        for (const line of block.lines) {
            if (line.startsWith('@@')) continue;
            const match = line.match(/^(\w+)\s+(\w+)(\[\]|\?)?(.*)$/);
            if (!match) continue;
            const [, name, type, modifier = '', attrs] = match;
            if (modifier === '[]' || typeNames.has(type)) continue; // relation or list field
            const defaultMatch = attrs.match(/@default\(([^)]*\)?)\)/);
            fields.push({
                name,
                type,
                optional: modifier === '?',
                isId: /@id\b/.test(attrs),
                default: defaultMatch ? defaultMatch[1] : null,
                updatedAt: /@updatedAt\b/.test(attrs),
            });
        }
        models.set(block.name, fields);
    }
    return models;
}

/** True when the database itself fills the column (autoincrement, now(), literals). */
function hasDbDefault(field) {
    if (field.default === null) return false;
    return !/^(uuid|cuid)\(/.test(field.default);
}

function sqlValue(value) {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    return `'${String(value).replace(/'/g, "''")}'`;
}

function placeholderFor(field) {
    switch (field.type) {
        case 'String':
            return `${field.name}-seed`;
        case 'Int':
        case 'BigInt':
        case 'Float':
        case 'Decimal':
            return 1;
        case 'Boolean':
            return false;
        case 'DateTime':
            return SEED_TIME;
        default:
            throw new Error(`no placeholder for field type ${field.type} (${field.name})`);
    }
}

// Values that matter for the relations and the post-upgrade assertions.
const SEED = {
    Event: { id: 1, slug: SEED_SLUG, title: SEED_TITLE, timezone: 'UTC' },
    TimeSlot: { id: 1, eventId: 1, startTime: SEED_TIME, endTime: SEED_TIME + 3 * 3600 * 1000 },
    Participant: { id: 1, eventId: 1, name: 'Seed Player' },
    Vote: { id: 1, participantId: 1, timeSlotId: 1, preference: 'YES' },
};

/**
 * Build one INSERT per seeded model using only columns present in `models`:
 * every SEED value whose column exists, plus every required column the database
 * cannot fill on its own.
 */
export function buildSeedSql(models) {
    const statements = [];
    for (const [model, values] of Object.entries(SEED)) {
        const fields = models.get(model);
        if (!fields) throw new Error(`snapshot has no ${model} model`);
        const columns = [];
        const row = [];
        for (const field of fields) {
            let value;
            if (Object.hasOwn(values, field.name)) value = values[field.name];
            else if (field.updatedAt) value = SEED_TIME;
            else if (!field.optional && !hasDbDefault(field)) value = placeholderFor(field);
            else continue;
            columns.push(`"${field.name}"`);
            row.push(sqlValue(value));
        }
        statements.push(`INSERT INTO "${model}" (${columns.join(', ')}) VALUES (${row.join(', ')});`);
    }
    return statements.join('\n');
}

function prisma(args, { url, input } = {}) {
    const result = spawnSync(process.execPath, [PRISMA_CLI, ...args], {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
        input,
        encoding: 'utf8',
    });
    return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

async function checkSnapshot(file, PrismaClient) {
    const steps = [];
    const dir = mkdtempSync(path.join(tmpdir(), 'tt-upgrade-'));
    const dbFile = path.join(dir, 'upgrade.db').split(path.sep).join('/');
    const url = `file:${dbFile}`;
    const snapshot = path.join(COMPAT_DIR, file);
    let client;

    const step = (name, ok, detail = '') => {
        steps.push({ name, ok, detail });
        if (!ok) throw new Error(`${name} failed`);
    };

    try {
        const models = readModels(readFileSync(snapshot, 'utf8'));

        const create = prisma(['db', 'push', `--schema=${snapshot}`, '--skip-generate', '--force-reset'], { url });
        step('create snapshot db', create.ok, create.ok ? '' : create.output);

        const seedSql = buildSeedSql(models);
        const seed = prisma(['db', 'execute', '--url', url, '--stdin'], { url, input: seedSql });
        step('seed rows', seed.ok, seed.ok ? '' : `${seed.output}\n--- SQL ---\n${seedSql}`);

        const upgrade = prisma(['db', 'push', `--schema=${CURRENT_SCHEMA}`, '--skip-generate'], { url });
        step('db push current schema', upgrade.ok, upgrade.ok ? '' : upgrade.output);

        client = new PrismaClient({ datasources: { db: { url } } });
        const [events, slots, participants, votes] = await Promise.all([
            client.event.count(),
            client.timeSlot.count(),
            client.participant.count(),
            client.vote.count(),
        ]);
        const counts = `Event=${events} TimeSlot=${slots} Participant=${participants} Vote=${votes}`;
        step('rows survived', events === 1 && slots === 1 && participants === 1 && votes === 1, counts);

        const event = await client.event.findUnique({
            where: { slug: SEED_SLUG },
            include: { timeSlots: { include: { votes: true } }, participants: true },
        });
        const intact =
            event?.title === SEED_TITLE &&
            event.timeSlots[0]?.startTime.getTime() === SEED_TIME &&
            event.timeSlots[0]?.votes[0]?.preference === 'YES' &&
            event.participants[0]?.name === 'Seed Player';
        step('seeded values intact', intact, intact ? `slug=${SEED_SLUG}` : JSON.stringify(event));
    } catch (error) {
        if (!steps.some((s) => !s.ok)) steps.push({ name: 'unexpected error', ok: false, detail: String(error) });
    } finally {
        await client?.$disconnect();
        rmSync(dir, { recursive: true, force: true });
    }
    return steps;
}

async function main() {
    if (!existsSync(GENERATED_SCHEMA) || !/provider\s*=\s*"sqlite"/.test(readFileSync(GENERATED_SCHEMA, 'utf8'))) {
        console.error('The generated Prisma client is not the SQLite client. Run `npx prisma generate` first.');
        process.exit(1);
    }
    const { PrismaClient } = await import('@prisma/client');

    const snapshots = readdirSync(COMPAT_DIR)
        .filter((f) => f.endsWith('.prisma'))
        .sort();
    if (snapshots.length === 0) {
        console.error(`No snapshots found in ${COMPAT_DIR}`);
        process.exit(1);
    }

    let failed = 0;
    for (const file of snapshots) {
        const steps = await checkSnapshot(file, PrismaClient);
        const passed = steps.every((s) => s.ok);
        if (!passed) failed += 1;
        console.log(`\n${passed ? 'PASS' : 'FAIL'}  ${file} -> prisma/schema.prisma`);
        const width = Math.max(...steps.map((s) => s.name.length));
        for (const s of steps) {
            const firstLine = s.ok ? s.detail : s.detail.split('\n')[0];
            console.log(`  ${s.name.padEnd(width)}  ${s.ok ? 'ok  ' : 'FAIL'}  ${firstLine}`);
            if (!s.ok && s.detail.includes('\n')) console.log(s.detail.replace(/^/gm, '      '));
        }
    }

    console.log(`\n${snapshots.length - failed}/${snapshots.length} snapshots upgrade cleanly.`);
    process.exit(failed === 0 ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
