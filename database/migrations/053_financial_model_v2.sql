-- Stage 97.0.1 + 97.0.2 — Financial Model v2.0 (ADR-097)
-- Pricing profiles SSOT, ledger RUB reporting columns, payout batch scaffolding.
-- Does NOT wire application logic; seeds + schema only.

-- =============================================================================
-- 1) pricing_profiles — SSOT for fee / internal split / FX markup %
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pricing_profiles (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  description             TEXT,
  guest_fee_pct           NUMERIC(5, 2) NOT NULL,
  host_fee_pct            NUMERIC(5, 2) NOT NULL DEFAULT 0,
  fx_markup_pct           NUMERIC(5, 2) NOT NULL,
  ru_agent_share_pct      NUMERIC(5, 2) NOT NULL,
  kr_service_share_pct    NUMERIC(5, 2) NOT NULL,
  insurance_fund_pct      NUMERIC(5, 2) NOT NULL DEFAULT 0.5,
  tax_rate_pct            NUMERIC(5, 2) NOT NULL DEFAULT 0,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  is_default              BOOLEAN NOT NULL DEFAULT FALSE,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pricing_profiles_pct_range_chk CHECK (
    guest_fee_pct >= 0 AND guest_fee_pct <= 100
    AND host_fee_pct >= 0 AND host_fee_pct <= 100
    AND fx_markup_pct >= 0 AND fx_markup_pct <= 50
    AND ru_agent_share_pct >= 0 AND ru_agent_share_pct <= 100
    AND kr_service_share_pct >= 0 AND kr_service_share_pct <= 100
    AND insurance_fund_pct >= 0 AND insurance_fund_pct <= 100
    AND tax_rate_pct >= 0 AND tax_rate_pct <= 100
  ),
  CONSTRAINT pricing_profiles_internal_split_sum_chk CHECK (
    ABS((ru_agent_share_pct + kr_service_share_pct) - guest_fee_pct) < 0.01
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_profiles_one_default_uq
  ON public.pricing_profiles (is_default)
  WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS pricing_profiles_active_idx
  ON public.pricing_profiles (is_active)
  WHERE is_active = TRUE;

COMMENT ON TABLE public.pricing_profiles IS
  'Stage 97 — SSOT for guest/host fee %, FX markup %, and internal RU/KG split (ru+kr=guest_fee). Internal split is admin/compliance only.';
COMMENT ON COLUMN public.pricing_profiles.ru_agent_share_pct IS
  'Internal: RU agency share (% of subtotal). Must sum with kr_service_share_pct to guest_fee_pct. Not shown to partners/guests.';
COMMENT ON COLUMN public.pricing_profiles.kr_service_share_pct IS
  'Internal: KG service share (% of subtotal). Not shown to partners/guests.';
COMMENT ON COLUMN public.pricing_profiles.fx_markup_pct IS
  'Retail FX spread % applied when building customer rate (PricingEngine v2). Separate from ru/kr guest-fee split.';

-- =============================================================================
-- 2) pricing_profile_assignments — regional / market overrides (Sochi, KZ, Dubai, …)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pricing_profile_assignments (
  id                  TEXT PRIMARY KEY,
  pricing_profile_id  TEXT NOT NULL REFERENCES public.pricing_profiles (id) ON DELETE RESTRICT,
  scope_type          TEXT NOT NULL CHECK (scope_type IN ('COUNTRY', 'REGION', 'CITY', 'DISTRICT')),
  scope_key           TEXT NOT NULL,
  priority            INT NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pricing_profile_assignments_scope_key_nonempty CHECK (length(trim(scope_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_profile_assignments_scope_uq
  ON public.pricing_profile_assignments (scope_type, scope_key)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS pricing_profile_assignments_profile_idx
  ON public.pricing_profile_assignments (pricing_profile_id);

COMMENT ON TABLE public.pricing_profile_assignments IS
  'Maps geography (ISO country, region code, city slug, district) to a pricing_profile. Higher priority wins ties.';

-- =============================================================================
-- 3) Link profiles / listings to pricing_profiles
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pricing_profile_id TEXT REFERENCES public.pricing_profiles (id) ON DELETE SET NULL;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS pricing_profile_id TEXT REFERENCES public.pricing_profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_pricing_profile_id_idx
  ON public.profiles (pricing_profile_id)
  WHERE pricing_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS listings_pricing_profile_id_idx
  ON public.listings (pricing_profile_id)
  WHERE pricing_profile_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.pricing_profile_id IS
  'Optional partner-level pricing profile override (Stage 97).';
COMMENT ON COLUMN public.listings.pricing_profile_id IS
  'Optional listing-level pricing profile override (most specific).';

-- =============================================================================
-- 4) Trigger: enforce ru_agent_share_pct + kr_service_share_pct = guest_fee_pct
--    (redundant with CHECK; fires on INSERT/UPDATE with clearer error message)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pricing_profiles_validate_internal_split()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF ABS((NEW.ru_agent_share_pct + NEW.kr_service_share_pct) - NEW.guest_fee_pct) >= 0.01 THEN
    RAISE EXCEPTION
      'pricing_profiles_internal_split_invalid: ru_agent_share_pct (%) + kr_service_share_pct (%) must equal guest_fee_pct (%)',
      NEW.ru_agent_share_pct,
      NEW.kr_service_share_pct,
      NEW.guest_fee_pct
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pricing_profiles_validate_internal_split ON public.pricing_profiles;

CREATE TRIGGER trg_pricing_profiles_validate_internal_split
  BEFORE INSERT OR UPDATE OF guest_fee_pct, ru_agent_share_pct, kr_service_share_pct
  ON public.pricing_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.pricing_profiles_validate_internal_split();

-- =============================================================================
-- 5) ledger_entries — RUB reporting columns (accountant / compliance export)
-- =============================================================================

ALTER TABLE public.ledger_entries
  ADD COLUMN IF NOT EXISTS amount_total_rub NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS ru_fee_income_rub NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS kr_fee_income_rub NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS fx_markup_income_rub NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS host_payout_base_currency TEXT;

COMMENT ON COLUMN public.ledger_entries.amount_total_rub IS
  'Stage 97: guest capture total in RUB equivalent at posting FX (nullable until ledger v2 posting).';
COMMENT ON COLUMN public.ledger_entries.ru_fee_income_rub IS
  'Stage 97: RU agency fee income (RUB) for compliance reports; internal split.';
COMMENT ON COLUMN public.ledger_entries.kr_fee_income_rub IS
  'Stage 97: KG service fee income (RUB) for compliance reports; internal split.';
COMMENT ON COLUMN public.ledger_entries.fx_markup_income_rub IS
  'Stage 97: FX markup income (RUB) attributed to KG entity at posting time.';
COMMENT ON COLUMN public.ledger_entries.host_payout_base_currency IS
  'Currency code for partner payout leg on this line (THB, USDT, RUB, USD).';

-- Ledger accounts for RU/KG split (posting logic — Stage 97.0.4)
INSERT INTO public.ledger_accounts (id, code, partner_id, display_name, account_type)
VALUES
  (
    'la-sys-platform-fee-ru',
    'PLATFORM_FEE_RU_AGENT',
    NULL,
    'Platform fee — RU agency (internal)',
    'SYSTEM'
  ),
  (
    'la-sys-platform-fee-kg',
    'PLATFORM_FEE_KG_SERVICE',
    NULL,
    'Platform fee — KG service (internal)',
    'SYSTEM'
  ),
  (
    'la-sys-fx-markup-kg',
    'FX_MARKUP_REVENUE_KG',
    NULL,
    'FX markup revenue — KG (internal)',
    'SYSTEM'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 6) payout_batches + payout_batch_items (mass payout registry)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payout_batches (
  id                TEXT PRIMARY KEY,
  status            TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'LOCKED', 'EXPORTED', 'SETTLED', 'FAILED', 'CANCELLED')),
  rail              TEXT NOT NULL,
  scheduled_for     DATE,
  totals_thb        NUMERIC(14, 2),
  totals_rub        NUMERIC(14, 2),
  totals_usd        NUMERIC(14, 2),
  item_count        INT NOT NULL DEFAULT 0,
  export_file_ref   TEXT,
  export_checksum   TEXT,
  locked_at         TIMESTAMPTZ,
  exported_at       TIMESTAMPTZ,
  settled_at        TIMESTAMPTZ,
  created_by        TEXT REFERENCES public.profiles (id) ON DELETE SET NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payout_batches_status_scheduled_idx
  ON public.payout_batches (status, scheduled_for);

COMMENT ON TABLE public.payout_batches IS
  'Stage 97 — mass payout registry (Mon/Thu windows). TBANK_RU | KG_CRYPTO | SWIFT | THB_LOCAL etc.';
COMMENT ON COLUMN public.payout_batches.rail IS
  'Payout rail identifier; maps to RegistryExporter plugin in application layer.';

CREATE TABLE IF NOT EXISTS public.payout_batch_items (
  id                TEXT PRIMARY KEY,
  batch_id          TEXT NOT NULL REFERENCES public.payout_batches (id) ON DELETE CASCADE,
  booking_id        TEXT NOT NULL REFERENCES public.bookings (id) ON DELETE RESTRICT,
  partner_id        TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  amount_thb        NUMERIC(14, 2) NOT NULL CHECK (amount_thb >= 0),
  amount_rub        NUMERIC(14, 2),
  payout_currency   TEXT,
  status            TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'LOCKED', 'EXPORTED', 'SETTLED', 'FAILED', 'SKIPPED')),
  ledger_journal_id TEXT REFERENCES public.ledger_journals (id) ON DELETE SET NULL,
  payout_id         TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payout_batch_items_batch_booking_uq UNIQUE (batch_id, booking_id)
);

CREATE INDEX IF NOT EXISTS payout_batch_items_batch_idx ON public.payout_batch_items (batch_id);
CREATE INDEX IF NOT EXISTS payout_batch_items_partner_idx ON public.payout_batch_items (partner_id);
CREATE INDEX IF NOT EXISTS payout_batch_items_booking_idx ON public.payout_batch_items (booking_id);

COMMENT ON TABLE public.payout_batch_items IS
  'Line items in a payout batch; one booking per batch row (partner net / transit amount).';

-- Optional booking status for payout pipeline (metadata-first; enum for queries)
DO $$
BEGIN
  ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'READY_FOR_PAYOUT';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'booking_status READY_FOR_PAYOUT already exists';
END $$;

-- =============================================================================
-- 7) system_settings — default pricing profile + FX quote TTL (SSOT hooks)
-- =============================================================================

UPDATE public.system_settings
SET
  value = jsonb_set(
    jsonb_set(
      COALESCE(value, '{}'::jsonb),
      '{default_pricing_profile_id}',
      '"pp-global-default"'::jsonb,
      true
    ),
    '{fx_quote_ttl_seconds}',
    COALESCE(value->'fx_quote_ttl_seconds', '7200'::jsonb),
    true
  ),
  updated_at = NOW()
WHERE key = 'general';

-- =============================================================================
-- 8) Seed pricing profiles (values live in DB only — not in application code)
-- =============================================================================

INSERT INTO public.pricing_profiles (
  id,
  name,
  description,
  guest_fee_pct,
  host_fee_pct,
  fx_markup_pct,
  ru_agent_share_pct,
  kr_service_share_pct,
  insurance_fund_pct,
  tax_rate_pct,
  is_active,
  is_default
)
VALUES
  (
    'pp-global-default',
    'Global Default (RU-KG-TH)',
    'Default transborder profile: 15% guest fee split 7% RU + 8% KG, 3% FX markup.',
    15.00,
    0.00,
    3.00,
    7.00,
    8.00,
    0.50,
    0.00,
    TRUE,
    TRUE
  ),
  (
    'pp-thailand-standard',
    'Thailand Standard',
    'Standard TH supply; same internal split as global until regional tuning.',
    15.00,
    0.00,
    2.50,
    7.00,
    8.00,
    0.50,
    0.00,
    TRUE,
    FALSE
  ),
  (
    'pp-special-zero-host',
    'Special 0% Host',
    'Promotional host commission 0%; guest fee split unchanged.',
    15.00,
    0.00,
    3.00,
    7.00,
    8.00,
    0.50,
    0.00,
    TRUE,
    FALSE
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  guest_fee_pct = EXCLUDED.guest_fee_pct,
  host_fee_pct = EXCLUDED.host_fee_pct,
  fx_markup_pct = EXCLUDED.fx_markup_pct,
  ru_agent_share_pct = EXCLUDED.ru_agent_share_pct,
  kr_service_share_pct = EXCLUDED.kr_service_share_pct,
  insurance_fund_pct = EXCLUDED.insurance_fund_pct,
  tax_rate_pct = EXCLUDED.tax_rate_pct,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();

-- Example regional assignment (extensible without code changes)
INSERT INTO public.pricing_profile_assignments (
  id,
  pricing_profile_id,
  scope_type,
  scope_key,
  priority,
  is_active
)
VALUES
  (
    'ppa-country-th',
    'pp-thailand-standard',
    'COUNTRY',
    'TH',
    10,
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 9) RLS — staff / service_role only (mirror system_settings)
-- =============================================================================

ALTER TABLE public.pricing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_profile_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_batch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pricing_profiles_staff_all ON public.pricing_profiles;
DROP POLICY IF EXISTS pricing_profile_assignments_staff_all ON public.pricing_profile_assignments;
DROP POLICY IF EXISTS payout_batches_staff_all ON public.payout_batches;
DROP POLICY IF EXISTS payout_batch_items_staff_all ON public.payout_batch_items;

CREATE POLICY pricing_profiles_staff_all ON public.pricing_profiles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY pricing_profile_assignments_staff_all ON public.pricing_profile_assignments
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY payout_batches_staff_all ON public.payout_batches
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY payout_batch_items_staff_all ON public.payout_batch_items
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
