-- Stage 38.0 — Atomic idempotent reminder lock on promo_codes.metadata.reminder_locks
-- Prevents duplicate Flash 1h reminders when cron overlaps (parallel HTTP hits).

CREATE OR REPLACE FUNCTION public.promo_try_acquire_reminder_lock(p_promo_id uuid, p_lock_key text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  k text := trim(both from coalesce(p_lock_key, ''));
  n int;
BEGIN
  IF k = '' THEN
    RETURN false;
  END IF;

  UPDATE public.promo_codes pc
  SET metadata = jsonb_set(
    coalesce(pc.metadata, '{}'::jsonb),
    '{reminder_locks}',
    coalesce(pc.metadata->'reminder_locks', '{}'::jsonb) || jsonb_build_object(k, to_jsonb(now() AT TIME ZONE 'utc')),
    true
  )
  WHERE pc.id = p_promo_id
    AND NOT (coalesce(pc.metadata->'reminder_locks', '{}'::jsonb) ? k);

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

COMMENT ON FUNCTION public.promo_try_acquire_reminder_lock(uuid, text) IS
  'Stage 38.0: sets metadata.reminder_locks[lock_key] if absent; returns true when this call acquired the lock.';

GRANT EXECUTE ON FUNCTION public.promo_try_acquire_reminder_lock(uuid, text) TO service_role;
