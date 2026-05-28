-- Stage 121.1 (B2) — Referral 2.0: hold period for earned bonuses after COMPLETED.

-- ── referral_ledger: earned_held + unlock_at ───────────────────────────────────
ALTER TABLE public.referral_ledger
  DROP CONSTRAINT IF EXISTS referral_ledger_status_check;

ALTER TABLE public.referral_ledger
  ADD CONSTRAINT referral_ledger_status_check CHECK (
    status IN ('pending', 'earned', 'earned_held', 'canceled', 'canceled_deficit')
  );

ALTER TABLE public.referral_ledger
  ADD COLUMN IF NOT EXISTS unlock_at TIMESTAMPTZ;

COMMENT ON COLUMN public.referral_ledger.unlock_at IS
  'Stage 121.1 — when earned_held becomes withdrawable (completed_at + referral_hold_days).';

COMMENT ON COLUMN public.referral_ledger.status IS
  'pending | earned | earned_held | canceled | canceled_deficit';

CREATE INDEX IF NOT EXISTS idx_referral_ledger_earned_held_unlock
  ON public.referral_ledger (unlock_at)
  WHERE status = 'earned_held';

-- ── user_wallets: held referral balance (display + fast reads) ────────────────
ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS held_referral_balance_thb NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (held_referral_balance_thb >= 0);

COMMENT ON COLUMN public.user_wallets.held_referral_balance_thb IS
  'Stage 121.1 — сумма referral_ledger earned_held по бенефициару (не в balance_thb до unlock).';
