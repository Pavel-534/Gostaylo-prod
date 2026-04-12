-- Chat safety trigger flag for anti-disintermediation UX.
-- Safe to re-run.

alter table if exists public.messages
  add column if not exists has_safety_trigger boolean not null default false;

create index if not exists idx_messages_has_safety_trigger
  on public.messages (has_safety_trigger);

