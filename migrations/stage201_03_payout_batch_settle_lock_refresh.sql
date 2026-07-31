-- Stage 201.03 — Heartbeat refresh for Concierge settle single-flight lock.
-- Apply after stage201_02. Extends settle_in_progress_at so long batches (PDF/ledger)
-- do not lose the lock when wall-clock > TTL mid-run.
-- Independent of stage201_01 (held balance).

CREATE OR REPLACE FUNCTION public.refresh_payout_batch_settle_lock(
  p_batch_id text,
  p_token text
)
RETURNS TABLE (
  refreshed boolean,
  reason text,
  settle_in_progress_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_token text;
  v_existing text;
  v_now timestamptz := now();
BEGIN
  v_id := trim(coalesce(p_batch_id, ''));
  v_token := nullif(trim(coalesce(p_token, '')), '');

  IF v_id = '' OR v_token IS NULL THEN
    RETURN QUERY SELECT false, 'TOKEN_REQUIRED', NULL::timestamptz;
    RETURN;
  END IF;

  SELECT nullif(pb.metadata->>'settle_lock_token', '')
    INTO v_existing
    FROM public.payout_batches pb
   WHERE pb.id = v_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found', NULL::timestamptz;
    RETURN;
  END IF;

  IF v_existing IS NULL OR v_existing <> v_token THEN
    RETURN QUERY SELECT false, 'token_mismatch', NULL::timestamptz;
    RETURN;
  END IF;

  UPDATE public.payout_batches pb
     SET metadata = coalesce(pb.metadata, '{}'::jsonb)
                    || jsonb_build_object('settle_in_progress_at', to_jsonb(v_now)),
         updated_at = v_now
   WHERE pb.id = v_id;

  RETURN QUERY SELECT true, 'OK', v_now;
END;
$$;

-- Align claim default TTL with JS (30 min); heartbeat keeps long runs alive.
CREATE OR REPLACE FUNCTION public.try_claim_payout_batch_settle_lock(
  p_batch_id text,
  p_owner text DEFAULT NULL,
  p_ttl_seconds integer DEFAULT 1800
)
RETURNS TABLE (
  claimed boolean,
  reason text,
  batch_status text,
  settle_in_progress_at timestamptz,
  settle_lock_owner text,
  settle_lock_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_ttl integer;
  v_token text;
  v_now timestamptz := now();
  v_status text;
  v_owner text;
  v_lock_at timestamptz;
  v_lock_owner text;
BEGIN
  v_id := trim(coalesce(p_batch_id, ''));
  v_ttl := greatest(60, least(coalesce(p_ttl_seconds, 1800), 7200));
  v_owner := nullif(trim(coalesce(p_owner, '')), '');
  v_token := gen_random_uuid()::text;

  IF v_id = '' THEN
    RETURN QUERY SELECT false, 'BATCH_ID_REQUIRED', NULL::text, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT upper(trim(pb.status)),
         nullif(pb.metadata->>'settle_in_progress_at', '')::timestamptz,
         nullif(pb.metadata->>'settle_lock_owner', '')
    INTO v_status, v_lock_at, v_lock_owner
    FROM public.payout_batches pb
   WHERE pb.id = v_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found', NULL::text, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF v_status IS NULL OR v_status NOT IN ('LOCKED', 'EXPORTED', 'SETTLED') THEN
    RETURN QUERY SELECT false, 'invalid_status', v_status, v_lock_at, v_lock_owner, NULL::text;
    RETURN;
  END IF;

  IF v_lock_at IS NOT NULL AND v_lock_at > (v_now - make_interval(secs => v_ttl)) THEN
    RETURN QUERY SELECT false, 'settle_in_progress', v_status, v_lock_at, v_lock_owner, NULL::text;
    RETURN;
  END IF;

  UPDATE public.payout_batches pb
     SET metadata = coalesce(pb.metadata, '{}'::jsonb)
                    || jsonb_build_object(
                         'settle_in_progress_at', to_jsonb(v_now),
                         'settle_lock_owner', to_jsonb(coalesce(v_owner, '')),
                         'settle_lock_token', to_jsonb(v_token)
                       ),
         updated_at = v_now
   WHERE pb.id = v_id;

  RETURN QUERY SELECT true, 'OK', v_status, v_now, coalesce(v_owner, ''), v_token;
END;
$$;

COMMENT ON FUNCTION public.refresh_payout_batch_settle_lock(text, text) IS
  'Heartbeat: bump settle_in_progress_at for active settle token. service_role only.';
COMMENT ON FUNCTION public.try_claim_payout_batch_settle_lock(text, text, integer) IS
  'Single-flight claim for Concierge settle. TTL reclaim default 1800s. service_role only.';

REVOKE ALL ON FUNCTION public.refresh_payout_batch_settle_lock(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_claim_payout_batch_settle_lock(text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_payout_batch_settle_lock(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_claim_payout_batch_settle_lock(text, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_payout_batch_settle_lock(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_claim_payout_batch_settle_lock(text, text, integer) TO service_role;
