-- Stage 60.0 — reclaim stale `processing` rows via `updated_at` (shared trigger SSOT with other tables).

ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.notification_outbox
  SET updated_at = created_at;

DROP TRIGGER IF EXISTS trigger_notification_outbox_updated_at ON public.notification_outbox;
CREATE TRIGGER trigger_notification_outbox_updated_at
  BEFORE UPDATE ON public.notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_notification_outbox_processing_updated
  ON public.notification_outbox (updated_at ASC)
  WHERE (status = 'processing');

COMMENT ON COLUMN public.notification_outbox.updated_at IS 'Stage 60.0 — last mutation; reclaim moves stale processing back to pending when older than 30 min.';
