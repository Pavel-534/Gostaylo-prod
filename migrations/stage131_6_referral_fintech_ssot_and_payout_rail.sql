-- Stage 131.6 — Dual SSOT fix + referral payout rail on unified payouts table.
-- 1) Resync drifted referral knobs from legacy system_settings.general → system_fintech_settings (one-time).
-- 2) Add payouts.payout_rail + metadata for FinTech Bridge (referral vs partner segmentation).

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.payouts.metadata IS
  'FinTech Bridge + FX snapshot (Stage 131.5/131.6): payout_type, payout_fx, tbank_registry_exported_at, …';

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS payout_rail TEXT;

COMMENT ON COLUMN public.payouts.payout_rail IS
  'Treasury rail id (ADR-097 / Stage 131.6): TBANK_RU | KG_CRYPTO | REFERRAL_RUB_CARD';

CREATE INDEX IF NOT EXISTS idx_payouts_payout_rail_pending
  ON public.payouts (payout_rail, status)
  WHERE payout_rail IS NOT NULL AND status = 'PENDING';

-- One-time: overlay general → fintech where marketing admin may have edited general after 131.0 seed.
UPDATE public.system_fintech_settings AS s
SET
  acquiring_fee_percent = COALESCE(
    NULLIF((g.value ->> 'acquiring_fee_percent'), '')::numeric,
    NULLIF((g.value ->> 'acquiringFeePercent'), '')::numeric,
    s.acquiring_fee_percent
  ),
  operational_reserve_percent = COALESCE(
    NULLIF((g.value ->> 'operational_reserve_percent'), '')::numeric,
    NULLIF((g.value ->> 'operationalReservePercent'), '')::numeric,
    s.operational_reserve_percent
  ),
  referral_reinvestment_percent = COALESCE(
    NULLIF((g.value ->> 'referral_reinvestment_percent'), '')::numeric,
    NULLIF((g.value ->> 'referralReinvestmentPercent'), '')::numeric,
    s.referral_reinvestment_percent
  ),
  referral_split_ratio = COALESCE(
    NULLIF((g.value ->> 'referral_split_ratio'), '')::numeric,
    NULLIF((g.value ->> 'referralSplitRatio'), '')::numeric,
    s.referral_split_ratio
  ),
  mlm_level1_percent = COALESCE(
    NULLIF((g.value ->> 'mlm_level1_percent'), '')::numeric,
    NULLIF((g.value ->> 'mlmLevel1Percent'), '')::numeric,
    s.mlm_level1_percent
  ),
  mlm_level2_percent = COALESCE(
    NULLIF((g.value ->> 'mlm_level2_percent'), '')::numeric,
    NULLIF((g.value ->> 'mlmLevel2Percent'), '')::numeric,
    s.mlm_level2_percent
  ),
  partner_activation_bonus_thb = COALESCE(
    NULLIF((g.value ->> 'partner_activation_bonus'), '')::numeric,
    NULLIF((g.value ->> 'partnerActivationBonus'), '')::numeric,
    s.partner_activation_bonus_thb
  ),
  updated_at = now()
FROM public.system_settings AS g
WHERE g.key = 'general'
  AND s.id = 'global';

-- Backfill referral bridge rows created before payout_rail column.
UPDATE public.payouts
SET payout_rail = 'REFERRAL_RUB_CARD'
WHERE payout_rail IS NULL
  AND (metadata ->> 'payout_type') = 'referral_withdrawal';
