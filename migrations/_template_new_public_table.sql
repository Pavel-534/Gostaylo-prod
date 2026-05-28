-- =============================================================================
-- TEMPLATE — new table in public schema (GoStayLo / FannRent)
-- Copy → migrations/stageNNN_your_feature.sql
--
-- Supabase (с 2026-10-30 на существующих проектах): без явного GRANT таблица
-- НЕ видна Data API (PostgREST, supabase-js anon/authenticated).
-- GRANT и RLS — разные слои; оба обязательны.
--
-- SSOT примеров: stage121_0_rls_security_sweep.sql, 047_stage94_*, 021_*_grants.sql
-- Чеклист: migrations/README.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) TABLE (profiles.id / listings.id / bookings — TEXT в проде, не uuid без проверки)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.your_table (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.your_table IS '…';

-- -----------------------------------------------------------------------------
-- B) GRANTS — выберите ОДИН профиль ниже (раскомментируйте нужный блок)
-- -----------------------------------------------------------------------------

-- B1) Backend-only (финансы, ledger, internal ops) — только service_role в API
GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO service_role;
-- anon / authenticated: без grant → permission denied (желательно)

-- B2) User-scoped (пуш-токены, избранное, личные данные)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO service_role;
-- GRANT SELECT ON public.your_table TO anon;  -- только если реально нужен anon read

-- B3) Public catalog read (как categories: активные строки для витрины)
-- GRANT SELECT ON public.your_table TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO service_role;

-- -----------------------------------------------------------------------------
-- C) RLS — всегда после GRANT
-- -----------------------------------------------------------------------------
ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;

-- C1) Backend-only — политики не нужны (deny anon/authenticated по умолчанию)

-- C2) User-scoped policies (пример)
-- DROP POLICY IF EXISTS stageNNN_your_table_own ON public.your_table;
-- CREATE POLICY stageNNN_your_table_own ON public.your_table
--   FOR ALL TO public
--   USING (
--     auth.role() = 'service_role'
--     OR public.is_admin()
--     OR user_id::text = public.current_profile_id()
--   )
--   WITH CHECK (
--     auth.role() = 'service_role'
--     OR public.is_admin()
--     OR user_id::text = public.current_profile_id()
--   );

-- C3) Listing owner via join (seasonal_prices / calendar_blocks pattern)
-- CREATE POLICY stageNNN_your_table_listing_owner ON public.your_table
--   FOR ALL TO public
--   USING (
--     auth.role() = 'service_role'
--     OR public.is_admin()
--     OR EXISTS (
--       SELECT 1 FROM public.listings l
--       WHERE l.id = your_table.listing_id
--         AND l.owner_id::text = public.current_profile_id()
--     )
--   )
--   WITH CHECK ( /* same */ );

-- -----------------------------------------------------------------------------
-- D) Indexes / triggers (по необходимости)
-- -----------------------------------------------------------------------------
-- CREATE INDEX IF NOT EXISTS idx_your_table_user_id ON public.your_table(user_id);
