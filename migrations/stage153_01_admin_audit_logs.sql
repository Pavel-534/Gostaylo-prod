-- Stage 153.1 — append-only admin audit trail (governance / manual interventions).
-- JS SSOT: lib/services/audit/admin-audit.js

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_audit_logs IS
  'Stage 153.1 — immutable admin action audit (service_role INSERT only).';

CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_created_idx
  ON public.admin_audit_logs (entity_type, entity_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS admin_audit_logs_idempotency_key_uidx
  ON public.admin_audit_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

GRANT INSERT ON public.admin_audit_logs TO service_role;

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
