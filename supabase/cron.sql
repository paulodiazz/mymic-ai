-- Supabase cron job: call the app auto-post endpoint every 5 minutes.
-- Update the secrets below once, then schedule the job.

-- Ensure extensions are available (Supabase supports these on hosted projects).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Store secrets in Vault (run once, update as needed).
-- Replace APP_URL with your production URL (e.g. https://mymic-agent.vercel.app).
-- Replace CRON_SECRET with the same value used in your app env.
select vault.create_secret('APP_URL', 'app_url');
select vault.create_secret('CRON_SECRET', 'cron_secret');

-- If you need to update secrets later, run:
-- select vault.update_secret('app_url', 'NEW_APP_URL');
-- select vault.update_secret('cron_secret', 'NEW_CRON_SECRET');

-- Schedule the job (every 5 minutes).
select
  cron.schedule(
    'mymic-auto-post-5min',
    '*/5 * * * *',
    $$
    select
      net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/auto-post',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
        ),
        body := '{"source":"supabase-cron"}'::jsonb
      ) as request_id;
    $$
  );

-- To remove the job:
-- select cron.unschedule('mymic-auto-post-5min');
