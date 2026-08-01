-- Stage 203.01 — AUDIT_LEDGER_01 C-L2
-- Account for pre-arbitration dispute holds; required before first dispute ledger posting.

INSERT INTO public.ledger_accounts (id, code, partner_id, display_name, account_type, created_at)
VALUES (
  'la-sys-dispute-hold',
  'DISPUTE_HOLD_RESERVE',
  NULL,
  'Dispute Hold Reserve',
  'SYSTEM',
  now()
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.ledger_accounts IS
  'Chart of accounts: system pots + per-partner earnings buckets. Includes DISPUTE_HOLD_RESERVE (la-sys-dispute-hold) for pre-arbitration holds.';
