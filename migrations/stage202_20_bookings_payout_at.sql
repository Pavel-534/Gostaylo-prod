-- Stage 202.20 — bookings.payout_at (treasury batch settle + legacy payout path)
-- Required by PayoutBatchService.markBatchSettled catch-up and EscrowService payout.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payout_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.payout_at IS
  'When partner payout was settled (Concierge batch or legacy escrow payout).';
