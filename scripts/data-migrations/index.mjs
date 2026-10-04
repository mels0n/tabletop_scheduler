// ==============================================================================
// Data migrations: backfills and data fixes that a schema change cannot express.
//
// Schema changes go in prisma/schema.prisma (self-host, applied by `db push`) and
// prisma/hosted (Postgres migrations). When a release also needs existing ROWS
// rewritten, for example filling a new column from an old one, add an entry here.
// scripts/run-data-migrations.mjs runs every pending entry after the schema is
// applied: on every self-host container start (start.sh) and on every hosted
// production build (scripts/vercel-build.sh).
//
// Shape of an entry:
//
//   {
//     id: '2026-10-15-backfill-amount-cents', // unique, never reused or renamed
//     description: 'Fill Donation.amountCents from Donation.amount',
//     up: async (prisma) => { ... },           // prisma = the transaction client
//   }
//
// Rules:
// - Append only, in the order they must run. Never edit or remove an entry that
//   has shipped; an id that has run is recorded in AppMigration and never runs again.
// - `up` runs inside one transaction together with the AppMigration insert, so
//   it either fully applies and is recorded, or rolls back and runs again next start.
// - Use the Prisma client API only (no raw SQL): the same entry runs on SQLite
//   (self-host) and Postgres (hosted).
// - Write `up` so it is safe on rows that already have the new value, and on a
//   database created after the column existed (a fresh install runs it too).
// - Import nothing but node builtins and @prisma/client: only this folder and the
//   runner ship in the Docker image, not the app source.
//
// See prisma/compat/README.md and CONTRIBUTING.md ("Database change rules").
// ==============================================================================

/**
 * @typedef {object} DataMigration
 * @property {string} id Stable unique id, recorded in AppMigration once applied.
 * @property {string} description One line saying what the migration changes.
 * @property {(prisma: import('@prisma/client').Prisma.TransactionClient) => Promise<void>} up
 */

/** @type {DataMigration[]} */
export const dataMigrations = [
    {
        id: '2026-10-03-backfill-quorum-reached-at',
        description: 'Set Event.quorumReachedAt where a quorum flag was already set',
        up: async (prisma) => {
            await prisma.event.updateMany({
                where: {
                    quorumReachedAt: null,
                    OR: [{ quorumViableNotified: true }, { quorumPerfectNotified: true }],
                },
                data: { quorumReachedAt: new Date() },
            });
        },
    },
];

export default dataMigrations;
