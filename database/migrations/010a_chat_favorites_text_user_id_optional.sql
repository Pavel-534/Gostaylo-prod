-- =============================================================================
-- ОПЦИОНАЛЬНО: если в chat_conversation_favorites.user_id используется TEXT
-- (а не UUID как в 010), приведите RPC к параметру text и сравнениям через ::text.
-- Выполняйте только если видите ошибки вызова rpc_chat_conversations_favorites_page
-- или несовпадения типов.
-- =============================================================================

DROP FUNCTION IF EXISTS public.rpc_chat_conversations_favorites_page(uuid, integer, integer, boolean);

CREATE OR REPLACE FUNCTION public.rpc_chat_conversations_favorites_page(
  p_user_id text,
  p_limit integer,
  p_offset integer,
  p_is_staff boolean
)
RETURNS SETOF conversations
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM conversations c
  INNER JOIN chat_conversation_favorites f
    ON f.conversation_id = c.id AND f.user_id::text = p_user_id
  WHERE
    p_is_staff
    OR (
      c.partner_id IS NOT NULL AND c.partner_id::text = p_user_id
    )
    OR (
      c.renter_id IS NOT NULL AND c.renter_id::text = p_user_id
    )
    OR (
      c.owner_id IS NOT NULL AND c.owner_id::text = p_user_id
    )
    OR (
      c.admin_id IS NOT NULL AND c.admin_id::text = p_user_id
    )
  ORDER BY
    c.is_priority DESC NULLS LAST,
    c.last_message_at DESC NULLS LAST,
    c.updated_at DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 20), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

-- Пере-выдать права (имя/сигнатура функции изменилась с uuid на text)
GRANT EXECUTE ON FUNCTION public.rpc_chat_conversations_favorites_page(text, integer, integer, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_chat_conversations_favorites_page(text, integer, integer, boolean)
  TO authenticated;

-- RLS: если user_id — TEXT, а auth.uid() — uuid:
-- DROP POLICY ... и создать заново с USING (auth.uid()::text = user_id);
