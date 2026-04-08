-- Operational log for autonomous cron jobs (No-Ops traceability).

create table if not exists public.ops_job_runs (
  id bigserial primary key,
  job_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error_message text
);

create index if not exists idx_ops_job_runs_job_started
  on public.ops_job_runs (job_name, started_at desc);

create index if not exists idx_ops_job_runs_started
  on public.ops_job_runs (started_at desc);

comment on table public.ops_job_runs is
  'Operational execution log for cron and background jobs (duration, stats, errors).';
