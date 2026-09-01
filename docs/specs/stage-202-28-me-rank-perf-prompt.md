# Stage 202.28 — `me/rank` perf (last hot spot from health audit) — Промт для Cursor

**Зачем:** 01.09.2026 health audit (см. `docs/audits/stage-referral-health-2026-09-01.md`) отметил `app/api/v2/referral/me/rank/route.js` как hot spot — **full month ledger в Node**. Stage 202.27 закрыл `sumReferralEarnedThb`, Stage 202.27b закрыл `getMonthlyGuestReferralSpendThb`, **этот этап закрывает последний ledger-scan в Node**.

**Cache уже смягчает** (600s через `unstable_cache`), но cold cache всё равно медленный. RPC даст win на cold path + на future более частом invalidation.

**Скоуп:** read-only perf, БЕЗ money/RBAC/SSOT, БЕЗ изменения cache TTL, БЕЗ новых endpoints.

---

## Что строим

1. **RPC `monthly_user_rank(p_user_id text, p_year int, p_month int)`** — SQL aggregate с window function, returns `{ rank, total_users, earned_thb }`
2. **Route refactor** — заменить Node reduce + sort на один `.rpc()` call
3. **Fallback** — `LegacyRankCompute` + warn once (как в 202.27/202.27b)
4. **Tests** — regression: Node rank === SQL rank
5. **(Опционально)** EXPLAIN script

---

## Не делать (явно)

- ❌ Не менять `unstable_cache` TTL (600s оставить)
- ❌ Не менять cache strategy (route кэшируется целиком)
- ❌ Не менять return shape (consumers ожидают `{ rank, total_users, ... }`)
- ❌ Не менять Stage 202.21-202.27b
- ❌ Не делать pre-compute / cron (отдельный этап)
- ❌ Не делать real-time updates
- ❌ Не лезть в SSOT (waterfall, payout, cap, snapshot)
- ❌ Не делать admin "all ranks" view (другая задача)

---

## Архитектура

### Новые файлы

```
migrations/stage202_28_monthly_user_rank_rpc.sql         # RPC + GRANT
__tests__/stage-202-28-me-rank-perf.test.js               # 6+ тестов
```

### Файлы, которые трогаем

```
app/api/v2/referral/me/rank/route.js                      # Node reduce → RPC
lib/services/finance/... (если есть helpers)              # см. grep
```

### Файлы, которые НЕ трогаем (SSOT)

- `lib/services/finance/fintech-waterfall.js` (waterfall formula)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M, cap_reserve RPC)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-tier-sync.service.js` (PARTNER role)
- `lib/services/finance/fintech-snapshot.service.js` (Stage 202.25)
- `lib/services/finance/fintech-snapshot-freeze.service.js` (Stage 202.25)
- `lib/services/finance/fintech-insurance.service.js` (Stage 202.25)
- `lib/services/admin/local-leader-region.service.js` (Stage 202.23)
- `lib/referral/partner-metrics-glossary.js` (Stage 202.26)
- `lib/admin/money-write-audit.js` (Stage 202.24)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on/insurance 0.5)
- `lib/referral/qualified-host-metrics.js` (Stage 202.22/202.27/202.27b)
- Live data
- ADR-131, ADR-131A, ADR-131-reference

---

## Требования

### 1. RPC `monthly_user_rank(p_user_id text, p_year int, p_month int)`

**Pattern** (как `referral_program_monthly_guest_spend_thb` из 202.27b + window function):

```sql
CREATE OR REPLACE FUNCTION public.monthly_user_rank(
  p_user_id text,
  p_year int,
  p_month int
)
RETURNS TABLE (
  rank bigint,
  total_users bigint,
  earned_thb numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH monthly AS (
    SELECT
      referrer_id,
      COALESCE(ROUND(SUM(amount_thb)::numeric, 2), 0) AS earned
    FROM public.referral_ledger
    WHERE referral_type = 'guest_booking'
      AND status IN ('pending', 'earned', 'earned_held')
      AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'UTC') = p_year
      AND EXTRACT(MONTH FROM created_at AT TIME ZONE 'UTC') = p_month
    GROUP BY referrer_id
  ),
  ranked AS (
    SELECT
      referrer_id,
      earned,
      RANK() OVER (ORDER BY earned DESC) AS rk,
      COUNT(*) OVER () AS total
    FROM monthly
  )
  SELECT
    rk::bigint AS rank,
    total::bigint AS total_users,
    earned AS earned_thb
  FROM ranked
  WHERE referrer_id = p_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.monthly_user_rank(text, int, int)
  TO service_role;
```

**Ключевые моменты:**
- Фильтр — **mirror `referral_program_cap_reserve`** (referral_type='guest_booking', статусы 'pending'/'earned'/'earned_held', `created_at` UTC)
- `RANK()` — ties get same rank (DENSE_RANK alternative — TBD by Cursor based on user expectations)
- `COUNT(*) OVER ()` — total users in one query
- Returns 0 rows if user not in monthly (handle in route: return `{ rank: null, total_users: <count>, earned_thb: 0 }`)

**Покрытие индексом:** `idx_referral_ledger_referrer_status (referrer_id, status)` (Stage 71). Проверь EXPLAIN — может быть нужен composite с `created_at` (если нет — отдельный perf этап, не сейчас).

### 2. `app/api/v2/referral/me/rank/route.js` refactor

**Сначала** прочитай route целиком (cache wrapper, current shape). **Затем:**

**Было (примерно):**
```js
export async function GET() {
  // ...
  // fetch profile, month dates
  // SELECT * FROM referral_ledger WHERE ... ORDER BY amount DESC
  // Node reduce, find position
  // return NextResponse.json({ rank, total_users, earned_thb })
}
```

**Стало:**
```js
export async function GET() {
  // ... (auth, profile as before)
  
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  
  const { data, error } = await supabaseAdmin.rpc('monthly_user_rank', {
    p_user_id: session.userId,
    p_year: year,
    p_month: month,
  })
  
  if (error) {
    // Fallback to legacy
    return getLegacyRankResponse(supabaseAdmin, session.userId, year, month)
  }
  
  // RPC returns array (1 row or 0 rows)
  const row = data?.[0]
  if (!row) {
    // User not in this month's leaderboard
    return NextResponse.json({
      success: true,
      data: { rank: null, total_users: 0, earned_thb: 0 },
    })
  }
  
  return NextResponse.json({
    success: true,
    data: {
      rank: Number(row.rank) || null,
      total_users: Number(row.total_users) || 0,
      earned_thb: Number(row.earned_thb) || 0,
    },
  })
}
```

**Fallback** (`getLegacyRankResponse`):
- Использовать существующий Node reduce + sort (если он был)
- `console.warn` один раз: `'me/rank: legacy fallback, monthly_user_rank RPC missing'`
- Возвращает тот же shape

**Cache** — оставить `unstable_cache` 600s как сейчас. **Не трогать** cache strategy.

### 3. Тесты `__tests__/stage-202-28-me-rank-perf.test.js`

Минимум 6:

1. `monthly_user_rank` RPC migration SQL содержит `RANK() OVER`, `referral_type='guest_booking'`, `status IN ('pending', 'earned', 'earned_held')`, `created_at AT TIME ZONE 'UTC'`
2. `monthly_user_rank` RPC returns `{ rank, total_users, earned_thb }` правильно (mock data: 3 users, проверяем rank для каждого)
3. `monthly_user_rank` RPC handles user not in leaderboard (returns 0 rows)
4. Route uses `.rpc('monthly_user_rank')` если RPC deployed
5. Route fallback к legacy если RPC missing
6. Route return shape **не изменился** (regression для consumers)
7. Cache wrapper сохранён (`unstable_cache` 600s)

Опционально:
8. `RANK` vs `DENSE_RANK` тест — ties get same rank (или нет, в зависимости от impl)
9. Perf micro-benchmark: Node reduce медленнее RPC (не gate)

---

## SSOT — не трогать

(см. список выше)

---

## Smoke на prod (после deploy)

1. **`/me/rank` endpoint:** возвращает тот же shape, что и до deploy (regression)
2. **Cache:** 600s TTL сохранён (через `unstable_cache`)
3. **Тестовый юзер с earned:** rank корректен, total_users корректен
4. **Тестовый юзер без earned:** rank = null, total_users = 0
5. **EXPLAIN ANALYZE** на staging: RPC использует индекс `idx_referral_ledger_referrer_status` (или лучше)
6. **Не сломалось:** Stage 202.21-202.27b, Phase A/B FinTech, leaderboard, calculator
7. **Cold cache latency:** < 200ms (если есть мониторинг)

---

## Definition of Done

- [ ] Migration `monthly_user_rank` RPC применена в FannRent
- [ ] Route использует `.rpc('monthly_user_rank')` + LegacyRankCompute fallback
- [ ] Cache wrapper сохранён (`unstable_cache` 600s)
- [ ] Return shape неизменен
- [ ] 6+ unit-тестов pass
- [ ] НЕ тронут cache TTL
- [ ] НЕ тронуты SSOT-сервисы, RBAC, ledger, Stage 202.21-202.27b
- [ ] НЕ добавлены новые индексы (если нужны — отдельный этап)
- [ ] Git commit: `Stage 202.28 — me/rank perf (monthly_user_rank RPC + legacy fallback)`

---

## После мержа (Pavel делает)

1. **Закоммить** Stage 202.28
2. **Apply migration** в FannRent через Supabase MCP
3. **Smoke** на dev (7 пунктов) + на prod
4. **Затем — финальный audit рефералки** (отдельный промт, 1-2 дня Cursor'а)
5. **Параллельно оффлайн**: trademark (Diana), домены (spaceship.com), медиа-контакты (когда YooKassa)

**Дальше:**
- Финальный audit (post-202.28)
- ADR-300 audit (Pavel упомянул)
- Live L3 / Public leader page (когда legal sign-off + whitelisted leaders)

---

**Конец промта.** Скопируй и отправь в Cursor. Это **read-only perf**, последний hot spot из health audit. Если Cursor уточняет — отвечай на основе существующих RPC patterns (`referral_program_cap_reserve`, `referral_earned_thb_total`, `referral_program_monthly_guest_spend_thb`), **RANK vs DENSE_RANK** — выбери по продуктовому смыслу (Pavel скажет, если имеет preference), **`unstable_cache` 600s** — не трогать.
