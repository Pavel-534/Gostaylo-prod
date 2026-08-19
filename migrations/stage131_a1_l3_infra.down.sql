-- Reverse Stage 131.A1.1 L3 infra. Does not restore dropped stats rows.

DROP POLICY IF EXISTS referral_program_stats_read ON public.referral_program_stats;
DROP INDEX IF EXISTS referral_ledger_earned_at_guest_idx;
DROP INDEX IF EXISTS profiles_referral_mlm_consent_at_idx;
DROP TABLE IF EXISTS public.referral_program_stats;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS referral_mlm_consent_at;

ALTER TABLE public.system_fintech_settings
  DROP COLUMN IF EXISTS ambassador_guest_l3_enabled;

ALTER TABLE public.system_fintech_settings
  DROP COLUMN IF EXISTS ambassador_guest_pool_l3_percent;

ALTER TABLE public.system_fintech_settings
  DROP COLUMN IF EXISTS ambassador_guest_l3_min_direct_partners;

ALTER TABLE public.system_fintech_settings
  DROP COLUMN IF EXISTS ambassador_guest_l3_max_thb_per_booking;

ALTER TABLE public.system_fintech_settings
  DROP COLUMN IF EXISTS ambassador_guest_l3_max_thb_per_month;
