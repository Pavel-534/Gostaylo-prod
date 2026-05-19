-- Stage 103.2 — payout_batches lifecycle timestamps (ADR-097 / 053_financial_model_v2)
-- Safe to re-run. Apply if smoke lock fails: "Could not find the 'locked_at' column".

ALTER TABLE public.payout_batches
  ADD COLUMN IF NOT EXISTS export_checksum TEXT,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.payout_batches.locked_at IS 'Treasury lock (DRAFT → LOCKED)';
COMMENT ON COLUMN public.payout_batches.exported_at IS 'Registry CSV/JSON exported to bank';
COMMENT ON COLUMN public.payout_batches.settled_at IS 'Batch closed after bank transfer confirmed';

ALTER TABLE public.payout_batch_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ledger_journal_id TEXT REFERENCES public.ledger_journals (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_id TEXT;

COMMENT ON COLUMN public.payout_batch_items.updated_at IS 'Row touch time (lock/export/settle pipeline)';

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.payouts.updated_at IS 'Last touch (documents, status changes)';
