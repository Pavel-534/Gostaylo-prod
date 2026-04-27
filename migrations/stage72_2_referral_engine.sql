-- Stage 72.2 — Referral engine: network depth, ledger referral_type, wallet payout gate.

-- ── Invite tree (who referred whom → depth / ancestor chain) ──────────────────
ALTER TABLE public.referral_relations
  ADD COLUMN IF NOT EXISTS network_depth SMALLINT NOT NULL DEFAULT 1
    CONSTRAINT referral_relations_network_depth_chk CHECK (network_depth >= 1 AND network_depth <= 32),
  ADD COLUMN IF NOT EXISTS ancestor_path JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.referral_relations.network_depth IS
  '1 = прямое приглашение корневым промоутером или первый-hop; растёт по цепочке.';
COMMENT ON COLUMN public.referral_relations.ancestor_path IS
  'Упорядоченный JSON-массив UUID/id профилей от корня сети до прямого пригласителя включительно.';

UPDATE public.referral_relations
SET
  ancestor_path = jsonb_build_array(referrer_id),
  network_depth = 1
WHERE jsonb_array_length(COALESCE(ancestor_path, '[]'::jsonb)) = 0;

-- ── Ledger: guest vs partner-supply attribution ─────────────────────────────────
ALTER TABLE public.referral_ledger
  ADD COLUMN IF NOT EXISTS referral_type TEXT NOT NULL DEFAULT 'guest_booking'
    CONSTRAINT referral_ledger_referral_type_chk CHECK (referral_type IN ('guest_booking', 'host_activation')),
  ADD COLUMN IF NOT EXISTS ledger_depth SMALLINT NOT NULL DEFAULT 1
    CONSTRAINT referral_ledger_depth_chk CHECK (ledger_depth >= 1 AND ledger_depth <= 32);

COMMENT ON COLUMN public.referral_ledger.referral_type IS
  'guest_booking — реферальная экономика по брони гостя; host_activation — бонус за активацию приглашённого партнёра (первая COMPLETED как хозяин).';
COMMENT ON COLUMN public.referral_ledger.ledger_depth IS
  'Снимок глубины из referral_relations на момент записи ledger.';

ALTER TABLE public.referral_ledger DROP CONSTRAINT IF EXISTS referral_ledger_booking_type_key;

ALTER TABLE public.referral_ledger ADD CONSTRAINT referral_ledger_booking_type_rt_unique
  UNIQUE (booking_id, type, referral_type);

UPDATE public.referral_ledger
SET referral_type = 'guest_booking'
WHERE referral_type IS NULL OR referral_type = '';

-- ── Wallet: payout compliance flag (future bank/card payout) ───────────────────
ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS verified_for_payout BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_wallets.verified_for_payout IS
  'Доп. гейт вывода на карту (KYC/compliance); UI использует также profiles.is_verified и wallet_min_payout_thb.';

-- ── Policy defaults ────────────────────────────────────────────────────────────
UPDATE public.system_settings
SET value = jsonb_set(
    coalesce(value, '{}'::jsonb),
    '{wallet_min_payout_thb}',
    to_jsonb(
      coalesce(
        nullif(trim(coalesce(value ->> 'wallet_min_payout_thb', '')), '')::numeric,
        1000
      )
    ),
    true
  ),
  updated_at = now()
WHERE key = 'general';
