-- Stage 70.5 — last message per booking thread for order-card preview (DISTINCT ON).
-- Run in Supabase SQL editor or via deploy pipeline. Idempotent.
--
-- Parameter is text[] (not uuid[]) because legacy DBs store messages.conversation_id as TEXT.
-- JS passes string IDs from bookings.conversation_id; comparison uses ::text so UUID columns work too.
-- message_id / sender_id as TEXT: legacy schemas may use TEXT instead of UUID for messages.id / sender_id.

DROP FUNCTION IF EXISTS public.booking_conversation_last_messages(uuid[]);

CREATE OR REPLACE FUNCTION public.booking_conversation_last_messages(p_conversation_ids text[])
RETURNS TABLE (
  conversation_id text,
  message_id text,
  content text,
  message_body text,
  type text,
  sender_id text,
  created_at timestamptz,
  read_at_renter timestamptz,
  read_at_partner timestamptz,
  is_read boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id::text,
    m.id::text,
    NULLIF(trim(COALESCE(m.content, '')), ''),
    m.message,
    COALESCE(m.type, 'text'),
    m.sender_id::text,
    m.created_at,
    m.read_at_renter,
    m.read_at_partner,
    COALESCE(m.is_read, false)
  FROM public.messages m
  WHERE m.conversation_id::text = ANY (COALESCE(p_conversation_ids, ARRAY[]::text[]))
  ORDER BY m.conversation_id, m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.booking_conversation_last_messages(text[]) IS
  'Stage 70.5: latest message row per conversation for booking list / order card chat preview.';

GRANT EXECUTE ON FUNCTION public.booking_conversation_last_messages(text[]) TO service_role;
