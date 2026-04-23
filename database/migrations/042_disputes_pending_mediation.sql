-- Stage 20.0: mediation window before official dispute (no payment freeze during PENDING_MEDIATION).

ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_status_check;

ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_status_check
  CHECK (
    status IN (
      'OPEN',
      'IN_REVIEW',
      'RESOLVED',
      'REJECTED',
      'CLOSED',
      'PENDING_MEDIATION'
    )
  );

DROP INDEX IF EXISTS public.uq_disputes_one_active_per_booking;

CREATE UNIQUE INDEX uq_disputes_one_active_per_booking
  ON public.disputes (booking_id)
  WHERE status IN ('OPEN', 'IN_REVIEW', 'PENDING_MEDIATION');

COMMENT ON COLUMN public.disputes.status IS 'OPEN/IN_REVIEW = active arbitration; PENDING_MEDIATION = guest help cooldown (no freeze); terminal: RESOLVED/REJECTED/CLOSED.';
