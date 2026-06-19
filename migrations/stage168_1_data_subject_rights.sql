-- Stage 168.1 — Data Subject Rights (DSAR export + erasure queue)

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS data_erasure_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.data_erasure_completed_at IS
  'Set when account anonymization completed (GDPR erasure). Login blocked via is_banned.';

CREATE INDEX IF NOT EXISTS idx_profiles_data_erasure_completed_at
  ON public.profiles (data_erasure_completed_at DESC)
  WHERE data_erasure_completed_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.data_erasure_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_grace'
    CHECK (status IN ('pending_grace', 'processing', 'completed', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_erasure_requests_user_status
  ON public.data_erasure_requests (user_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_erasure_requests_scheduled
  ON public.data_erasure_requests (scheduled_for)
  WHERE status = 'pending_grace';

COMMENT ON TABLE public.data_erasure_requests IS
  'User-initiated account erasure queue (30d grace). SSOT: lib/privacy/data-subject-erasure.service.js';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_erasure_requests TO service_role;

ALTER TABLE public.data_erasure_requests ENABLE ROW LEVEL SECURITY;
