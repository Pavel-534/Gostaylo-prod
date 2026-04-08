-- События для nightly-отчётов и аудита (каждая попытка PRICE_TAMPERING и т.п.).

create table if not exists public.critical_signal_events (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null,
  created_at timestamptz not null default now(),
  detail jsonb
);

create index if not exists idx_critical_signal_events_key_created
  on public.critical_signal_events (signal_key, created_at desc);

comment on table public.critical_signal_events is
  'Append-only security/integrity signals; queried by scripts/send-e2e-report.mjs (24h window).';
