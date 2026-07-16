-- Stage 189.0 — Phone OTP challenges for Smart Auth Gateway (service_role only).

CREATE TABLE IF NOT EXISTS public.auth_phone_otp_challenges (
  id TEXT PRIMARY KEY,
  phone_e164 TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_phone_otp_challenges_phone_created_idx
  ON public.auth_phone_otp_challenges (phone_e164, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_phone_otp_challenges_expires_idx
  ON public.auth_phone_otp_challenges (expires_at);

GRANT ALL ON public.auth_phone_otp_challenges TO service_role;

ALTER TABLE public.auth_phone_otp_challenges ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies — API uses service_role only.

COMMENT ON TABLE public.auth_phone_otp_challenges IS
  'Short-lived SMS OTP challenges for POST /api/v2/auth/phone/* (Stage 189.0).';
