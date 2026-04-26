-- Stage 57.0 — outbox retry metadata (worker-ready; tax-agnostic).

ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;

COMMENT ON COLUMN public.notification_outbox.attempts IS 'Delivery attempt count for worker retries.';
COMMENT ON COLUMN public.notification_outbox.last_error IS 'Last handler/transport error message (truncated by worker if needed).';
