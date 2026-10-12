# ADR 0004: Gate the hosted cron jobs in the database

- Status: Accepted
- Date: 2026-10-12

## Context

On the hosted deployment, Supabase `pg_cron` calls two cron routes through `pg_net`: `/api/cron/webhooks` every 5 minutes and `/api/cron/reminders` every 10 minutes. That is about 430 calls a day whatever the traffic, and most of them find nothing to do. Each call wakes a Vercel function, often from cold, and boots Next.js and Prisma before the route can discover there is no work. On the Hobby plan that idle work was the largest share of the project's Active CPU.

The jobs were scheduled by a SQL script pasted into the Supabase SQL editor by hand, so any change to them was a manual step that a deploy did not carry.

## Decision

Each `pg_cron` job checks the database before calling its route, and calls only when there is something to do:

- webhooks: a row the route could claim (`claimableWhere` in `features/integrations/webhooks/server/process.ts`);
- session reminders: a scheduled slot inside its lead window that has not been reminded;
- voting reminders: an open event whose reminder target (its reminder time on a reminder day, in the event's time zone) has passed within the catch-up window, with nothing sent since.

The check is a deliberate superset of the route's own selection. It may call when nothing ends up sending, and it must never skip a run that would have sent. The voting target is widened by two hours each way to cover daylight saving transitions, a time zone Postgres does not recognise always calls, and any error in the check, a statement timeout included, logs a warning and calls. The route still makes every real decision and claims each row before sending, so an extra call costs CPU and nothing else.

The jobs are scheduled by a hosted Prisma migration (`prisma/hosted/migrations/20261012120000_pg_cron_precheck`), applied by `prisma migrate deploy` in the production build. Without `pg_cron` and `pg_net` it does nothing but warn, and a role that may not schedule jobs gets a warning and the existing jobs are left running.

`tests/pg-cron-precheck.test.ts` applies every hosted migration to an in-memory Postgres (PGlite) with `pg_cron`, `pg_net` and Vault stubbed, runs the scheduled job commands, and compares them with the TypeScript rules: a property test over random schedules, time zones and DST dates for voting reminders, every lead time for session reminders, and the copied constants (`LOCK_TTL_MS`, `VOTING_CATCHUP_MS`, the claimable statuses, the channel columns).

## Alternatives rejected

- **Return early inside the route.** The route already returns quickly when there is no work. The cost is waking the function and booting the framework, which happens before any route code runs.
- **Call less often.** Slowing the jobs down delays every reminder and webhook retry for everyone, while most of the saving comes from the many runs that have nothing to do.
- **Vercel Cron.** The Hobby plan runs a cron at most once a day, which is far too coarse for reminders.
- **An exact copy of the rules in SQL.** Matching the TypeScript scheduling rules exactly, daylight saving resolution included, would make the two drift dangerously: a check narrower than the route silently drops reminders. A loose superset that fails toward calling has no such failure mode.
- **Keep the hand-run script.** A change to the jobs would depend on someone remembering to paste SQL into the dashboard, and a deploy would not carry it.

## Consequences

- An idle site makes almost no calls to Vercel; calls follow real work.
- The selection rules now live in two places. The TypeScript is the source of truth, and the comments at `claimableWhere`, `LOCK_TTL_MS`, `VOTING_CATCHUP_MS` and the reminder queries point to the migration. A change that makes more rows or reminders due needs a new migration that schedules the jobs again, and the test fails until one exists.
- A migration is immutable once applied, so every change to a job is a new migration rather than an edit.
- A failing check keeps working but loses the saving. It shows up as warnings in the Postgres logs and as a call on every run in `net._http_response`.
- Events with a dead chat or channel can still wake the route during their reminder window, because only the running app knows a channel is dead. This costs calls, never a reminder.
