-- Stage 131.5 — Live L2 guest accruals + FinTech Bridge (referral → payouts / T-Bank).

UPDATE public.system_fintech_settings
SET
  ambassador_guest_l2_enabled = true,
  updated_at = now()
WHERE id = 'global';

COMMENT ON COLUMN public.system_fintech_settings.ambassador_guest_l2_enabled IS
  'Stage 131.5: live L2 ledger rows on guest bookings (caps 500 THB/booking, 50k THB/month).';
