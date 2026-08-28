import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The project ships two Prisma targets from one codebase:
 *   prisma/schema.prisma        -> sqlite, self-hosted / local dev
 *   prisma/hosted/schema.prisma -> postgresql, Vercel + Supabase
 *
 * They must describe the SAME data model; only the datasource block differs.
 * A field added to one and not the other means one of the two products is
 * silently broken at runtime, with nothing in the build to catch it.
 */

const SELF_HOSTED = join(process.cwd(), 'prisma', 'schema.prisma');
const HOSTED = join(process.cwd(), 'prisma', 'hosted', 'schema.prisma');

/** Extract `model X { ... }` / `enum X { ... }` blocks, normalized for comparison. */
function parseBlocks(path: string): Map<string, string[]> {
    const src = readFileSync(path, 'utf8');
    const blocks = new Map<string, string[]>();

    let current: string | null = null;
    let body: string[] = [];

    for (const raw of src.split('\n')) {
        // trim() first: it strips the trailing CR on Windows checkouts, which the
        // comment regex below cannot match (JS "." excludes carriage returns).
        const line = raw.trim().replace(/\/\/.*$/, '').trim().replace(/\s+/g, ' ');
        if (!line) continue;

        if (current === null) {
            const open = line.match(/^(model|enum) (\w+) \{$/);
            if (open) {
                current = `${open[1]} ${open[2]}`;
                body = [];
            }
            continue;
        }

        if (line === '}') {
            // Sorted, so cosmetic reordering inside a block is not a failure.
            blocks.set(current, body.sort());
            current = null;
            continue;
        }

        body.push(line);
    }

    return blocks;
}

describe('prisma schema parity', () => {
    const selfHosted = parseBlocks(SELF_HOSTED);
    const hosted = parseBlocks(HOSTED);

    it('declares the same models and enums in both schemas', () => {
        expect([...hosted.keys()].sort()).toEqual([...selfHosted.keys()].sort());
    });

    it('declares identical fields in every shared block', () => {
        for (const [name, fields] of selfHosted) {
            expect(hosted.get(name), `${name} differs from the hosted schema`).toEqual(fields);
        }
    });

    it('keeps the datasource providers distinct', () => {
        expect(readFileSync(SELF_HOSTED, 'utf8')).toContain('provider = "sqlite"');
        expect(readFileSync(HOSTED, 'utf8')).toContain('provider  = "postgresql"');
    });
});
