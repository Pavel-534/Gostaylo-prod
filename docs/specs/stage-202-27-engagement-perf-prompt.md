# Stage 202.27 — Engagement perf pass — Промт для Cursor

**Зачем:** 01.09.2026 health audit (см. `docs/audits/stage-referral-health-2026-09-01.md`) нашёл 3 P1/P2 на hot engagement path:
1. **`sumReferralEarnedThb`** — Node reduce по всем matching rows вместо SQL `sum()` (full table scan в худшем случае)
2. **`GET /api/v2/referral/me/engagement` без HTTP/server cache** — read-heavy, каждый hit = 5+ параллельных DB reads
3. **`bookings(partner_id)` без `status`** в composite — `countCompletedBookingsAsHost` фильтрует по `status=COMPLETED` post-index

Soft-launch трафик не критичен, но при росте (>1000 active users) — дорого. Фиксим сейчас, пока не горит.

**Скоуп:** read-only performance, БЕЗ money changes, БЕЗ RBAC, БЕЗ UI logic. Можно с DB migration для нового индекса.

---

## Что строим

1. **SQL aggregate** для `sumReferralEarnedThb` — заменить Node reduce на `.select('amount_thb').eq(...)` + sum
2. **Server cache** для `/engagement` — `unstable_cache` или `Cache-Control: private, max-age=60, stale-while-revalidate=120`
3. **Composite index** `idx_bookings_partner_completed(partner_id, status)` — для `countCompletedBookingsAsHost`
4. (Опционально) **`next/dynamic`** для engagement sub-blоков (Roadmap, Quests) — уменьшить bundle
5. **Тесты** — perf не регрессирует, числа не меняются
6. **Smoke** — engagement endpoint latency < 200ms p95

---

## Не делать (явно)

- ❌ Не менять definitions (qualified host, network depth)
- ❌ Не менять thresholds tier'ов
- ❌ Не менять money formulas, split, pool, cap
- ❌ Не менять RBAC
- ❌ Не менять ledger
- ❌ Не лезть в Stage 202.21/202.22/202.23/202.24/202.25/202.26 (не трогать)
- ❌ Не удалять существующие индексы (только добавлять)
- ❌ Не делать full re-indexing / VACUUM (отдельная задача)

---

## Архитектура

### Новые файлы

```
migrations/stage202_27_idx_bookings_partner_status.sql  # composite index
__tests__/stage-202-27-engagement-perf.test.js          # 6+ тестов
```

### Файлы, которые трогаем

```
lib/referral/qualified-host-metrics.js                      # sumReferralEarnedThb → SQL aggregate
lib/services/marketing/local-leader-metrics.service.js      # buildReferralEngagementPayload → cache aware
app/api/v2/referral/me/engagement/route.js                  # Cache-Control headers
lib/hooks/use-referral-engagement.js                        # staleTime / cacheTime tune (опционально)
components/referral/ReferralLeaderEngagementSection.jsx     # next/dynamic для sub-blocks (опционально)
```

### Файлы, которые НЕ трогаем (SSOT)

- `lib/services/finance/fintech-waterfall.js` (waterfall formula)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-tier-sync.service.js` (PARTNER role)
- `lib/services/finance/fintech-snapshot.service.js` (Stage 202.25)
- `lib/services/finance/fintech-snapshot-freeze.service.js` (Stage 202.25)
- `lib/services/admin/local-leader-region.service.js` (Stage 202.23)
- `lib/referral/partner-metrics-glossary.js` (Stage 202.26)
- `lib/admin/money-write-audit.js` (Stage 202.24)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on/insurance 0.5)
- Live data
- ADR-131, ADR-131A, ADR-131-reference

---

## Требования

### 1. `lib/referral/qualified-host-metrics.js` — SQL aggregate

**Текущая проблема:** `sumReferralEarnedThb` тащит все matching rows в Node и reduce'ит:

```js
const { data, error } = await supabaseAdmin
  .from('referral_ledger')
  .select('amount_thb')
  .eq('referrer_id', uid)
  .in('status', ['earned', 'earned_held'])

if (error) return 0
let sum = 0
for (const row of data || []) sum += Number(row?.amount_thb) || 0
return round2(sum)
```

**Нужно:** использовать Postgres function через RPC, или вычислять через `eq().select('sum')` (если Supabase поддерживает), или создать RPC `sum_referral_earned_thb(referrer_id)`:

**Вариант A: через Supabase RPC (предпочтительно)**
- Создать SQL function `public.sum_referral_earned_thb(p_referrer_id uuid) returns numeric`
- Вызывать через `supabaseAdmin.rpc('sum_referral_earned_thb', { p_referrer_id: uid })`
- `precision: 2` для decimal

**Вариант B: через view (если RPC нельзя)**
- Создать view `public.v_referral_earned_totals` с колонками `referrer_id, total_earned_thb`
- `supabaseAdmin.from('v_referral_earned_totals').select('total_earned_thb').eq('referrer_id', uid).maybeSingle()`

**Сначала проверь** в существующих migrations, есть ли уже похожие helpers (например, `referral_program_cap_reserve` из Stage 202.25 audit). Если есть — следуй их паттерну.

**Сохраняем точно тот же return shape:** `number (rounded 2 decimals)`.

### 2. `app/api/v2/referral/me/engagement/route.js` — cache headers

**Добавить:**

```js
// После NextResponse.json({ success: true, data })
return NextResponse.json({ success: true, data }, {
  headers: {
    'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
  },
})
```

**Альтернатива (если route уже использует `unstable_cache`):**
- `unstable_cache(..., ['engagement', userId], { revalidate: 60, tags: [`engagement:${userId}`] })`
- Revalidate tag при mutation (qualifying host, completed booking)

**Сначала проверь** как делают другие read-heavy routes в проекте (например, `leaderboard/public/route.js` — там уже `unstable_cache`). Следуй их паттерну.

### 3. Migration `migrations/stage202_27_idx_bookings_partner_status.sql`

**Сначала проверь** в существующих migrations, есть ли уже этот индекс. Из audit:
> `idx_bookings_partner_completed (partner_id)` — есть, но без `status`

**Создать:**

```sql
-- Stage 202.27 — composite index для countCompletedBookingsAsHost.
-- Безопасно: если уже есть idx на partner_id — Postgres использует новый.

CREATE INDEX IF NOT EXISTS idx_bookings_partner_status_completed
  ON public.bookings (partner_id, status)
  WHERE status = 'COMPLETED';

-- Альтернативно (если не partial):
-- CREATE INDEX IF NOT EXISTS idx_bookings_partner_status
--   ON public.bookings (partner_id, status);

-- Verify
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM bookings
WHERE partner_id = '<test_uuid>' AND status = 'COMPLETED';
```

**Применить** в FannRent через Supabase MCP после merge.

### 4. (Опционально) `next/dynamic` для engagement sub-blocks

**Сейчас** `ReferralLeaderEngagementSection.jsx` рендерит `LocalLeaderTier`, `QuestsBlock`, `TierRoadmap` сразу.

**Можно:**
```jsx
import dynamic from 'next/dynamic'

const TierRoadmap = dynamic(() => import('./TierRoadmap'), {
  loading: () => <Skeleton />,
  ssr: false,  // roadmap динамический, не нужен в SSR
})
```

**Сначала проверь** как делают другие секции в `app/profile/referral/`. Если уже есть dynamic — следуй паттерну. Иначе **не делать** (опционально, не blocker).

### 5. Тесты `__tests__/stage-202-27-engagement-perf.test.js`

Минимум 6:

1. `sumReferralEarnedThb` через новый путь (RPC или view) returns same value as Node reduce (regression test)
2. `/engagement` route returns `Cache-Control: private, max-age=60, stale-while-revalidate=120`
3. `countCompletedBookingsAsHost` использует composite index (через `EXPLAIN` — если test infra позволяет)
4. Existing engagement tests всё ещё pass (no regression)
5. Если есть `unstable_cache` — cache hit/miss работает правильно
6. Bundle size для `/profile/referral` не вырос (если делаем `next/dynamic`)

Опционально:
7. Perf test: 100 последовательных вызовов `/engagement` < 200ms p95 (если test infra позволяет)

### 6. (Опционально) `lib/hooks/use-referral-engagement.js` — client cache tune

**Сейчас** `staleTime: 60_000` (60s). 

**Можно увеличить до `staleTime: 5 * 60_000`** (5 min) если данные engagement не меняются каждую минуту. Но это client-side cache, не server. **Не обязательно**.

---

## SSOT — не трогать

- `lib/services/finance/fintech-waterfall.js` (waterfall formula)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-tier-sync.service.js` (PARTNER role)
- `lib/services/finance/fintech-snapshot.service.js` (Stage 202.25)
- `lib/services/finance/fintech-snapshot-freeze.service.js` (Stage 202.25)
- `lib/services/admin/local-leader-region.service.js` (Stage 202.23)
- `lib/referral/partner-metrics-glossary.js` (Stage 202.26)
- `lib/admin/money-write-audit.js` (Stage 202.24)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on/insurance 0.5)
- Live data
- ADR-131, ADR-131A, ADR-131-reference

---

## Smoke на prod (после deploy)

1. **`/engagement` endpoint:** 200, `Cache-Control` header присутствует
2. **`sumReferralEarnedThb`:** значение для тестового юзера **идентично** до и после (regression check)
3. **`countCompletedBookingsAsHost`:** использует composite index (EXPLAIN показывает `Index Scan using idx_bookings_partner_status_completed`)
4. **Новый booking** (COMPLETED): после engagement запрос — данные обновились (или cache invalidation работает)
5. **Bundle size:** `/profile/referral` не вырос (если делали next/dynamic)
6. **Не сломалось:** Stage 202.21/202.22/202.23/202.24/202.25/202.26, Phase A/B FinTech, leaderboard, calculator
7. **p95 latency** `/engagement` < 200ms (если есть мониторинг)

---

## Definition of Done

- [ ] `sumReferralEarnedThb` через SQL aggregate (RPC или view) — Node reduce удалён
- [ ] `/engagement` route имеет Cache-Control (или `unstable_cache` с правильными тегами)
- [ ] Migration `idx_bookings_partner_status_completed` (или аналог) применена в FannRent
- [ ] (Опционально) `next/dynamic` для engagement sub-blоков
- [ ] 6+ unit-тестов pass
- [ ] НЕ тронуты: SSOT-сервисы, RBAC, ledger, Stage 202.21-202.26
- [ ] НЕ удалены существующие индексы
- [ ] Git commit: `Stage 202.27 — Engagement perf pass (SQL sum + cache + composite index)`

---

## После мержа (Pavel делает)

1. **Закоммить** Stage 202.27
2. **Apply migration** в FannRent через Supabase MCP (если Cursor не сделал)
3. **Smoke** на dev (7 пунктов) + на prod
4. **Связаться с медиаперсонами** (когда YooKassa подключит)
5. **Trademark / домены** — параллельно (Diana, spaceship.com)

**Дальше (Stage 202.28+ из audit):**
- 202.28: docs passport sync (P2, Cursor через `.cursorrules`)
- 202.29: community i18n currency polish (P1/P2, ~0.5 day)

---

**Конец промта.** Скопируй и отправь в Cursor. Это **read-only perf**, без money/RBAC. Если Cursor уточняет — отвечай на основе существующих паттернов (`unstable_cache` в leaderboard, `referral_program_cap_reserve` RPC как reference для sum), **не изобретай** новые cache layers.
