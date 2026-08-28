/**
 * Author a new migration for the HOSTED (Postgres) target.
 *
 * usage:
 *   node scripts/db-hosted-migration.mjs --dry-run          # print the pending SQL
 *   node scripts/db-hosted-migration.mjs add_foo_column     # write it as a migration
 *
 * Why diff against the live database instead of `--from-migrations`?
 * `migrate diff --from-migrations` needs a shadow database to replay history
 * into, and Supabase does not hand one out. Diffing from the live DB gives the
 * same answer as long as production actually matches the migration history --
 * which is what the db-drift workflow verifies on every push. If that gate is
 * green, prod state IS the history's end state.
 *
 * Requires DIRECT_URL (port 5432). The pooled connection cannot run DDL.
 */
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';

const SCHEMA = 'prisma/hosted/schema.prisma';
const MIGRATIONS_DIR = 'prisma/hosted/migrations';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const name = args.find((a) => !a.startsWith('--'));

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
    console.error('❌ DIRECT_URL (or DATABASE_URL) must be set to the production direct connection (port 5432).');
    process.exit(1);
}
if (!dryRun && !name) {
    console.error('❌ Migration name required.  e.g. node scripts/db-hosted-migration.mjs add_login_token_telegram_username');
    process.exit(1);
}
if (name && !/^[a-z0-9_]+$/.test(name)) {
    console.error('❌ Migration name must be lowercase letters, digits and underscores only.');
    process.exit(1);
}

// Invoke the Prisma CLI entrypoint directly with node rather than going through
// `npx`. npx resolves to npx.cmd on Windows, which needs shell:true, and cmd then
// splits the connection string on characters like & -- silently mangling the
// arguments instead of failing cleanly. Spawning node with an argv array passes
// every character through untouched on all platforms.
const PRISMA_BIN = join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
if (!existsSync(PRISMA_BIN)) {
    console.error('❌ Prisma CLI not found at ' + PRISMA_BIN + '. Run npm install first.');
    process.exit(1);
}

let sql;
try {
    sql = execFileSync(
        process.execPath,
        [PRISMA_BIN, 'migrate', 'diff', '--from-url', url, '--to-schema-datamodel', SCHEMA, '--script'],
        { encoding: 'utf8' }
    );
} catch (e) {
    console.error('❌ prisma migrate diff failed:\n' + (e.stderr || e.message));
    process.exit(1);
}

// Prisma emits a comment-only script when there is nothing to do.
const hasStatements = sql
    .split('\n')
    .some((line) => line.trim() && !line.trim().startsWith('--'));

if (!hasStatements) {
    console.log('✅ No drift. Production already matches ' + SCHEMA + '.');
    process.exit(0);
}

if (dryRun) {
    console.log(sql);
    process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const dir = join(MIGRATIONS_DIR, `${stamp}_${name}`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'migration.sql'), sql, 'utf8');

console.log(`✅ Wrote ${join(dir, 'migration.sql')}`);
console.log('   Review the SQL, commit it, and it applies on the next production deploy.');
