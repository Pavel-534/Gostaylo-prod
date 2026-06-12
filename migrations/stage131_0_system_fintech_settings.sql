-- Stage 131.0 — Ambassador 3.0 Dynamic Fintech & Safety Core (P0)
-- Policy SSOT: docs/ADR/131-ambassador-3-0.md (Accepted)
-- SSOT for owner waterfall, referral caps, guest L2 knobs (P1-ready).
-- Percents for listing fees / FX settlement remain in pricing_profiles (ADR-097).

CREATE TABLE IF NOT EXISTS public.system_fintech_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',

  acquiring_fee_percent NUMERIC(8, 4) NOT NULL DEFAULT 4.3,
  usn_provision_percent NUMERIC(8, 4) NOT NULL DEFAULT 6,
  vat_provision_percent NUMERIC(8, 4) NOT NULL DEFAULT 5,
  reserve_bank_percent NUMERIC(8, 4) NOT NULL DEFAULT 0.5,
  operational_reserve_percent NUMERIC(8, 4) NOT NULL DEFAULT 0,
  safety_lock_max_share NUMERIC(8, 4) NOT NULL DEFAULT 0.95,

  referral_reinvestment_percent NUMERIC(8, 4) NOT NULL DEFAULT 45,
  referral_split_ratio NUMERIC(8, 4) NOT NULL DEFAULT 0.5,

  ambassador_guest_l2_enabled BOOLEAN NOT NULL DEFAULT false,
  ambassador_guest_pool_l1_percent NUMERIC(8, 4) NOT NULL DEFAULT 45,
  ambassador_guest_pool_l2_percent NUMERIC(8, 4) NOT NULL DEFAULT 12,
  ambassador_guest_pool_referee_percent NUMERIC(8, 4) NOT NULL DEFAULT 43,
  ambassador_guest_l2_max_thb_per_booking NUMERIC(14, 2) NOT NULL DEFAULT 500,
  ambassador_guest_l2_max_thb_per_month NUMERIC(14, 2) NOT NULL DEFAULT 50000,

  referral_monthly_program_cap_thb NUMERIC(14, 2) NOT NULL DEFAULT 250000,
  referral_withdrawal_fee_percent NUMERIC(8, 4) NOT NULL DEFAULT 1.5,

  mlm_level1_percent NUMERIC(8, 4) NOT NULL DEFAULT 70,
  mlm_level2_percent NUMERIC(8, 4) NOT NULL DEFAULT 30,
  partner_activation_bonus_thb NUMERIC(14, 2) NOT NULL DEFAULT 500,

  ambassador_3_waterfall_enabled BOOLEAN NOT NULL DEFAULT true,
  ambassador_3_program_cap_enabled BOOLEAN NOT NULL DEFAULT true,

  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT REFERENCES public.profiles (id) ON DELETE SET NULL,

  CONSTRAINT system_fintech_settings_singleton_chk CHECK (id = 'global'),
  CONSTRAINT system_fintech_settings_safety_share_chk CHECK (
    safety_lock_max_share > 0 AND safety_lock_max_share <= 1
  ),
  CONSTRAINT system_fintech_settings_split_ratio_chk CHECK (
    referral_split_ratio >= 0 AND referral_split_ratio <= 1
  )
);

COMMENT ON TABLE public.system_fintech_settings IS
  'Singleton FinTech + referral waterfall config (Stage 131.0). service_role only.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_fintech_settings TO service_role;

ALTER TABLE public.system_fintech_settings ENABLE ROW LEVEL SECURITY;

-- Seed global row; overlay from legacy system_settings.general when present.
INSERT INTO public.system_fintech_settings (
  id,
  acquiring_fee_percent,
  usn_provision_percent,
  vat_provision_percent,
  reserve_bank_percent,
  operational_reserve_percent,
  referral_reinvestment_percent,
  referral_split_ratio,
  referral_monthly_program_cap_thb,
  referral_withdrawal_fee_percent,
  mlm_level1_percent,
  mlm_level2_percent,
  partner_activation_bonus_thb,
  updated_at
)
SELECT
  'global',
  COALESCE(
    NULLIF((g.value ->> 'acquiring_fee_percent'), '')::numeric,
    NULLIF((g.value ->> 'acquiringFeePercent'), '')::numeric,
    4.3
  ),
  COALESCE(
    NULLIF((g.value ->> 'usn_provision_percent'), '')::numeric,
    NULLIF((g.value ->> 'usnProvisionPercent'), '')::numeric,
    6
  ),
  COALESCE(
    NULLIF((g.value ->> 'vat_provision_percent'), '')::numeric,
    NULLIF((g.value ->> 'vatProvisionPercent'), '')::numeric,
    5
  ),
  COALESCE(
    NULLIF((g.value ->> 'reserve_bank_percent'), '')::numeric,
    NULLIF((g.value ->> 'bank_misc_percent'), '')::numeric,
    NULLIF((g.value ->> 'bankMiscPercent'), '')::numeric,
    0.5
  ),
  COALESCE(
    NULLIF((g.value ->> 'operational_reserve_percent'), '')::numeric,
    NULLIF((g.value ->> 'operationalReservePercent'), '')::numeric,
    0
  ),
  COALESCE(
    NULLIF((g.value ->> 'referral_reinvestment_percent'), '')::numeric,
    NULLIF((g.value ->> 'referralReinvestmentPercent'), '')::numeric,
    45
  ),
  COALESCE(
    NULLIF((g.value ->> 'referral_split_ratio'), '')::numeric,
    NULLIF((g.value ->> 'referralSplitRatio'), '')::numeric,
    0.5
  ),
  COALESCE(
    NULLIF((g.value ->> 'referral_monthly_program_cap_thb'), '')::numeric,
    NULLIF((g.value ->> 'referralMonthlyProgramCapThb'), '')::numeric,
    250000
  ),
  COALESCE(
    NULLIF((g.value ->> 'referral_withdrawal_fee_percent'), '')::numeric,
    NULLIF((g.value ->> 'referralWithdrawalFeePercent'), '')::numeric,
    1.5
  ),
  COALESCE(
    NULLIF((g.value ->> 'mlm_level1_percent'), '')::numeric,
    NULLIF((g.value ->> 'mlmLevel1Percent'), '')::numeric,
    70
  ),
  COALESCE(
    NULLIF((g.value ->> 'mlm_level2_percent'), '')::numeric,
    NULLIF((g.value ->> 'mlmLevel2Percent'), '')::numeric,
    30
  ),
  COALESCE(
    NULLIF((g.value ->> 'partner_activation_bonus'), '')::numeric,
    NULLIF((g.value ->> 'partnerActivationBonus'), '')::numeric,
    500
  ),
  now()
FROM (SELECT 1) AS _seed
LEFT JOIN public.system_settings g ON g.key = 'global'
ON CONFLICT (id) DO NOTHING;
