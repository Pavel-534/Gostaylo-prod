-- Stage 71.1 — Referral system core (codes, relations, ledger).
-- SSOT: referral payouts are always bounded by platform gross margin safety lock in service layer.

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_user_id_key UNIQUE (user_id),
  CONSTRAINT referral_codes_code_key UNIQUE (code),
  CONSTRAINT referral_codes_code_format_chk CHECK (char_length(trim(code)) >= 4)
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_is_active ON public.referral_codes (is_active);

COMMENT ON TABLE public.referral_codes IS
  'Unique referral code per user profile.';
COMMENT ON COLUMN public.referral_codes.code IS
  'Human-readable code, e.g. AIR-IVAN-123.';

CREATE TABLE IF NOT EXISTS public.referral_relations (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  referee_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  referral_code_id TEXT REFERENCES public.referral_codes (id) ON DELETE SET NULL,
  referred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT referral_relations_referee_id_key UNIQUE (referee_id),
  CONSTRAINT referral_relations_referrer_referee_chk CHECK (referrer_id <> referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_relations_referrer_id ON public.referral_relations (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_relations_referred_at ON public.referral_relations (referred_at DESC);

COMMENT ON TABLE public.referral_relations IS
  'Who invited whom. One active inviter per referee.';

CREATE TABLE IF NOT EXISTS public.referral_ledger (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  referrer_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  referee_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  amount_thb NUMERIC(14, 2) NOT NULL CHECK (amount_thb >= 0),
  type TEXT NOT NULL CHECK (type IN ('cashback', 'bonus')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'earned', 'canceled')),
  net_profit_order_thb NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (net_profit_order_thb >= 0),
  platform_gross_thb NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (platform_gross_thb >= 0),
  referral_pool_thb NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (referral_pool_thb >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  earned_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  CONSTRAINT referral_ledger_booking_type_key UNIQUE (booking_id, type),
  CONSTRAINT referral_ledger_referrer_referee_chk CHECK (referrer_id <> referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_ledger_booking_id ON public.referral_ledger (booking_id);
CREATE INDEX IF NOT EXISTS idx_referral_ledger_referrer_status ON public.referral_ledger (referrer_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_ledger_referee_status ON public.referral_ledger (referee_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_ledger_status_created ON public.referral_ledger (status, created_at DESC);

COMMENT ON TABLE public.referral_ledger IS
  'Referral transactions by booking lifecycle. bonus=referrer, cashback=referee.';
COMMENT ON COLUMN public.referral_ledger.referral_pool_thb IS
  'Final referral pool after reinvest policy and safety lock.';

