-- Stage 202.21 — strip legacy fintech SSOT keys from system_settings.general (idempotent hygiene).
-- Does NOT touch system_fintech_settings. Safe to re-run (0 rows if already clean).

DO $$
DECLARE
  affected_count INT;
BEGIN
  UPDATE system_settings
  SET value = value
    - 'acquiring_fee_percent'
    - 'acquiringFeePercent'
    - 'referral_reinvestment_percent'
    - 'referralReinvestmentPercent'
    - 'referral_split_ratio'
    - 'referralSplitRatio'
    - 'operational_reserve_percent'
    - 'operationalReservePercent'
    - 'partner_activation_bonus'
    - 'partnerActivationBonus'
    - 'mlm_level1_percent'
    - 'mlmLevel1Percent'
    - 'mlm_level2_percent'
    - 'mlmLevel2Percent'
  WHERE key = 'general'
    AND jsonb_typeof(value) = 'object'
    AND (
      value ? 'acquiring_fee_percent'
      OR value ? 'acquiringFeePercent'
      OR value ? 'referral_reinvestment_percent'
      OR value ? 'referralReinvestmentPercent'
      OR value ? 'referral_split_ratio'
      OR value ? 'referralSplitRatio'
      OR value ? 'operational_reserve_percent'
      OR value ? 'operationalReservePercent'
      OR value ? 'partner_activation_bonus'
      OR value ? 'partnerActivationBonus'
      OR value ? 'mlm_level1_percent'
      OR value ? 'mlmLevel1Percent'
      OR value ? 'mlm_level2_percent'
      OR value ? 'mlmLevel2Percent'
    );

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Stage 202.21: stripped fintech legacy keys from % general row(s)', affected_count;
END $$;
