-- Stage 134 — FX rate lock snapshot on referral withdrawal request (48h TTL).
-- SSOT: Marketing wallet only; partner ledger / escrow untouched.

ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS referral_withdrawal_metadata JSONB;

COMMENT ON COLUMN public.user_wallets.referral_withdrawal_metadata IS
  'Stage 134 — FX lock at withdrawal request: requested_fx_rate, requested_rub_amount, fx_lock_expires_at. Cleared on reject/paid/expiry.';
