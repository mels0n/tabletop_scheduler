-- Schedules the hosted reminder and webhook cron endpoints from inside Supabase.
--
-- Run once per environment in the Supabase SQL editor, after storing two Vault secrets:
--   select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');
--   select vault.create_secret('https://tabletoptime.us', 'app_base_url');
-- See docs/guides/HostedMaintenance.md, "Scheduling reminders with pg_cron".
--
-- Re-runnable: cron.schedule() with an existing job name replaces that job's schedule
-- and command (pg_cron 1.3+, which Supabase ships), so running this file again updates
-- the jobs in place instead of duplicating them.
--
-- The secrets are read from vault.decrypted_secrets on every run, so rotating CRON_SECRET
-- with vault.update_secret takes effect without rescheduling.
--
-- Both routes export GET only, hence net.http_get. The timeout is raised from pg_net's
-- default so a slow run is recorded with its real status instead of a client timeout.
--
-- Pre-check: each job first asks the database whether the route has anything to do and
-- only calls it when the answer is yes, so an idle site does not wake a serverless
-- function every few minutes. The check is a superset of the route's own selection: it
-- may call when nothing ends up sending, it must never skip a run that would have sent.
-- The route still makes every real decision and claims each row before sending.
-- Any error in a check (an unexpected value, a renamed column) calls the route anyway.
-- The checks mirror features/notifications/server/reminders (voting.ts, session.ts,
-- schedule.ts) and features/integrations/webhooks/server/process.ts (claimableWhere);
-- tests/pg-cron-precheck.test.ts runs this file against the hosted schema and fails
-- when the two drift. Columns are TIMESTAMP(3) holding UTC, so "now" is
-- now() at time zone 'utc'.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
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
        -- and nothing sent since. The target instant is widened by an hour each way so a
        -- DST transition can only make this call early, never skip.
        or exists (
          select 1
          from (
            select
              e."lastReminderSent" as last_sent,
              e."reminderDays" as days,
              z.known,
              z.tz,
              (now() at time zone z.tz) as local_now,
              nullif(regexp_replace(split_part(e."reminderTime", ':', 1), '\D', '', 'g'), '')::int as h,
              nullif(regexp_replace(split_part(e."reminderTime", ':', 2), '\D', '', 'g'), '')::int as m,
              lower(e."reminderTime") as rt
            from "Event" e
            cross join lateral (
              -- A zone Postgres does not know cannot be checked here, so it always calls.
              select
                coalesce(k.known, false) as known,
                case when k.known then e.timezone else 'UTC' end as tz
              from (select exists (select 1 from pg_timezone_names n where n.name = e.timezone) as known) k
            ) z
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
            and utc_now >= u.target_utc - interval '1 hour'
            and utc_now < u.target_utc + interval '19 hours'
            and (v.last_sent is null or v.last_sent < u.target_utc + interval '1 hour')
            )
        )
      into due;
    exception when others then
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

select cron.schedule(
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
    exception when others then
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
