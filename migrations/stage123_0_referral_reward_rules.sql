-- Stage 123.0 — Referral B4: versioned reward rules + A/B shadow mode
-- SSOT: lib/services/marketing/referral-reward-rules.service.js

CREATE TABLE IF NOT EXISTS public.referral_reward_rules (
  id TEXT PRIMARY KEY,
  version INT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_shadow BOOLEAN NOT NULL DEFAULT false,
  shadow_traffic_pct INT NOT NULL DEFAULT 0,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  campaign_slug TEXT,
  priority INT NOT NULL DEFAULT 0,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_reward_rules_shadow_pct_chk CHECK (
    shadow_traffic_pct >= 0 AND shadow_traffic_pct <= 100
  ),
  CONSTRAINT referral_reward_rules_version_chk CHECK (version >= 1)
);

COMMENT ON TABLE public.referral_reward_rules IS
  'Stage 123.0 — версионированные правила начисления (hold, лимиты). Экономика payout — referral-pnl; split_ratio в rules — audit/shadow до явного rollout.';
COMMENT ON COLUMN public.referral_reward_rules.rules IS
  'JSON: hold_days, split_ratio, min_booking_value_thb (см. referral-reward-rules.service.js)';
COMMENT ON COLUMN public.referral_reward_rules.is_shadow IS
  'Shadow mode: не меняет hold/суммы; пишется reward_rule_shadow в referral_ledger.metadata';
COMMENT ON COLUMN public.referral_reward_rules.shadow_traffic_pct IS
  'Доля броней (0–100), на которых считается shadow-сравнение (детерминированный bucket по booking_id)';

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_reward_rules_version
  ON public.referral_reward_rules (version);

CREATE INDEX IF NOT EXISTS idx_referral_reward_rules_active
  ON public.referral_reward_rules (is_active, is_shadow, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_referral_reward_rules_campaign
  ON public.referral_reward_rules (campaign_slug)
  WHERE campaign_slug IS NOT NULL;

-- Backend-only (финансы)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_reward_rules TO service_role;

ALTER TABLE public.referral_reward_rules ENABLE ROW LEVEL SECURITY;
