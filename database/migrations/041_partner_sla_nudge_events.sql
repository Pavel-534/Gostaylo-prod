-- Stage 19.0: dedupe Telegram SLA nudges (one per guest "turn" awaiting partner reply).

CREATE TABLE IF NOT EXISTS public.partner_sla_nudge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  anchor_message_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_sla_nudge_events_conv_anchor_unique UNIQUE (conversation_id, anchor_message_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_sla_nudge_events_partner_created
  ON public.partner_sla_nudge_events (partner_id, created_at DESC);

COMMENT ON TABLE public.partner_sla_nudge_events IS 'Partner Telegram SLA reminder sent once per renter anchor message; cron partner-sla-telegram-nudge.';
