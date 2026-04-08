-- Heartbeat for Smart Push: web «активен» если last_seen_at не старше ~1 мин.
alter table public.user_push_tokens
  add column if not exists last_seen_at timestamptz;

update public.user_push_tokens
set last_seen_at = coalesce(last_seen_at, created_at, now())
where last_seen_at is null;

comment on column public.user_push_tokens.last_seen_at is
  'Updated on register/ping from web client; used to skip redundant push when tab is active.';
