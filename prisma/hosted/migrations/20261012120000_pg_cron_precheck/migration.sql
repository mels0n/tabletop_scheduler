-- Schedules the hosted reminder and webhook cron jobs in Supabase pg_cron, each gated
-- on a database check so an idle site does not wake a Vercel function every few minutes.
-- Why it is built this way: docs/adr/0004-gated-pg-cron-jobs.md.
--
-- Each job first asks the database whether its route has anything to do and only calls
-- it when the answer is yes. The check is a superset of the route's own selection: it
-- may call when nothing ends up sending, it must never skip a run that would have sent.
-- The route still makes every real decision and claims each row before sending. Any
-- error in a check (an unexpected value, a renamed column, a statement timeout) logs a
-- warning and calls the route anyway.
-- The checks mirror features/notifications/server/reminders (voting.ts, session.ts,
-- schedule.ts) and features/integrations/webhooks/server/process.ts (claimableWhere);
-- tests/pg-cron-precheck.test.ts runs this migration and fails when they drift.
-- Columns are TIMESTAMP(3) holding UTC, so "now" is now() at time zone 'utc'.
--
-- The jobs read two Vault secrets on every run (cron_secret, app_base_url), so rotating
-- CRON_SECRET with vault.update_secret takes effect without rescheduling. See
-- docs/guides/HostedMaintenance.md, "Scheduling reminders with pg_cron".
--
-- cron.schedule() with an existing job name replaces that job in place, so this updates
-- jobs scheduled by an earlier version instead of duplicating them. To change a job
-- later, add a new migration that schedules it again.
--
-- Without pg_cron and pg_net (plain Postgres: CI's migration check, a hosted install
-- outside Supabase) this does nothing but warn. Enabling them later does not re-run a
-- migration; run this file once in the SQL editor in that case. The same applies if the
-- deploy role is not allowed to manage pg_cron: the migration warns and leaves the old
-- jobs running.

do $migration$
begin
  -- A catalog lookup, not to_regproc: cron.schedule is overloaded, and to_regproc returns
  -- null for an ambiguous name.
  if not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'cron' and p.proname = 'schedule'
     )
     or not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'net' and p.proname = 'http_get'
     )
  then
    raise warning 'pg_cron or pg_net is not installed; the reminder and webhook jobs were not scheduled';
    return;
  end if;

  perform cron.schedule(
    'tabletop-reminders',
    '*/10 * * * *',
    $job$
    do $do$
    declare
      utc_now timestamp := now() at time zone 'utc';
      due boolean;
    begin
      begin
        select
          -- Session reminders (session.ts): a scheduled slot inside its lead window, not yet sent.
          exists (
            select 1
            from "Event" e
            join "TimeSlot" s on s."eventId" = e.id
            where e.status = 'FINALIZED'
              and e."sessionReminderEnabled"
              and e."sessionReminderLeadMinutes" > 0
              and (e."telegramChatId" is not null or e."discordChannelId" is not null)
              and s."sessionReminderSentAt" is null
              and s."startTime" > utc_now
              and s."startTime" - make_interval(mins => e."sessionReminderLeadMinutes") <= utc_now
              and (
                s.id = e."finalizedSlotId"
                or exists (select 1 from "FinalizedSession" f where f."timeSlotId" = s.id)
              )
          )
          -- Voting reminders (voting.ts + schedule.ts): today's (or, before reminderTime,
          -- yesterday's) target on a reminder day, still inside the 18 hour catch-up window,
          -- and nothing sent since. The target instant is widened by two hours each way, the
          -- largest daylight saving shift in use, so a DST transition can only make this
          -- call early, never skip.
          or exists (
            -- Zone names once per run (the function reads the time zone database), matched
            -- without regard to case because Intl accepts any case.
            with zones as materialized (
              select distinct on (lower(name)) name, lower(name) as lname
              from pg_timezone_names
              order by lower(name), name
            )
            select 1
            from (
              select
                e."lastReminderSent" as last_sent,
                e."reminderDays" as days,
                z.name is not null as known,
                coalesce(z.name, 'UTC') as tz,
                (now() at time zone coalesce(z.name, 'UTC')) as local_now,
                nullif(regexp_replace(split_part(e."reminderTime", ':', 1), '\D', '', 'g'), '')::int as h,
                nullif(regexp_replace(split_part(e."reminderTime", ':', 2), '\D', '', 'g'), '')::int as m,
                lower(e."reminderTime") as rt
              from "Event" e
              -- A zone Postgres does not know cannot be checked here, so it always calls.
              left join zones z on z.lname = lower(e.timezone)
              where e.status in ('ACTIVE', 'DRAFT')
                and e."reminderEnabled"
                and e."quorumReachedAt" is null
                and e."reminderTime" is not null
                and e."reminderDays" is not null
                and (e."telegramChatId" is not null or e."discordChannelId" is not null)
                and exists (select 1 from "TimeSlot" s where s."eventId" = e.id and s."startTime" > utc_now)
            ) v
            cross join lateral (
              select
                case
                  when v.rt like '%pm%' and v.h < 12 then v.h + 12
                  when v.rt like '%am%' and v.h = 12 then 0
                  else v.h
                end as hour24
            ) p
            cross join lateral (
              -- The target in local wall time: today at reminderTime, or yesterday when
              -- reminderTime has not come round yet today.
              select
                date_trunc('day', v.local_now) + make_interval(hours => p.hour24, mins => v.m)
                  - case
                      when date_trunc('day', v.local_now) + make_interval(hours => p.hour24, mins => v.m) > v.local_now
                      then interval '1 day'
                      else interval '0'
                    end as target_local
            ) t
            cross join lateral (
              select (t.target_local at time zone v.tz) at time zone 'utc' as target_utc
            ) u
            where not v.known
              or (
                v.h is not null
                and v.m is not null
                and extract(dow from t.target_local)::int in (
                  select substring(d from '^\s*([+-]?\d+)')::int
                  from unnest(string_to_array(v.days, ',')) as d
                  where d ~ '^\s*[+-]?\d'
                )
                and utc_now >= u.target_utc - interval '2 hours'
                -- VOTING_CATCHUP_MS (18 hours) plus the two hour margin.
                and utc_now < u.target_utc + interval '20 hours'
                and (v.last_sent is null or v.last_sent < u.target_utc + interval '2 hours')
              )
          )
        into due;
      -- OTHERS does not include QUERY_CANCELED, which a statement timeout raises.
      exception when others or query_canceled then
        raise warning 'tabletop-reminders pre-check failed, calling the route anyway: %', sqlerrm;
        due := true;
      end;

      if due then
        perform net.http_get(
          url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url'), '/') || '/api/cron/reminders',
          headers := jsonb_build_object(
            'Authorization',
            'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
          ),
          timeout_milliseconds := 55000
        );
      end if;
    end
    $do$;
    $job$
  );

  perform cron.schedule(
    'tabletop-webhooks',
    '*/5 * * * *',
    $job$
    do $do$
    declare
      utc_now timestamp := now() at time zone 'utc';
      due boolean;
    begin
      begin
        -- claimableWhere (process.ts): due, and not locked by a run younger than LOCK_TTL_MS.
        select exists (
          select 1
          from "WebhookEvent" w
          where w.status in ('PENDING', 'RETRY')
            and w."nextAttempt" <= utc_now
            and (w."lockedAt" is null or w."lockedAt" < utc_now - interval '10 minutes')
        )
        into due;
      -- OTHERS does not include QUERY_CANCELED, which a statement timeout raises.
      exception when others or query_canceled then
        raise warning 'tabletop-webhooks pre-check failed, calling the route anyway: %', sqlerrm;
        due := true;
      end;

      if due then
        perform net.http_get(
          url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url'), '/') || '/api/cron/webhooks',
          headers := jsonb_build_object(
            'Authorization',
            'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
          ),
          timeout_milliseconds := 55000
        );
      end if;
    end
    $do$;
    $job$
  );
-- A role that may not manage pg_cron must not fail the deploy: the jobs scheduled earlier
-- keep running ungated, which is how they ran before this migration.
exception when insufficient_privilege then
  raise warning 'not allowed to schedule pg_cron jobs as %; the existing jobs were left unchanged', current_user;
end
$migration$;
