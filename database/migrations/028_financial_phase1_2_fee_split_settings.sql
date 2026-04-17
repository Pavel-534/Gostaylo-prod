-- Financial Module 3.0 — Phase 1.2
-- Fee split defaults in system_settings.general.

UPDATE public.system_settings
SET value = jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(value, '{}'::jsonb),
          '{guestServiceFeePercent}',
          COALESCE(value->'guestServiceFeePercent', value->'serviceFeePercent', '5.0'::jsonb),
          true
        ),
        '{hostCommissionPercent}',
        COALESCE(value->'hostCommissionPercent', '0.0'::jsonb),
        true
      ),
      '{insuranceFundPercent}',
      COALESCE(value->'insuranceFundPercent', '0.5'::jsonb),
      true
    ),
    updated_at = NOW()
WHERE key = 'general';

