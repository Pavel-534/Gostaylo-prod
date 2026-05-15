-- Stage 051 — RLS Cleanup & Standardization (after 047-050)
-- Цель: убрать дубли, старые политики и рекурсию. Сделать RLS чистым и предсказуемым.
-- Безопасность: idempotent, с логами, не удаляет данные.

-- =============================================================================
-- 1. Включаем RLS на ключевых таблицах (если вдруг выключен)
-- =============================================================================
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Удаляем ВСЕ старые политики (чистим хаос)
-- =============================================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN 
    SELECT tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN ('profiles', 'listings', 'bookings', 'system_settings')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    RAISE NOTICE 'Dropped policy % on table %', r.policyname, r.tablename;
  END LOOP;
END $$;

-- =============================================================================
-- 3. Пересоздаём чистые политики
-- =============================================================================

-- Profiles
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO public
  USING (auth.role() = 'service_role' OR public.is_admin() OR id = public.current_profile_id());

CREATE POLICY profiles_update_self_or_admin ON public.profiles
  FOR UPDATE TO public
  USING (auth.role() = 'service_role' OR public.is_admin() OR id = public.current_profile_id())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin() OR id = public.current_profile_id());

-- Listings
CREATE POLICY listings_select_catalog_or_owner ON public.listings
  FOR SELECT TO public
  USING (auth.role() = 'service_role' OR public.is_admin() OR owner_id = public.current_profile_id() OR status = 'ACTIVE');

CREATE POLICY listings_insert_owner ON public.listings
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin() OR owner_id = public.current_profile_id());

CREATE POLICY listings_update_owner_or_admin ON public.listings
  FOR UPDATE TO public
  USING (auth.role() = 'service_role' OR public.is_admin() OR owner_id = public.current_profile_id())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin() OR owner_id = public.current_profile_id());

CREATE POLICY listings_delete_owner_or_admin ON public.listings
  FOR DELETE TO public
  USING (auth.role() = 'service_role' OR public.is_admin() OR owner_id = public.current_profile_id());

-- Bookings (упрощённо)
CREATE POLICY bookings_select_party ON public.bookings
  FOR SELECT TO public
  USING (auth.role() = 'service_role' OR public.is_admin() OR renter_id = public.current_profile_id() 
         OR partner_id = public.current_profile_id() 
         OR EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND l.owner_id = public.current_profile_id()));

CREATE POLICY bookings_insert_as_renter ON public.bookings
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin() OR renter_id = public.current_profile_id());

-- System Settings (строго)
CREATE POLICY system_settings_staff_only ON public.system_settings
  FOR ALL TO public
  USING (auth.role() = 'service_role' OR public.is_admin());

-- =============================================================================
-- 4. Финальные проверки
-- =============================================================================
SELECT 'RLS Cleanup completed. Stage 051 done.' as status;

-- Проверка (должно быть 0 строк для anon)
-- SELECT * FROM profiles LIMIT 1;
-- SELECT * FROM listings LIMIT 1;
