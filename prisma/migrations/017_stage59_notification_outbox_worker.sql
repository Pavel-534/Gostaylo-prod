-- Stage 59.0 — outbox worker: backoff + terminal status.

ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_status_chk;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_status_chk
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'permanent_failure'));

CREATE INDEX IF NOT EXISTS idx_notification_outbox_next_attempt
  ON public.notification_outbox (next_attempt_at NULLS FIRST, created_at ASC);

COMMENT ON COLUMN public.notification_outbox.next_attempt_at IS 'Stage 59.0 — earliest time worker may retry (null = eligible immediately).';
