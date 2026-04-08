-- Очередь отложенных chat push (45 с): склейка нескольких сообщений от одного sender_id к одному recipient_id.
-- После отправки строка удаляется (PK снова свободен).

create table if not exists public.chat_push_delivery_batch (
  recipient_id text not null references public.profiles(id) on delete cascade,
  sender_id text not null,
  conversation_id text not null,
  sender_display_name text,
  message_ids text[] not null default '{}',
  pending_tokens text[] not null default '{}',
  window_deadline_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (recipient_id, sender_id)
);

create index if not exists idx_chat_push_batch_deadline
  on public.chat_push_delivery_batch (window_deadline_at);

comment on table public.chat_push_delivery_batch is
  'Anti-spam batching for delayed NEW_MESSAGE FCM; one row per (recipient, sender) until flushed.';
