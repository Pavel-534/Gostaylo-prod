-- Stage 77.9 — Global anti-spam guard for Telegram system alerts.
-- Policy: by default, only one system alert per UTC day.

create table if not exists public.system_alert_daily_guard (
  id uuid primary key default gen_random_uuid(),
  alert_day_utc date not null unique,
  sent_count integer not null default 0,
  suppressed_count integer not null default 0,
  first_sent_at timestamptz,
  last_seen_at timestamptz not null default now(),
  last_message_preview text
);

create index if not exists idx_system_alert_daily_guard_day
  on public.system_alert_daily_guard (alert_day_utc desc);

comment on table public.system_alert_daily_guard is
  'Daily guard for system Telegram alerts to prevent notification storms.';
