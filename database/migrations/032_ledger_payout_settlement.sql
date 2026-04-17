-- Phase 2.0: partner payout settlement in ledger + system account «выплачено».

-- Payout journals are not tied to a booking row; booking_id stays NULL for those events.
ALTER TABLE public.ledger_journals
  ALTER COLUMN booking_id DROP NOT NULL;

COMMENT ON COLUMN public.ledger_journals.booking_id IS
  'Booking for payment-capture journals; NULL for operational journals (e.g. payout settlement).';

INSERT INTO public.ledger_accounts (id, code, partner_id, display_name, account_type)
VALUES (
  'la-sys-partner-payouts-settled',
  'PARTNER_PAYOUTS_SETTLED',
  NULL,
  'Partner payouts settled (bank / manual)',
  'SYSTEM'
)
ON CONFLICT (id) DO NOTHING;
