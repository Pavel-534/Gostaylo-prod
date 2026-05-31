-- Stage 124.10 — FI bank/USDT reconciliation snapshots (owner manual balance vs GL).

CREATE TABLE IF NOT EXISTS public.finance_bank_reconciliation_entries (
  id TEXT PRIMARY KEY,
  recorded_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  manual_balance_thb NUMERIC(14, 2) NOT NULL,
  gl_guest_clearing_thb NUMERIC(14, 2) NOT NULL,
  variance_thb NUMERIC(14, 2) NOT NULL,
  ledger_delta_thb NUMERIC(14, 2),
  cash_at_risk_thb NUMERIC(14, 2),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.finance_bank_reconciliation_entries IS
  'Stage 124.10 — ручные сверки FI: остаток владельца vs GL guest clearing.';

CREATE INDEX IF NOT EXISTS idx_finance_bank_recon_created
  ON public.finance_bank_reconciliation_entries (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_bank_reconciliation_entries TO service_role;

ALTER TABLE public.finance_bank_reconciliation_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stage124_10_finance_bank_recon_staff ON public.finance_bank_reconciliation_entries;
CREATE POLICY stage124_10_finance_bank_recon_staff ON public.finance_bank_reconciliation_entries
  FOR ALL TO public
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());
