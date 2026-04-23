-- Stage 17.0: first-response-time samples for partner SLA (search + reputation).
-- Apply in Supabase SQL Editor or via your migration runner. Service role inserts from API.

CREATE TABLE IF NOT EXISTS public.partner_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  renter_message_id TEXT NOT NULL,
  partner_message_id TEXT NOT NULL,
  response_time_ms BIGINT NOT NULL CHECK (response_time_ms >= 0 AND response_time_ms <= 604800000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_performance_logs_conv_renter_unique UNIQUE (conversation_id, renter_message_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_performance_logs_partner_created
  ON public.partner_performance_logs (partner_id, created_at DESC);

COMMENT ON TABLE public.partner_performance_logs IS 'Initial response time (ms) from last guest-visible message to partner reply; deduped per renter anchor message.';
