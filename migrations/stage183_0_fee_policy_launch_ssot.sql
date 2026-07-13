-- Stage 183.0 — Fee policy launch SSOT (ADR-182 correction)
-- Launch model: guest service fee 15%, host commission 0% (partner receives full subtotal).
-- Supersedes stage182_0 side-effect when hostCommissionPercent was copied from legacy defaultCommissionRate.

UPDATE public.system_settings
SET value = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(value, '{}'::jsonb),
            '{guestServiceFeePercent}',
            '15'::jsonb,
            true
          ),
          '{serviceFeePercent}',
          '15'::jsonb,
          true
        ),
        '{hostCommissionPercent}',
        '0'::jsonb,
        true
      ),
      '{defaultCommissionRate}',
      '0'::jsonb,
      true
    ),
    updated_at = NOW()
WHERE key = 'general';

COMMENT ON TABLE public.system_settings IS
  'Platform settings JSON blobs. general.hostCommissionPercent is SSOT for host %; defaultCommissionRate is legacy mirror. guestServiceFeePercent is SSOT for guest fee (Stage 183).';
