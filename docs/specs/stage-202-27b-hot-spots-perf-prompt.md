# Stage 202.27b — Referral hot spots perf (follow-up 202.27) — Промт для Cursor

**Зачем:** 01.09.2026 health audit (см. `docs/audits/stage-referral-health-2026-09-01.md`) и Stage 202.27 review (см. `docs/specs/stage-202-27-engagement-perf-prompt.md`) выявили **3 hot spots вне scope 202.27**:
1. **`loadQualifiedHostSets`** — для каждого L1-приглашённого тянет `bookings` COMPLETED по всем `refereeIds`. При 100+ инвайтах = 100+ параллельных/последовательных DB reads.
2. **`getMonthlyGuestReferralSpendThb`** — Node reduce по всем matching rows (тот же паттерн, что был в `sumReferralEarnedThb` до 202.27). Audit P1.
3. **`me/rank`** — full month ledger в Node. **Отдельный этап** (вне 202.27b).

Эти hot spots активны при soft-launch (если у реферера >50 qualified hosts), но при росте — основной bottleneck. Фиксим сейчас, пока не горит.

**Скоуп:** read-only perf follow-up, БЕЗ money changes, БЕЗ RBAC, БЕЗ UI logic. БЕЗ `me/rank` (отдельный этап). Можно с DB migration для новых RPC.

---

## Что строим

1. **RPC `count_qualified_host_completed_bookings(p_referee_ids text[])`** — SQL aggregate для `bookings` COMPLETED по списку referee IDs
2. **RPC `monthly_guest_referral_spend_thb(p_referrer_id text, p_year int, p_month int)`** — SQL aggregate для monthly cap
3. **`loadQualifiedHostSets` refactor** — заменить per-referee fetch на один SQL aggregate
4. **`getMonthlyGuestReferralSpendThb` refactor** — Node reduce → `.rpc()`
5. **Fallback** — `LegacyXxx` reducer + warn once (как в 202.27)
6. **Тесты** — regression: Node sum === SQL sum, на разных размерах dataset
7. **Runbook + ops script** — `explain-analyze-referral-hot-spots.mjs` (опционально)

---

## Не делать (явно)

- ❌ Не менять definitions (qualified host, network depth, L3 gate)
- ❌ Не менять thresholds tier'ов
- ❌ Не менять money formulas, split, pool, cap
- ❌ Не менять RBAC
- ❌ Не менять ledger
- ❌ Не лезть в Stage 202.21/202.22/202.23/202.24/202.25/202.26/202.27 (не трогать)
- ❌ Не трогать `me/rank` (отдельный этап, не 202.27b)
- ❌ Не делать N+1 устранение через другие подходы (cursor loops, batch size, etc.) — **только SQL aggregate**
- ❌ Не удалять существующие индексы (только добавлять)
- ❌ Не делать full re-indexing / VACUUM

---

## Архитектура

### Новые файлы

```
migrations/stage202_27b_count_qualified_host_completed_bookings_rpc.sql
migrations/stage202_27b_monthly_guest_referral_spend_thb_rpc.sql
__tests__/stage-202-27b-hot-spots-perf.test.js                  # 8+ тестов
scripts/explain-analyze-referral-hot-spots.mjs                 # опционально, для ops
```

### Файлы, которые трогаем

```
lib/referral/qualified-host-metrics.js                         # loadQualifiedHostSets → RPC
lib/services/finance/fintech-snapshot-freeze.service.js        # если использует getMonthlyGuestReferralSpendThb
... (другие callers getMonthlyGuestReferralSpendThb — grep в кодовой базе)
```

### Файлы, которые НЕ трогаем (SSOT)

- `lib/services/finance/fintech-waterfall.js` (waterfall)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M, имеет свой RPC)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-tier-sync.service.js` (PARTNER role)
- `lib/services/finance/fintech-snapshot.service.js` (Stage 202.25)
- `lib/services/finance/fintech-snapshot-freeze.service.js` (Stage 202.25)
- `lib/services/admin/local-leader-region.service.js` (Stage 202.23)
- `lib/referral/partner-metrics-glossary.js` (Stage 202.26)
- `lib/admin/money-write-audit.js` (Stage 202.24)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on/insurance 0.5)
- `app/api/v2/referral/me/rank/route.js` (отдельный этап, **не 202.27b**)
- Live data
- ADR-131, ADR-131A, ADR-131-reference

---

## Требования

### 1. RPC `count_qualified_host_completed_bookings(p_referee_ids text[])`

**Pattern** (как `referral_program_cap_reserve`):

```sql
CREATE OR REPLACE FUNCTION public.count_qualified_host_completed_bookings(
  p_referee_ids text[]
)
RETURNS TABLE (referee_id text, completed_count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    rid::text AS referee_id,
    COUNT(b.id)::bigint AS completed_count
  FROM unnest(p_referee_ids) AS rid
  LEFT JOIN public.bookings b
    ON b.partner_id = rid::text
    AND b.status = 'COMPLETED'
  GROUP BY rid;
$$;

GRANT EXECUTE ON FUNCTION public.count_qualified_host_completed_bookings(text[])
  TO service_role;
```

**Использование:**
```js
const { data, error } = await supabaseAdmin.rpc(
  'count_qualified_host_completed_bookings',
  { p_referee_ids: refereeIds },  // text[]
)
// data: [{ referee_id, completed_count }, ...]
```

**Покрытие индексом:** `idx_bookings_partner_completed (partner_id) WHERE status = 'COMPLETED'` (Stage 136) — partial index, оптимален для этого запроса.

### 2. RPC `monthly_guest_referral_spend_thb(p_referrer_id text, p_year int, p_month int)`

**Pattern** (как `referral_earned_thb_total` из Stage 202.27):

```sql
CREATE OR REPLACE FUNCTION public.monthly_guest_referral_spend_thb(
  p_referrer_id text,
  p_year int,
  p_month int
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(ROUND(SUM(amount_thb)::numeric, 2), 0)
  FROM public.referral_ledger
  WHERE referrer_id = p_referrer_id
    AND status IN ('earned', 'earned_held')
    AND EXTRACT(YEAR FROM earned_at AT TIME ZONE 'UTC') = p_year
    AND EXTRACT(MONTH FROM earned_at AT TIME ZONE 'UTC') = p_month;
$$;

GRANT EXECUTE ON FUNCTION public.monthly_guest_referral_spend_thb(text, int, int)
  TO service_role;
```

**Использование:**
```js
const now = new Date()
const { data, error } = await supabaseAdmin.rpc(
  'monthly_guest_referral_spend_thb',
  { 
    p_referrer_id: uid, 
    p_year: now.getUTCFullYear(), 
    p_month: now.getUTCMonth() + 1 
  }
)
```

**Покрытие индексом:** `idx_referral_ledger_referrer_status (referrer_id, status)` (Stage 71) + желательно composite с `earned_at` (проверь, есть ли). Если нет — добавлять **не нужно** в этом этапе (отдельный perf Stage).

### 3. `lib/referral/qualified-host-metrics.js` refactor

**Сначала** grep'ни `loadQualifiedHostSets` в коде. Реально ли он тянет bookings per-referee? Если да:

**Было (примерно):**
```js
// per referee, sequential fetch
for (const rid of refereeIds) {
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('partner_id, updated_at, created_at')
    .eq('status', 'COMPLETED')
    .eq('partner_id', rid)
  // count
}
```

**Стало:**
```js
// Single RPC call
const { data, error } = await supabaseAdmin.rpc(
  'count_qualified_host_completed_bookings',
  { p_referee_ids: refereeIds }
)
const completedCountByReferee = new Map(
  (data || []).map((r) => [r.referee_id, Number(r.completed_count) || 0])
)
// then merge with host_activation data
```

**Fallback** (если RPC не задеплоен): `loadQualifiedHostSetsLegacyReduce` (как в 202.27) + `console.warn` один раз.

**Сначала** проверь реальную реализацию `loadQualifiedHostSets` (lines 60-100 из memory). Возможно там уже `Promise.all` параллелизация — тогда RPC замена всё равно даст win (1 запрос вместо N).

### 4. `getMonthlyGuestReferralSpendThb` refactor

**Сначала** grep'ни `getMonthlyGuestReferralSpendThb` в кодовой базе. Где используется?

Возможные callers:
- `referral-program-cap.service.js` (для cap enforcement)
- `referral-stats.service.js` (для дашборда)
- `referral-payout.service.js` (для accrued проверки)
- `me/rank` route (отдельный этап, не трогаем)

**Было:**
```js
// Node reduce по всем rows
const { data, error } = await supabaseAdmin
  .from('referral_ledger')
  .select('amount_thb, earned_at')
  .eq('referrer_id', uid)
  .in('status', ['earned', 'earned_held'])
  .gte('earned_at', startOfMonth.toISOString())
  .lte('earned_at', endOfMonth.toISOString())
// sum
```

**Стало:**
```js
const { data, error } = await supabaseAdmin.rpc(
  'monthly_guest_referral_spend_thb',
  { p_referrer_id: uid, p_year: y, p_month: m }
)
return data  // numeric, already ROUND 2
```

**Fallback** — `getMonthlyGuestReferralSpendThbLegacyReduce` (Node reduce) + `console.warn` один раз.

### 5. (Опционально) `scripts/explain-analyze-referral-hot-spots.mjs`

**Ops script** для проверки perf:
```js
// Usage: node --import ./scripts/node-test-alias-register.mjs scripts/explain-analyze-referral-hot-spots.mjs
//
// Outputs:
// - EXPLAIN ANALYZE для count_qualified_host_completed_bookings
// - EXPLAIN ANALYZE для monthly_guest_referral_spend_thb
// - Comparison с Node reduce (если возможно)
```

**Не blocker** — nice-to-have для мониторинга.

### 6. Тесты `__tests__/stage-202-27b-hot-spots-perf.test.js`

Минимум 8:

1. `count_qualified_host_completed_bookings` RPC migration SQL содержит `unnest`, `partner_id`, `status = 'COMPLETED'`, `GROUP BY rid`
2. `loadQualifiedHostSets` использует `.rpc('count_qualified_host_completed_bookings')` если RPC deployed
3. `loadQualifiedHostSets` fallback на LegacyReduce если RPC missing
4. `monthly_guest_referral_spend_thb` RPC migration SQL содержит `EXTRACT(YEAR/MONTH FROM earned_at)`
5. `getMonthlyGuestReferralSpendThb` использует `.rpc()` 
6. `getMonthlyGuestReferralSpendThb` fallback на LegacyReduce
7. **Regression**: при mock данных RPC sum === Node sum (multi-dataset test)
8. Existing tests (`loadQualifiedHostSets`, `getMonthlyGuestReferralSpendThb`) still pass

Опционально:
9. Тест с 100+ refereeIds — Node reduce медленнее RPC (perf micro-benchmark, не gate)
10. `loadQualifiedHostSets` возвращает тот же shape, что и до refactor

---

## SSOT — не трогать

- `lib/services/finance/fintech-waterfall.js` (waterfall formula)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M, имеет свой RPC)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-tier-sync.service.js` (PARTNER role)
- `lib/services/finance/fintech-snapshot.service.js` (Stage 202.25)
- `lib/services/finance/fintech-snapshot-freeze.service.js` (Stage 202.25)
- `lib/services/admin/local-leader-region.service.js` (Stage 202.23)
- `lib/referral/partner-metrics-glossary.js` (Stage 202.26)
- `lib/admin/money-write-audit.js` (Stage 202.24)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on/insurance 0.5)
- `app/api/v2/referral/me/rank/route.js` (**отдельный этап**, не 202.27b)
- Live data
- ADR-131, ADR-131A, ADR-131-reference

---

## Smoke на prod (после deploy)

1. **`loadQualifiedHostSets`:** для юзера с 50+ инвайтами — результат **идентичен** до/после (regression)
2. **`getMonthlyGuestReferralSpendThb`:** для текущего месяца — сумма **идентична** до/после
3. **`/engagement` endpoint:** работает как в Stage 202.27
4. **`/me/rank`** (если использует `getMonthlyGuestReferralSpendThb`): **не сломан**
5. **EXPLAIN ANALYZE** на staging: оба RPC используют индексы (`idx_bookings_partner_completed`, `idx_referral_ledger_referrer_status`)
6. **Не сломалось:** Stage 202.21-202.27, Phase A/B FinTech, leaderboard, calculator

---

## Definition of Done

- [ ] 2 RPC migrations применены в FannRent
- [ ] `loadQualifiedHostSets` использует `.rpc('count_qualified_host_completed_bookings')` + LegacyReduce fallback
- [ ] `getMonthlyGuestReferralSpendThb` использует `.rpc('monthly_guest_referral_spend_thb')` + LegacyReduce fallback
- [ ] 8+ unit-тестов pass
- [ ] НЕ тронут `me/rank` (отдельный этап)
- [ ] НЕ тронуты SSOT-сервисы, RBAC, ledger, Stage 202.21-202.27
- [ ] НЕ удалены существующие индексы
- [ ] (Опционально) `scripts/explain-analyze-referral-hot-spots.mjs` готов
- [ ] Git commit: `Stage 202.27b — Referral hot spots perf (loadQualifiedHostSets + getMonthlyGuestReferralSpendThb)`

---

## После мержа (Pavel делает)

1. **Закоммить** Stage 202.27b
2. **Apply migrations** в FannRent через Supabase MCP
3. **Smoke** на dev (6 пунктов) + на prod
4. **Связаться с медиаперсонами** (когда YooKassa подключит)

**Дальше:**
- ADR-300 audit (когда Pavel скажет)
- Stage 202.28 (docs sync) — Cursor через `.cursorrules`
- Stage 202.29b (community i18n currency) — мелкий polish
- Финальный audit рефералки (Pavel упомянул "после готовности её нужно будет ещё проаудировать с помощью Cursor")

---

**Конец промта.** Скопируй и отправь в Cursor. Это **read-only perf**, follow-up Stage 202.27. **Не трогать `me/rank`** (отдельный этап). Если Cursor уточняет — отвечай на основе существующих RPC patterns (`referral_program_cap_reserve`, `referral_earned_thb_total`), `idx_bookings_partner_completed` partial index, FK profiles = TEXT.
