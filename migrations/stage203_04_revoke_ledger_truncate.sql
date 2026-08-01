-- Stage 203.04 — TRUNCATE bypasses row-level append-only triggers; revoke from service_role.
REVOKE TRUNCATE ON TABLE public.ledger_journals FROM service_role;
REVOKE TRUNCATE ON TABLE public.ledger_entries FROM service_role;
REVOKE TRUNCATE ON TABLE public.ledger_accounts FROM service_role;
