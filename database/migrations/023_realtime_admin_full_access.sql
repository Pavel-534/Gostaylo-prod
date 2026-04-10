-- ===========================================================================
-- 023: Emergency admin full access for messages (RLS-enabled realtime)
-- ===========================================================================
-- Цель:
-- - Дать ADMIN полный доступ к messages без ID-сопоставлений (для realtime стабилизации).
-- - Используем claims role из app_role / user_metadata / app_metadata.
-- - Важно: верхнеуровневый JWT claim `role` должен оставаться `authenticated`.
-- ===========================================================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.messages;

CREATE POLICY "Admin full access"
ON public.messages
FOR ALL
TO authenticated
USING (
  COALESCE(
    auth.jwt() ->> 'app_role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'role'
  ) = 'ADMIN'
)
WITH CHECK (
  COALESCE(
    auth.jwt() ->> 'app_role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'role'
  ) = 'ADMIN'
);
