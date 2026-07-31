-- Stage 202.03 — Claim PENDING payouts for T-Bank registry (AUDIT_03 C3.6).
-- Single transaction: lock rows FOR UPDATE, set PROCESSING only if still PENDING.

CREATE OR REPLACE FUNCTION public.claim_payouts_for_tbank_registry(
  p_ids text[]
)
RETURNS TABLE (
  claimed_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH locked AS (
    SELECT p.id
      FROM public.payouts p
     WHERE p.id = ANY (p_ids)
       AND upper(p.status::text) = 'PENDING'
     FOR UPDATE OF p SKIP LOCKED
  ),
  upd AS (
    UPDATE public.payouts p
       SET status = 'PROCESSING'::public.payout_status,
           updated_at = v_now,
           metadata = coalesce(p.metadata, '{}'::jsonb)
                      || jsonb_build_object('tbank_registry_exported_at', to_jsonb(v_now))
      FROM locked
     WHERE p.id = locked.id
    RETURNING p.id
  )
  SELECT upd.id::text FROM upd;
END;
$$;

COMMENT ON FUNCTION public.claim_payouts_for_tbank_registry(text[]) IS
  'AUDIT_03 C3.6: CAS claim PENDING→PROCESSING for T-Bank CSV. service_role only.';

REVOKE ALL ON FUNCTION public.claim_payouts_for_tbank_registry(text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_payouts_for_tbank_registry(text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payouts_for_tbank_registry(text[]) TO service_role;
