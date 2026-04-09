-- Persisted last-seen timestamp for messenger-grade presence UX.

alter table if exists public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists idx_profiles_last_seen_at
  on public.profiles (last_seen_at desc);

comment on column public.profiles.last_seen_at is
  'Last known online timestamp (updated on app hide/unload via /api/v2/presence/last-seen).';
