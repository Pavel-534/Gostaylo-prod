-- Stage 131.0 — audit trail for system_fintech_settings mutations (service_role only).

CREATE TABLE IF NOT EXISTS public.system_fintech_settings_audit (
  id BIGSERIAL PRIMARY KEY,
  settings_id TEXT NOT NULL DEFAULT 'global',
  changed_by TEXT REFERENCES public.profiles (id) ON DELETE SET NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  settings_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_fintech_settings_audit IS
  'Field-level audit for system_fintech_settings (Stage 131.0). service_role only.';

CREATE INDEX IF NOT EXISTS system_fintech_settings_audit_created_at_idx
  ON public.system_fintech_settings_audit (created_at DESC);

GRANT SELECT, INSERT ON public.system_fintech_settings_audit TO service_role;

ALTER TABLE public.system_fintech_settings_audit ENABLE ROW LEVEL SECURITY;
