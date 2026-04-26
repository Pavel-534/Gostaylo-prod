-- Stage 56.0 — async notification pipeline (enqueue; worker/cron TBD).
-- Optional JSON keys on bookings.pricing_snapshot: tax_rate, tax_amount_thb (see TECHNICAL_MANIFESTO / passport).

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_outbox_status_chk CHECK (status IN ('pending', 'processing', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status_created
  ON public.notification_outbox (status, created_at DESC);

COMMENT ON TABLE public.notification_outbox IS 'Stage 56.0 — queued notification events when NOTIFICATION_OUTBOX=1; otherwise handlers run synchronously.';
