-- Stage 123.1 — B4 production-ready rollout
-- 1) referral_ledger columns for fast SSOT analytics
-- 2) default global rule bootstrap with rollout flag disabled

ALTER TABLE public.referral_ledger
  ADD COLUMN IF NOT EXISTS rule_version INT;

ALTER TABLE public.referral_ledger
  ADD COLUMN IF NOT EXISTS reward_rule_id TEXT;

CREATE INDEX IF NOT EXISTS idx_referral_ledger_rule_version
  ON public.referral_ledger (rule_version)
  WHERE rule_version IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_ledger_reward_rule_id
  ON public.referral_ledger (reward_rule_id)
  WHERE reward_rule_id IS NOT NULL;

COMMENT ON COLUMN public.referral_ledger.rule_version IS
  'Stage 123.1 — версия production reward rule, применённая к начислению.';
COMMENT ON COLUMN public.referral_ledger.reward_rule_id IS
  'Stage 123.1 — id production reward rule, применённой к начислению.';

INSERT INTO public.referral_reward_rules (
  id,
  version,
  name,
  is_active,
  is_shadow,
  shadow_traffic_pct,
  effective_from,
  campaign_slug,
  priority,
  rules,
  created_at,
  updated_at
)
SELECT
  'rrr-global-default-v1',
  1,
  'Global Default Rule v1',
  true,
  false,
  0,
  now(),
  null,
  -100,
  jsonb_build_object(
    'hold_days',
    COALESCE(
      NULLIF((SELECT (value->>'referral_hold_days') FROM public.system_settings WHERE key = 'general' LIMIT 1), '')::int,
      14
    ),
    'split_ratio',
    null,
    'min_booking_value_thb',
    null,
    'apply_split_in_production',
    false
  ),
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.referral_reward_rules r
  WHERE r.version = 1
    AND r.is_shadow = false
);
