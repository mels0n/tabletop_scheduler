import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { PGlite } from '@electric-sql/pglite';
import { isVotingReminderDue, isSessionReminderDue } from '@/features/notifications/server/reminders/schedule';

/**
 * scripts/sql/pg-cron-reminders.sql gates each hosted cron call on a database check, so an
 * idle site never wakes a function. The check duplicates the routes' own selection in SQL,
 * and a check that is narrower than the route silently stops reminders. These tests run the
 * exact job commands from that file on the hosted schema (all of prisma/hosted/migrations)
 * in an in-memory Postgres, with pg_cron, pg_net and Vault stubbed, and compare the outcome
 * with the TypeScript rules: whenever the route would send, the job must call it.
 */

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, 'prisma', 'hosted', 'migrations');
const CRON_SQL = join(ROOT, 'scripts', 'sql', 'pg-cron-reminders.sql');

const STUBS = `
create schema cron;
create table cron.jobs (name text primary key, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint
language sql as $$
  insert into cron.jobs values (job_name, schedule, command)
  on conflict (name) do update set schedule = excluded.schedule, command = excluded.command;
  select 1::bigint;
$$;

create schema net;
create table net.calls (url text, auth text);
create function net.http_get(url text, headers jsonb, timeout_milliseconds integer) returns bigint
language sql as $$
  insert into net.calls values (url, headers->>'Authorization');
  select 1::bigint;
$$;

create schema vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);
insert into vault.decrypted_secrets values ('app_base_url', 'https://example.test/'), ('cron_secret', 's3cret');
`;

let db: PGlite;
let jobs: Record<string, string>;

/** Runs one job's command as if pg_cron fired it at `now`; returns the URLs it called. */
async function fire(job: string, now: Date): Promise<string[]> {
    await db.exec('truncate net.calls');
    const command = jobs[job].replaceAll('now()', `'${now.toISOString()}'::timestamptz`);
    await db.exec(command);
    const res = await db.query<{ url: string }>('select url from net.calls');
    return res.rows.map(r => r.url);
}

/** Postgres TIMESTAMP(3) literal holding UTC, as Prisma writes it. */
function ts(d: Date | null): string | null {
    return d ? d.toISOString().replace('T', ' ').replace('Z', '') : null;
}

async function insertEvent(fields: Record<string, unknown>): Promise<number> {
    const row = { slug: `e${Math.random().toString(36).slice(2)}`, title: 't', updatedAt: ts(new Date()), ...fields };
    const cols = Object.keys(row);
    const res = await db.query<{ id: number }>(
        `insert into "Event" (${cols.map(c => `"${c}"`).join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
        Object.values(row),
    );
    return res.rows[0].id;
}

async function insertSlot(eventId: number, start: Date, sentAt: Date | null = null): Promise<number> {
    const res = await db.query<{ id: number }>(
        `insert into "TimeSlot" ("eventId", "startTime", "endTime", "sessionReminderSentAt") values ($1, $2, $2, $3) returning id`,
        [eventId, ts(start), ts(sentAt)],
    );
    return res.rows[0].id;
}

beforeAll(async () => {
    db = new PGlite();
    for (const dir of readdirSync(MIGRATIONS).filter(d => !d.endsWith('.toml')).sort()) {
        await db.exec(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.exec(STUBS);
    // pg_cron and pg_net are Supabase extensions; the stubs above stand in for them.
    const sql = readFileSync(CRON_SQL, 'utf8').replace(/^create extension .*$/gm, '');
    await db.exec(sql);
    const res = await db.query<{ name: string; command: string }>('select name, command from cron.jobs');
    jobs = Object.fromEntries(res.rows.map(r => [r.name, r.command]));
}, 60_000);

beforeEach(async () => {
    await db.exec('delete from "WebhookEvent"; delete from "FinalizedSession"; delete from "TimeSlot"; delete from "Event";');
});

describe('pg-cron-reminders.sql', () => {
    it('schedules both jobs and reads the base URL and secret from Vault', async () => {
        expect(Object.keys(jobs).sort()).toEqual(['tabletop-reminders', 'tabletop-webhooks']);
        await db.exec('delete from vault.decrypted_secrets');
        await db.exec(`insert into vault.decrypted_secrets values ('app_base_url', 'https://example.test/'), ('cron_secret', 's3cret')`);
        const eventId = await insertEvent({});
        await db.query(
            `insert into "WebhookEvent" (id, "eventId", url, payload, status, attempts, "nextAttempt", "createdAt", "updatedAt")
             values ('w1', $1, 'https://hook.test', '{}', 'PENDING', 0, $2, $2, $2)`,
            [eventId, ts(new Date(Date.now() - 60_000))],
        );
        expect(await fire('tabletop-webhooks', new Date())).toEqual(['https://example.test/api/cron/webhooks']);
        const auth = await db.query<{ auth: string }>('select auth from net.calls');
        expect(auth.rows[0].auth).toBe('Bearer s3cret');
    });

    describe('tabletop-webhooks', () => {
        const now = new Date('2026-10-12T12:00:00Z');
        const cases: Array<[string, string, Date, Date | null, boolean]> = [
            ['pending and due', 'PENDING', new Date(now.getTime() - 1000), null, true],
            ['retry and due', 'RETRY', new Date(now.getTime() - 1000), null, true],
            ['not due yet', 'RETRY', new Date(now.getTime() + 60_000), null, false],
            ['delivered', 'DELIVERED', new Date(now.getTime() - 1000), null, false],
            ['failed', 'FAILED', new Date(now.getTime() - 1000), null, false],
            ['locked by a live run', 'PENDING', new Date(now.getTime() - 1000), new Date(now.getTime() - 60_000), false],
            ['stale lock', 'PENDING', new Date(now.getTime() - 1000), new Date(now.getTime() - 11 * 60_000), true],
        ];
        for (const [name, status, nextAttempt, lockedAt, calls] of cases) {
            it(`${calls ? 'calls' : 'skips'}: ${name}`, async () => {
                const eventId = await insertEvent({});
                await db.query(
                    `insert into "WebhookEvent" (id, "eventId", url, payload, status, attempts, "nextAttempt", "lockedAt", "createdAt", "updatedAt")
                     values ('w1', $1, 'https://hook.test', '{}', $2, 0, $3, $4, $5, $5)`,
                    [eventId, status, ts(nextAttempt), ts(lockedAt), ts(now)],
                );
                expect((await fire('tabletop-webhooks', now)).length).toBe(calls ? 1 : 0);
            });
        }

        it('skips when the outbox is empty', async () => {
            expect(await fire('tabletop-webhooks', now)).toEqual([]);
        });
    });

    describe('tabletop-reminders: session reminders', () => {
        const now = new Date('2026-10-12T12:00:00Z');
        const base = { status: 'FINALIZED', sessionReminderEnabled: true, sessionReminderLeadMinutes: 120, telegramChatId: '-100' };

        it('calls for the finalized slot inside its lead window', async () => {
            const id = await insertEvent(base);
            const slot = await insertSlot(id, new Date(now.getTime() + 60 * 60_000));
            await db.query('update "Event" set "finalizedSlotId" = $1 where id = $2', [slot, id]);
            expect((await fire('tabletop-reminders', now)).length).toBe(1);
        });

        it('calls for a campaign session inside its lead window', async () => {
            const id = await insertEvent({ ...base, eventType: 'CAMPAIGN' });
            const slot = await insertSlot(id, new Date(now.getTime() + 60 * 60_000));
            await db.query(`insert into "FinalizedSession" ("eventId", "timeSlotId") values ($1, $2)`, [id, slot]);
            expect((await fire('tabletop-reminders', now)).length).toBe(1);
        });

        it('skips a slot that was not scheduled', async () => {
            const id = await insertEvent(base);
            await insertSlot(id, new Date(now.getTime() + 60 * 60_000));
            expect(await fire('tabletop-reminders', now)).toEqual([]);
        });

        it('skips a slot already reminded, outside the window, or with no channel', async () => {
            const sent = await insertEvent(base);
            const s1 = await insertSlot(sent, new Date(now.getTime() + 60 * 60_000), now);
            await db.query('update "Event" set "finalizedSlotId" = $1 where id = $2', [s1, sent]);

            const early = await insertEvent(base);
            const s2 = await insertSlot(early, new Date(now.getTime() + 3 * 60 * 60_000));
            await db.query('update "Event" set "finalizedSlotId" = $1 where id = $2', [s2, early]);

            const noChannel = await insertEvent({ ...base, telegramChatId: null });
            const s3 = await insertSlot(noChannel, new Date(now.getTime() + 60 * 60_000));
            await db.query('update "Event" set "finalizedSlotId" = $1 where id = $2', [s3, noChannel]);

            expect(await fire('tabletop-reminders', now)).toEqual([]);
        });
    });

    describe('tabletop-reminders: voting reminders', () => {
        const open = { status: 'DRAFT', reminderEnabled: true, reminderTime: '18:00', reminderDays: '0,1,2,3,4,5,6', timezone: 'America/Chicago', telegramChatId: '-100' };
        // 2026-10-12 is a Monday; 18:00 CDT is 23:00 UTC.
        const target = new Date('2026-10-12T23:00:00Z');

        async function votingEvent(fields: Record<string, unknown> = {}) {
            const id = await insertEvent({ ...open, ...fields });
            await insertSlot(id, new Date('2027-06-01T00:00:00Z'));
            return id;
        }

        it('calls once the target has passed and nothing was sent', async () => {
            await votingEvent();
            expect((await fire('tabletop-reminders', new Date(target.getTime() + 5 * 60_000))).length).toBe(1);
        });

        it('skips after the reminder went out', async () => {
            await votingEvent({ lastReminderSent: ts(new Date(target.getTime() + 2 * 60 * 60_000)) });
            expect(await fire('tabletop-reminders', new Date(target.getTime() + 3 * 60 * 60_000))).toEqual([]);
        });

        it('skips on a day that is not a reminder day', async () => {
            await votingEvent({ reminderDays: '2' });
            expect(await fire('tabletop-reminders', new Date(target.getTime() + 5 * 60_000))).toEqual([]);
        });

        it('skips once quorum is reached, and when no slot is still ahead', async () => {
            await votingEvent({ quorumReachedAt: ts(target) });
            const past = await insertEvent(open);
            await insertSlot(past, new Date('2026-10-01T00:00:00Z'));
            expect(await fire('tabletop-reminders', new Date(target.getTime() + 5 * 60_000))).toEqual([]);
        });

        it('calls for an event whose timezone Postgres does not know', async () => {
            await votingEvent({ timezone: 'Not/AZone', lastReminderSent: ts(target) });
            expect((await fire('tabletop-reminders', new Date(target.getTime() + 60_000))).length).toBe(1);
        });

        it('calls when the check itself errors', async () => {
            await votingEvent({ reminderTime: '99999999999:00' });
            expect((await fire('tabletop-reminders', target)).length).toBe(1);
        });

        it('skips when there is nothing at all', async () => {
            expect(await fire('tabletop-reminders', target)).toEqual([]);
        });

        // The property that matters: wherever the TypeScript rule says a reminder is due, the
        // job calls the route. Random schedules across DST zones and transition dates.
        it('never skips a reminder the route would send', async () => {
            const zones = ['America/Chicago', 'America/New_York', 'Europe/London', 'Australia/Sydney', 'Australia/Lord_Howe', 'Asia/Kolkata', 'Pacific/Chatham', 'America/St_Johns', 'UTC'];
            const anchors = ['2026-03-08T07:00:00Z', '2026-03-29T01:00:00Z', '2026-04-05T15:00:00Z', '2026-10-04T15:00:00Z', '2026-10-25T01:00:00Z', '2026-11-01T06:00:00Z', '2026-07-15T12:00:00Z'];
            let seed = 42;
            const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
            const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

            let due = 0;
            let extra = 0;
            for (let i = 0; i < 400; i++) {
                await db.exec('delete from "TimeSlot"; delete from "Event";');
                const timezone = pick(zones);
                const h = Math.floor(rand() * 24);
                const m = pick([0, 15, 30, 45, 59]);
                const reminderTime = rand() < 0.2
                    ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
                    : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                const reminderDays = [0, 1, 2, 3, 4, 5, 6].filter(() => rand() < 0.5).join(',') || '3';
                const now = new Date(Date.parse(pick(anchors)) + Math.floor((rand() - 0.5) * 3 * 86_400_000));
                const lastReminderSent = rand() < 0.3 ? null : new Date(now.getTime() - Math.floor(rand() * 40 * 3_600_000));

                const schedule = { reminderTime, reminderDays, timezone, lastReminderSent };
                await votingEvent({ timezone, reminderTime, reminderDays, lastReminderSent: ts(lastReminderSent) });
                const called = (await fire('tabletop-reminders', now)).length === 1;
                const expected = isVotingReminderDue(schedule, now);

                if (expected) {
                    due++;
                    expect(called, JSON.stringify({ ...schedule, now })).toBe(true);
                } else if (called) {
                    extra++;
                }
            }
            // The check is allowed to be loose, not useless: most not-due cases must skip.
            expect(due).toBeGreaterThan(20);
            expect(extra).toBeLessThan((400 - due) / 4);
        }, 120_000);

        it('matches isSessionReminderDue at the window edges', async () => {
            const now = new Date('2026-10-12T12:00:00Z');
            for (const [offsetMin, lead] of [[120, 120], [121, 120], [1, 120], [0, 120], [1440, 1440], [1441, 1440]] as const) {
                await db.exec('delete from "TimeSlot"; delete from "Event";');
                const id = await insertEvent({ status: 'FINALIZED', sessionReminderEnabled: true, sessionReminderLeadMinutes: lead, telegramChatId: '-100' });
                const start = new Date(now.getTime() + offsetMin * 60_000);
                const slot = await insertSlot(id, start);
                await db.query('update "Event" set "finalizedSlotId" = $1 where id = $2', [slot, id]);
                const called = (await fire('tabletop-reminders', now)).length === 1;
                expect(called, `${offsetMin} min ahead, lead ${lead}`).toBe(isSessionReminderDue(start, lead, now));
            }
        });
    });
});
