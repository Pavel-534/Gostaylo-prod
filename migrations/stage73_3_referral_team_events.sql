-- Stage 73.3 — лента команды SSOT + TZ/цель профиля + цель месяца в general

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS iana_timezone TEXT;

COMMENT ON COLUMN public.profiles.iana_timezone IS
  'IANA TZ для отчётов реферала (месяц/спарклайн). Пример: Asia/Bangkok';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_monthly_goal_thb NUMERIC(14, 2);

COMMENT ON COLUMN public.profiles.referral_monthly_goal_thb IS
  'Персональная цель дохода за месяц (THB); NULL = только глобальная из system_settings.general';

-- FK-колонки = TEXT: в ряде прод._БД `profiles.id` имеет тип TEXT (см. stage71_referral_system.sql),
-- а не UUID — иначе ERROR 42804 (uuid vs text).
CREATE TABLE IF NOT EXISTS public.referral_team_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id TEXT NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  referee_id TEXT REFERENCES public.profiles (id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_team_events_type_chk CHECK (
    event_type IN (
      'teammate_joined',
      'teammate_first_stay',
      'teammate_new_listing',
      'referral_bonus_earned'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_referral_team_events_referrer_created
  ON public.referral_team_events (referrer_id, created_at DESC);

COMMENT ON TABLE public.referral_team_events IS
  'События для ленты «Моя команда» (referrer_id = владелец ленты).';

-- Исторический backfill: только регистрации по связям
INSERT INTO public.referral_team_events (referrer_id, event_type, referee_id, metadata, created_at)
SELECT
  rr.referrer_id,
  'teammate_joined',
  rr.referee_id,
  '{}'::jsonb,
  rr.referred_at
FROM public.referral_relations rr
WHERE NOT EXISTS (
  SELECT 1
  FROM public.referral_team_events e
  WHERE e.referrer_id = rr.referrer_id
    AND e.referee_id = rr.referee_id
    AND e.event_type = 'teammate_joined'
    AND e.created_at = rr.referred_at
);
