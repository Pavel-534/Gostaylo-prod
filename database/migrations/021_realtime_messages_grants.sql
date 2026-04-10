-- ===========================================================================
-- 021: Realtime — GRANT SELECT на messages (идемпотентно)
-- ===========================================================================
-- Realtime для postgres_changes проверяет RLS как роль authenticated/anon;
-- явный GRANT SELECT не ослабляет RLS — он только разрешает попытку чтения строки.
--
-- REPLICA IDENTITY FULL уже в 020_realtime_publication_fix.sql; здесь дублируем
-- безопасно (повторный ALTER — no-op по смыслу).
--
-- RLS: политика SELECT на messages должна включать участников беседы и/или
-- is_admin() — см. миграции чата. Если admin не видит события, проверьте
-- profiles.id = auth.uid()::text для JWT субъекта.
--
-- ЗАПУСТИТЬ в Supabase SQL Editor при необходимости.
-- ===========================================================================

ALTER TABLE public.messages REPLICA IDENTITY FULL;

GRANT SELECT ON TABLE public.messages TO authenticated;
GRANT SELECT ON TABLE public.messages TO anon;
