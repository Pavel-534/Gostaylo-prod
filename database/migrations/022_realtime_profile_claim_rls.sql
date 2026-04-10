-- ===========================================================================
-- 022: Realtime JWT profile_id claim + RLS alignment for chat tables
-- ===========================================================================
-- Цель:
-- 1) RLS опирается на profile_id из JWT claim (а не только auth.uid()).
-- 2) Вернуть RLS на messages после временной отладки.
-- 3) Обновить is_admin() под новый источник идентификатора.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  pid text;
BEGIN
  BEGIN
    claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    claims := NULL;
  END;

  pid := NULLIF(BTRIM(COALESCE(claims->>'profile_id', claims->>'userId', claims->>'user_id', '')), '');
  IF pid IS NOT NULL THEN
    RETURN pid;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    RETURN auth.uid()::text;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid text;
BEGIN
  pid := public.current_profile_id();
  IF pid IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = pid
      AND role = 'ADMIN'
  );
END;
$$;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "messages_select_own" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;

CREATE POLICY "messages_select_own"
ON public.messages
FOR SELECT
TO public
USING (
  auth.role() = 'service_role'
  OR sender_id = public.current_profile_id()
  OR public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (
        c.owner_id = public.current_profile_id()
        OR c.partner_id = public.current_profile_id()
        OR c.renter_id = public.current_profile_id()
        OR c.admin_id = public.current_profile_id()
      )
  )
);

CREATE POLICY "messages_insert_own"
ON public.messages
FOR INSERT
TO public
WITH CHECK (
  auth.role() = 'service_role'
  OR sender_id = public.current_profile_id()
  OR public.is_admin()
);

CREATE POLICY "messages_update_own"
ON public.messages
FOR UPDATE
TO public
USING (
  auth.role() = 'service_role'
  OR sender_id = public.current_profile_id()
  OR public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (
        c.owner_id = public.current_profile_id()
        OR c.partner_id = public.current_profile_id()
        OR c.renter_id = public.current_profile_id()
        OR c.admin_id = public.current_profile_id()
      )
  )
);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_auth" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_own" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_own" ON public.conversations;

CREATE POLICY "conversations_select_own"
ON public.conversations
FOR SELECT
TO public
USING (
  auth.role() = 'service_role'
  OR public.is_admin()
  OR owner_id = public.current_profile_id()
  OR partner_id = public.current_profile_id()
  OR renter_id = public.current_profile_id()
  OR admin_id = public.current_profile_id()
);

CREATE POLICY "conversations_insert_auth"
ON public.conversations
FOR INSERT
TO public
WITH CHECK (
  auth.role() = 'service_role'
  OR public.is_admin()
  OR owner_id = public.current_profile_id()
  OR partner_id = public.current_profile_id()
  OR renter_id = public.current_profile_id()
  OR admin_id = public.current_profile_id()
);

CREATE POLICY "conversations_update_own"
ON public.conversations
FOR UPDATE
TO public
USING (
  auth.role() = 'service_role'
  OR public.is_admin()
  OR owner_id = public.current_profile_id()
  OR partner_id = public.current_profile_id()
  OR renter_id = public.current_profile_id()
  OR admin_id = public.current_profile_id()
);
