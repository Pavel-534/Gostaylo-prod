-- Stage 84.5: Humane SLA (72h) for arbitration.

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS current_deadline_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.disputes.current_deadline_at IS
  'Current response deadline for OPEN/IN_REVIEW dispute (human SLA); null for terminal statuses.';

CREATE INDEX IF NOT EXISTS idx_disputes_current_deadline_open
  ON public.disputes(current_deadline_at)
  WHERE status IN ('OPEN', 'IN_REVIEW');

-- Backfill for already active disputes after deploy.
UPDATE public.disputes
SET current_deadline_at = now() + interval '72 hours'
WHERE status IN ('OPEN', 'IN_REVIEW')
  AND current_deadline_at IS NULL;
