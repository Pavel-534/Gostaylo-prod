-- Stage 76.1 — Referral dashboard display currency (ledger SSOT remains THB).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_display_currency TEXT NOT NULL DEFAULT 'THB';

COMMENT ON COLUMN public.profiles.referral_display_currency IS
  'Preferred display currency for ambassador referral UI. Bonuses and ledger in THB; FX from CurrencyService exchange_rates + GET /api/v2/exchange-rates?retail=0.';

UPDATE public.profiles
SET referral_display_currency = 'THB'
WHERE referral_display_currency IS NULL OR BTRIM(referral_display_currency) = '';
