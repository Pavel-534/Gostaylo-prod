-- Персональный тихий час для push-уведомлений.
-- quiet_mode_enabled=false → используется платформенный fallback 22:00-08:00 по TZ устройства.

alter table if exists public.profiles
  add column if not exists quiet_hour_start time without time zone not null default time '22:00',
  add column if not exists quiet_hour_end time without time zone not null default time '08:00',
  add column if not exists quiet_mode_enabled boolean not null default false;

comment on column public.profiles.quiet_hour_start is
  'User-defined local quiet-hour start for push notifications (HH:MM, device timezone).';
comment on column public.profiles.quiet_hour_end is
  'User-defined local quiet-hour end for push notifications (HH:MM, device timezone).';
comment on column public.profiles.quiet_mode_enabled is
  'If true, PushService uses profile quiet_hour_start/end; otherwise fallback 22:00-08:00.';
