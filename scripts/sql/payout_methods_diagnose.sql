-- Диагностика методов выплата (только чтение, безопасно).
-- Выполните в Supabase: SQL Editor → New query → вставить → Run.
--
-- Ожидание для «Карта РФ» (id = pm-card-ru), если в админке задан процент:
--   fee_type должен быть текстовой меткой enum:  percentage
-- Если там fixed — партнёрский UI закономерно покажет «3.5 RUB», а не «3.5%».

SELECT id,
       name,
       channel,
       fee_type::text AS fee_type,
       value,
       currency,
       min_payout,
       is_active,
       updated_at
FROM public.payout_methods
WHERE id = 'pm-card-ru';

-- Все методы (сверка с тем, что отдаёт API)
SELECT id, name, fee_type::text AS fee_type, value, currency, min_payout
FROM public.payout_methods
ORDER BY id;

-- ---------------------------------------------------------------------------
-- РУЧНОЕ исправление (только если SELECT показал fee_type = fixed, а нужен %).
-- Сначала убедитесь, что комиссия действительно процентная, не фикс в рублях.
-- Раскомментируйте и выполните ОДИН раз:
--
-- UPDATE public.payout_methods
-- SET fee_type = 'percentage',
--     updated_at = now()
-- WHERE id = 'pm-card-ru';
--
-- Проверка после UPDATE:
-- SELECT id, fee_type::text, value, currency FROM public.payout_methods WHERE id = 'pm-card-ru';
