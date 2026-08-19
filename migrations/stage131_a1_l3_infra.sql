-- ============================================================
-- Stage 131.A1.1: фундамент L3 (consent + quarterly stats + fintech knobs)
-- Policy: docs/ADR/131A-ambassador-3-1-multi-level.md
-- Idempotent. Does NOT cut over guest pool 45/12/43 or program cap 250k
-- (that write is Stage 131.A1.2 together with live L3 wiring).
-- ============================================================

-- 1) profiles: явное согласие на multi-level программу (L3+ only)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_mlm_consent_at timestamptz NULL;

COMMENT ON COLUMN public.profiles.referral_mlm_consent_at IS
  'When the user explicitly accepted the multi-level program terms (ADR-131A §6). NULL = consent not given. Affects L3+ accrual only, not L1/L2/referee.';

CREATE INDEX IF NOT EXISTS profiles_referral_mlm_consent_at_idx
  ON public.profiles (referral_mlm_consent_at)
  WHERE referral_mlm_consent_at IS NOT NULL;

-- 2) system_fintech_settings: L3 knobs (nullable-safe ADD; live split/cap unchanged)
ALTER TABLE public.system_fintech_settings
  ADD COLUMN IF NOT EXISTS ambassador_guest_l3_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.system_fintech_settings
  ADD COLUMN IF NOT EXISTS ambassador_guest_pool_l3_percent NUMERIC(8, 4) NOT NULL DEFAULT 0;

ALTER TABLE public.system_fintech_settings
  ADD COLUMN IF NOT EXISTS ambassador_guest_l3_min_direct_partners INTEGER NOT NULL DEFAULT 10;

ALTER TABLE public.system_fintech_settings
  ADD COLUMN IF NOT EXISTS ambassador_guest_l3_max_thb_per_booking NUMERIC(14, 2) NOT NULL DEFAULT 500;

ALTER TABLE public.system_fintech_settings
  ADD COLUMN IF NOT EXISTS ambassador_guest_l3_max_thb_per_month NUMERIC(14, 2) NOT NULL DEFAULT 20000;

COMMENT ON COLUMN public.system_fintech_settings.ambassador_guest_l3_enabled IS
  'Stage 131.A1: live L3 ledger. false = shadow/withhold only (A1.2). Default false until Legal+QA.';
COMMENT ON COLUMN public.system_fintech_settings.ambassador_guest_pool_l3_percent IS
  'Guest pool L3 share. 0 while flag is off (legacy 45/12/43). Cutover to 5 with 42/10/43 in A1.2.';
COMMENT ON COLUMN public.system_fintech_settings.ambassador_guest_l3_min_direct_partners IS
  'L3 gate: countDirectPartnersInvited (profiles.role = PARTNER). ADR-131A §4.2 / §9.4.';
COMMENT ON COLUMN public.system_fintech_settings.ambassador_guest_l3_max_thb_per_booking IS
  'L3 per-booking cap THB (ADR-131A §9.1).';
COMMENT ON COLUMN public.system_fintech_settings.ambassador_guest_l3_max_thb_per_month IS
  'L3 per-beneficiary monthly cap THB UTC (ADR-131A §4.1).';

-- 3) Квартальная статистика для оферты (средний доход активного амбассадора)
CREATE TABLE IF NOT EXISTS public.referral_program_stats (
  period_start date PRIMARY KEY,
  period_end date NOT NULL,
  total_earned_thb numeric(14,2) NOT NULL DEFAULT 0,
  active_ambassadors_count int NOT NULL DEFAULT 0,
  avg_earned_thb numeric(14,2) NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.referral_program_stats IS
  'Quarterly avg earnings per active ambassador. Source of disclosure in /legal/public-offer/. Populated by cron /api/cron/referral-program-stats-quarterly (Stage 131.A1.3).';

COMMENT ON COLUMN public.referral_program_stats.period_start IS
  'First day of closed quarter (UTC).';

COMMENT ON COLUMN public.referral_program_stats.period_end IS
  'Last day of closed quarter (UTC), inclusive.';

COMMENT ON COLUMN public.referral_program_stats.avg_earned_thb IS
  'total_earned_thb / active_ambassadors_count. 0 if no active ambassadors in period.';

-- 4) Индекс для quarterly-cron lookup
CREATE INDEX IF NOT EXISTS referral_ledger_earned_at_guest_idx
  ON public.referral_ledger (earned_at)
  WHERE status = 'earned' AND referral_type = 'guest_booking';

-- 5) GRANT then RLS (finance/ops table: service_role write; admin read via Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_program_stats TO service_role;
GRANT SELECT ON public.referral_program_stats TO authenticated;

ALTER TABLE public.referral_program_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_program_stats_read ON public.referral_program_stats;
CREATE POLICY referral_program_stats_read ON public.referral_program_stats
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
  );
