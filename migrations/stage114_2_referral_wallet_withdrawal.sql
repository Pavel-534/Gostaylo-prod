-- Stage 114.2 — полуавтоматическая заявка на вывод реферального withdrawable (FinTech / admin payouts).

ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS referral_withdrawal_status TEXT,
  ADD COLUMN IF NOT EXISTS referral_withdrawal_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_withdrawal_amount_thb NUMERIC(14, 2);

COMMENT ON COLUMN public.user_wallets.referral_withdrawal_status IS
  'NULL | withdrawable_referral | processing | paid — заявка на вывод реферального withdrawable.';
COMMENT ON COLUMN public.user_wallets.referral_withdrawal_requested_at IS
  'Когда пользователь нажал «Вывести реферальные» (Stage 114.2).';
COMMENT ON COLUMN public.user_wallets.referral_withdrawal_amount_thb IS
  'Снимок withdrawable на момент заявки (THB).';

CREATE INDEX IF NOT EXISTS idx_user_wallets_referral_withdrawal_status
  ON public.user_wallets (referral_withdrawal_status)
  WHERE referral_withdrawal_status IS NOT NULL;
