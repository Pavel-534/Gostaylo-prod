-- Stage 14.0: Unified Dispute & Moderation Engine
-- Booking-linked disputes with admin levers groundwork:
-- freeze_payment, force_refund, add_penalty.

CREATE TABLE IF NOT EXISTS public.disputes (
  id TEXT PRIMARY KEY DEFAULT ('dsp-' || gen_random_uuid()::text),
  booking_id TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  conversation_id TEXT NULL REFERENCES public.conversations(id) ON DELETE SET NULL,
  opened_by TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  against_user_id TEXT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general',
  reason_code TEXT NOT NULL DEFAULT 'official_dispute',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED')),
  freeze_payment BOOLEAN NOT NULL DEFAULT TRUE,
  force_refund_requested BOOLEAN NOT NULL DEFAULT FALSE,
  penalty_requested BOOLEAN NOT NULL DEFAULT FALSE,
  admin_action_flags JSONB NOT NULL DEFAULT '{"freeze_payment": true, "force_refund": false, "add_penalty": false}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  closed_by TEXT NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_disputes_booking ON public.disputes(booking_id);
CREATE INDEX IF NOT EXISTS idx_disputes_conversation ON public.disputes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_disputes_opened_by ON public.disputes(opened_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);

-- One active dispute per booking (anti-spam + clear arbitration owner).
CREATE UNIQUE INDEX IF NOT EXISTS uq_disputes_one_active_per_booking
  ON public.disputes(booking_id)
  WHERE status IN ('OPEN', 'IN_REVIEW');

CREATE TABLE IF NOT EXISTS public.dispute_penalties (
  id TEXT PRIMARY KEY DEFAULT ('dpn-' || gen_random_uuid()::text),
  dispute_id TEXT NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issued_by TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  penalty_type TEXT NOT NULL DEFAULT 'warning',
  points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0),
  reason TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_penalties_dispute_id ON public.dispute_penalties(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_penalties_target_user_id ON public.dispute_penalties(target_user_id);

COMMENT ON TABLE public.disputes IS 'Official booking-linked dispute cases opened by renter/partner for arbitration.';
COMMENT ON COLUMN public.disputes.freeze_payment IS 'If true and dispute is active, escrow thaw/payout should stay blocked until resolution.';
COMMENT ON COLUMN public.disputes.admin_action_flags IS 'Prepared admin levers: freeze_payment, force_refund, add_penalty.';
COMMENT ON TABLE public.dispute_penalties IS 'Prepared penalties linked to a dispute case (for moderation/accountability).';
