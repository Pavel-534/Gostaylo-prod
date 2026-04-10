-- ===========================================================================
-- 020: Realtime Publication Fix (идемпотентно)
-- ===========================================================================
-- Supabase: таблицы могут уже быть в `supabase_realtime` — повторный
-- ADD TABLE даёт ERROR 42710. Ниже — только добавление, если ещё нет в публикации.
--
-- REPLICA IDENTITY FULL — безопасно выполнять повторно.
--
-- ЗАПУСТИТЬ в Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- ===========================================================================

-- 1. Текущее состояние (можно выполнить отдельно для просмотра)
-- SELECT pubname, schemaname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime' AND tablename IN ('messages', 'conversations');

-- 2. Добавить в публикацию только если ещё не добавлены
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;

-- 3. Полные события для UPDATE/DELETE (идемпотентно)
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- 4. Проверка
SELECT
  pt.tablename,
  c.relreplident,
  CASE c.relreplident
    WHEN 'd' THEN 'DEFAULT (pk only)'
    WHEN 'f' THEN 'FULL'
    WHEN 'n' THEN 'NOTHING'
    WHEN 'i' THEN 'INDEX'
    ELSE 'unknown'
  END AS replica_identity_label
FROM pg_publication_tables pt
JOIN pg_namespace n ON n.nspname = pt.schemaname
JOIN pg_class c ON c.relname = pt.tablename AND c.relnamespace = n.oid
WHERE pt.pubname = 'supabase_realtime'
  AND pt.tablename IN ('messages', 'conversations')
ORDER BY pt.tablename;
