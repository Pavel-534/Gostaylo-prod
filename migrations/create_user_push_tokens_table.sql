-- Multi-device web push tokens (FCM)
-- В FannRent / ряде окружений public.profiles.id имеет тип TEXT, не UUID.
-- user_id должен совпадать с типом profiles.id, иначе FK не создаётся (ERROR 42804).

create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  token text not null unique,
  device_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_push_tokens_user_id
  on public.user_push_tokens(user_id);
