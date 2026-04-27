-- Stage 72.3 — partner activation wiring, 2-level MLM split, payout admin toggles.

-- Allow multiple host-activation bonus rows per booking (L1/L2 uplines).
ALTER TABLE public.referral_ledger
  DROP CONSTRAINT IF EXISTS referral_ledger_booking_type_rt_unique;

ALTER TABLE public.referral_ledger
  ADD CONSTRAINT referral_ledger_booking_type_rt_referrer_unique
  UNIQUE (booking_id, type, referral_type, referrer_id);

CREATE INDEX IF NOT EXISTS idx_referral_ledger_referral_type_status
  ON public.referral_ledger (referral_type, status, created_at DESC);

ALTER TABLE public.marketing_promo_tank_ledger
  DROP CONSTRAINT IF EXISTS marketing_promo_tank_ledger_entry_type_check;

ALTER TABLE public.marketing_promo_tank_ledger
  ADD CONSTRAINT marketing_promo_tank_ledger_entry_type_check CHECK (
    entry_type IN (
      'organic_topup',
      'referral_boost_debit',
      'manual_topup',
      'manual_debit',
      'welcome_bonus_return',
      'host_activation_bonus_debit'
    )
  );

-- Settings defaults for supply-side activation bonus and 2-level MLM split.
UPDATE public.system_settings
SET value =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(value, '{}'::jsonb),
        '{partner_activation_bonus}',
        to_jsonb(
          coalesce(
            nullif(trim(coalesce(value ->> 'partner_activation_bonus', '')), '')::numeric,
            500
          )
        ),
        true
      ),
      '{mlm_level1_percent}',
      to_jsonb(
        coalesce(
          nullif(trim(coalesce(value ->> 'mlm_level1_percent', '')), '')::numeric,
          70
        )
      ),
      true
    ),
    '{mlm_level2_percent}',
    to_jsonb(
      coalesce(
        nullif(trim(coalesce(value ->> 'mlm_level2_percent', '')), '')::numeric,
        30
      )
    ),
    true
  ),
  updated_at = now()
WHERE key = 'general';

