-- ============================================================
-- 050: Instant queue alerts via pg_net webhook
-- When a long/very_long queue report is inserted, fire an HTTP
-- POST to the Vercel webhook that sends Expo push instantly.
-- Replaces 5-minute cron delay with < 1 second latency.
-- ============================================================

-- Enable pg_net extension (available on all Supabase tiers)
create extension if not exists pg_net with schema extensions;

-- Trigger function: fires on queue_reports INSERT
-- Only calls webhook for long/very_long queues
create or replace function public.notify_queue_spike()
returns trigger
language plpgsql
security definer
as $$
declare
  webhook_url text := 'https://www.troski.me/api/webhooks/queue-alert';
  webhook_secret text;
begin
  -- Only fire for concerning queue levels
  if NEW.queue_status not in ('long', 'very_long') then
    return NEW;
  end if;

  -- Get the webhook secret from vault or hardcode for now
  webhook_secret := current_setting('app.settings.cron_secret', true);

  -- Fire async HTTP POST via pg_net (non-blocking, doesn't slow down INSERT)
  perform extensions.http_post(
    url := webhook_url,
    body := jsonb_build_object(
      'station_name', NEW.station_name,
      'queue_status', NEW.queue_status,
      'reported_at', NEW.reported_at
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(webhook_secret, '')
    )::jsonb
  );

  return NEW;
end;
$$;

-- Create the trigger
drop trigger if exists queue_spike_webhook on public.queue_reports;
create trigger queue_spike_webhook
  after insert on public.queue_reports
  for each row
  execute function public.notify_queue_spike();
