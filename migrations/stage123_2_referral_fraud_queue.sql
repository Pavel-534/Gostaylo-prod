-- Stage 123.2 — Referral B5: anti-fraud v2 queue + markers

CREATE TABLE IF NOT EXISTS public.referral_fraud_queue (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'open',
  severity TEXT NOT NULL DEFAULT 'review',
  source TEXT NOT NULL,
  referral_code TEXT,
  referrer_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  candidate_user_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  candidate_email TEXT,
  campaign_slug TEXT,
  rule_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_fraud_queue_status_chk CHECK (status IN ('open', 'approved', 'blocked', 'flagged')),
  CONSTRAINT referral_fraud_queue_severity_chk CHECK (severity IN ('review', 'block'))
);

COMMENT ON TABLE public.referral_fraud_queue IS
  'Stage 123.2 — очередь ручного антифрод-ревью referral атрибуций/регистраций.';

CREATE INDEX IF NOT EXISTS idx_referral_fraud_queue_status_created
  ON public.referral_fraud_queue (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_fraud_queue_referrer
  ON public.referral_fraud_queue (referrer_id)
  WHERE referrer_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_fraud_queue TO service_role;

ALTER TABLE public.referral_fraud_queue ENABLE ROW LEVEL SECURITY;
