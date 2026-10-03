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

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'tabletop-reminders',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url') || '/api/cron/reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 55000
  )
  $$
);

select cron.schedule(
  'tabletop-webhooks',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url') || '/api/cron/webhooks',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 55000
  )
  $$
);
