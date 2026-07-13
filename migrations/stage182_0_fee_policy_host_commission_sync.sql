-- Stage 182.0 — Fee policy unification (ADR-182)
-- DEPRECATED by stage183_0: copying defaultCommissionRate → hostCommissionPercent broke launch 0% host intent.
-- Kept for history; do not re-apply on environments that ran stage183_0.

UPDATE public.system_settings
SET value = jsonb_set(
      COALESCE(value, '{}'::jsonb),
      '{hostCommissionPercent}',
      to_jsonb((value->>'defaultCommissionRate')::numeric),
      true
    ),
    updated_at = NOW()
WHERE key = 'general'
  AND (value->>'defaultCommissionRate') IS NOT NULL
  AND (value->>'defaultCommissionRate') ~ '^[0-9]+(\.[0-9]+)?$'
  AND (value->>'defaultCommissionRate')::numeric > 0
  AND (
    (value->>'hostCommissionPercent') IS NULL
    OR (value->>'hostCommissionPercent') = ''
    OR (value->>'hostCommissionPercent')::numeric = 0
  );

COMMENT ON TABLE public.system_settings IS
  'Platform settings JSON blobs. general.hostCommissionPercent and general.defaultCommissionRate must stay in sync (ADR-182).';
