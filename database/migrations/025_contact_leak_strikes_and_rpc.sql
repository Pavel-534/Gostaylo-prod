-- Contact leak strikes (per sender) + RPCs for dashboard and atomic increment.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_leak_strikes integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_contact_leak_strikes
  ON public.profiles (contact_leak_strikes DESC)
  WHERE contact_leak_strikes > 0;

COMMENT ON COLUMN public.profiles.contact_leak_strikes IS
  'Server-incremented when chat contact-safety detector fires (CONTACT_LEAK_ATTEMPT).';

-- Atomic increment (called from POST /api/v2/chat/messages with service role).
CREATE OR REPLACE FUNCTION public.increment_contact_leak_strikes(p_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET contact_leak_strikes = COALESCE(contact_leak_strikes, 0) + 1
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_contact_leak_strikes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_contact_leak_strikes(text) TO service_role;

-- Top senders by leak attempts since p_since (for admin dashboard).
CREATE OR REPLACE FUNCTION public.admin_contact_leak_top_violators(p_since timestamptz, p_limit int)
RETURNS TABLE (
  sender_id text,
  attempt_count bigint,
  last_event_at timestamptz,
  last_conversation_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      id,
      created_at,
      detail->>'senderId' AS sender_id,
      detail->>'conversationId' AS conversation_id
    FROM public.critical_signal_events
    WHERE signal_key = 'CONTACT_LEAK_ATTEMPT'
      AND created_at >= p_since
      AND COALESCE(detail->>'senderId', '') <> ''
  ),
  ranked AS (
    SELECT
      sender_id,
      COUNT(*)::bigint AS attempt_count,
      MAX(created_at) AS last_event_at
    FROM base
    GROUP BY sender_id
  ),
  latest_conv AS (
    SELECT DISTINCT ON (b.sender_id)
      b.sender_id,
      b.conversation_id AS last_conversation_id
    FROM base b
    ORDER BY b.sender_id, b.created_at DESC
  )
  SELECT
    r.sender_id,
    r.attempt_count,
    r.last_event_at,
    l.last_conversation_id
  FROM ranked r
  LEFT JOIN latest_conv l ON l.sender_id = r.sender_id
  ORDER BY r.attempt_count DESC, r.last_event_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;

REVOKE ALL ON FUNCTION public.admin_contact_leak_top_violators(timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_contact_leak_top_violators(timestamptz, integer) TO service_role;
