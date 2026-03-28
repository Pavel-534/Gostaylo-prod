-- =============================================================================
-- 010: Избранные диалоги чата (синхронизация между устройствами)
-- Idempotent. Выполнить в Supabase SQL Editor или через ваш пайплайн миграций.
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_conversation_favorites (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_conversation_favorites_user
  ON chat_conversation_favorites (user_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversation_favorites_conversation
  ON chat_conversation_favorites (conversation_id);

COMMENT ON TABLE chat_conversation_favorites IS 'Персональные избранные диалоги; RLS + проверка участника в API';

-- ─── RLS (клиенты Supabase с anon key); API на service role обходит политики ─
ALTER TABLE chat_conversation_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_conv_fav_select_own ON chat_conversation_favorites;
CREATE POLICY chat_conv_fav_select_own ON chat_conversation_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS chat_conv_fav_insert_own ON chat_conversation_favorites;
CREATE POLICY chat_conv_fav_insert_own ON chat_conversation_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS chat_conv_fav_delete_own ON chat_conversation_favorites;
CREATE POLICY chat_conv_fav_delete_own ON chat_conversation_favorites
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─── RPC: пагинация избранных с сортировкой как в инбоксе ───────────────────
CREATE OR REPLACE FUNCTION public.rpc_chat_conversations_favorites_page(
  p_user_id uuid,
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
    ON f.conversation_id = c.id AND f.user_id = p_user_id
  WHERE
    p_is_staff
    OR (
      c.partner_id IS NOT NULL AND c.partner_id::text = p_user_id::text
    )
    OR (
      c.renter_id IS NOT NULL AND c.renter_id::text = p_user_id::text
    )
    OR (
      c.owner_id IS NOT NULL AND c.owner_id::text = p_user_id::text
    )
    OR (
      c.admin_id IS NOT NULL AND c.admin_id::text = p_user_id::text
    )
  ORDER BY
    c.is_priority DESC NULLS LAST,
    c.last_message_at DESC NULLS LAST,
    c.updated_at DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 20), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.rpc_chat_conversations_favorites_page IS
  'Список избранных бесед пользователя с пагинацией; для staff — все избранные по user_id';

GRANT EXECUTE ON FUNCTION public.rpc_chat_conversations_favorites_page(uuid, integer, integer, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_chat_conversations_favorites_page(uuid, integer, integer, boolean)
  TO authenticated;
