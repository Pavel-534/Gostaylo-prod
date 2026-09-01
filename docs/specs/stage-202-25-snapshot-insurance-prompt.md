# Stage 202.25 — Snapshot coverage & insurance SSOT — Промт для Cursor

**Зачем:** 01.09.2026 health audit (см. `docs/audits/stage-referral-health-2026-09-01.md`) нашёл 2 связанных P1:
1. **`resolveFintechPolicyForBooking` при отсутствии snapshot возвращает live `getFintechConfig()`** — старые брони (до 19.08.2026 cutover) пересчитываются по текущим настройкам, а не историческим. Consistency hole.
2. **Insurance 0.5% захардкожен** в `fintech-waterfall.js:33-35, :80` (acquiring/USN/VAT/reserve из policy, insurance — нет). Нельзя поменять через FinTech panel.

**Owner sign-off (Pavel, 01.09.2026):** стратегия **C) Inventory + freeze** — посчитать пострадавшие pre-cutover брони, заморозить их расчёт, обеспечить snapshot для всех новых броней, вынести insurance в config.

**Скоуп:** snapshot coverage + insurance SSOT. БЕЗ изменения split/pool/cap, БЕЗ изменения waterfall формулы, БЕЗ retro-active пересчёта исторических начислений.

---

## Что строим

1. **Inventory script** — `countBookingsWithoutSnapshot()` (one-off, для ops)
2. **Freeze logic** — пометить pre-cutover брони `metadata.fintech_snapshot.frozen = true` + `frozen_policy = {...canonical 19.08 defaults}`
3. **`resolveFintechPolicyForBooking` fix** — fail-closed для новых броней, frozen path для старых
4. **Insurance SSOT** — вынести 0.5% в `fintech-config-defaults.js` + `system_fintech_settings`
5. **Banner / observability** — добавить `insurance_fund_percent` в canon (если хотим показывать drift)
6. **Тесты** — snapshot resolve paths, insurance, freeze logic
7. **Ops runbook** — как запустить inventory + freeze в FannRent

---

## Не делать (явно)

- ❌ Не менять split 42/10/5/43, pool 45%, cap 1M
- ❌ Не менять waterfall formula (только источник insurance %)
- ❌ Не пересчитывать исторические начисления (frozen = заморожено навсегда)
- ❌ Не делать auto-backfill с конверсией валют (frozen_policy = snapshot от 19.08, никаких FX)
- ❌ Не удалять старые брони или ledger
- ❌ Не менять RBAC
- ❌ Не лезть в Stage 202.21/202.22/202.23/202.24/202.26 (не трогать)
- ❌ Не делать fail-closed retroactively (только для **новых** броней после deploy)

---

## Архитектура

### Новые файлы

```
lib/services/finance/fintech-snapshot-freeze.service.js   # freezeBookingsWithoutSnapshot, countBookingsWithoutSnapshot
lib/services/finance/fintech-insurance.service.js         # readInsuranceFromPolicy, default config
scripts/inventory-bookings-without-snapshot.mjs           # one-off ops script (Node)
__tests__/stage-202-25-snapshot-coverage.test.js          # 8+ тестов
```

### Файлы, которые трогаем

```
lib/services/finance/fintech-snapshot.service.js          # resolveFintechPolicyForBooking: frozen path + fail-closed
lib/services/finance/fintech-waterfall.js                # убрать hardcoded 0.005, читать insurance из policy
lib/config/fintech-config-defaults.js                     # добавить INSURANCE_FUND_PERCENT_DEFAULT = 0.5
lib/admin/fintech-owner-canon.js                          # опционально: добавить insurance_fund_percent в canon
```

### Файлы, которые НЕ трогаем (SSOT)

- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-tier-sync.service.js` (PARTNER role)
- `lib/referral/qualified-host-metrics.js` (qualified host)
- `lib/services/admin/local-leader-region.service.js` (Stage 202.23)
- `lib/referral/partner-metrics-glossary.js` (Stage 202.26)
- `lib/admin/money-write-audit.js` (Stage 202.24)
- Live `system_fintech_settings` (Phase A уже привела к канону)
- ADR-131, ADR-131A, ADR-131-reference

---

## Требования

### 1. `lib/config/fintech-config-defaults.js` (добавить insurance SSOT)

**Добавить:**
```js
/**
 * Stage 202.25 — Insurance fund % (захардкоженный 0.005 в waterfall до этого).
 * SSOT для finTech policy + bootstrap.
 */
export const INSURANCE_FUND_PERCENT_DEFAULT = 0.5  // 0.5% от partner revenue
```

**Добавить в `FINTECH_CONFIG_DEFAULTS`:**
```js
export const FINTECH_CONFIG_DEFAULTS = Object.freeze({
  // ... existing ...
  insurance_fund_percent: INSURANCE_FUND_PERCENT_DEFAULT,
  // ... existing ...
})
```

**Добавить в `fintech-owner-canon.js` (опционально, для banner):**
```js
insurance_fund_percent: 0.5,
```
И в `CANON_BANNER_KEYS` добавить `'insurance_fund_percent'` если хотим показывать drift. Иначе оставить только 4 ключа (45/4.3/1M/L3).

### 2. `lib/services/finance/fintech-waterfall.js` (заменить hardcode)

**Найти строки 33-35 и 80, где `0.005` или `0.5 / 100` для insurance:**

**Было:**
```js
const insuranceThb = platformGrossRevenueThb * 0.005  // hardcoded
```

**Стало:**
```js
const insurancePercent = readInsuranceFundPercent(policy)  // from policy/snapshot/default
const insuranceThb = platformGrossRevenueThb * (insurancePercent / 100)
```

**Helper `readInsuranceFundPercent(policy)`:**
- Если `policy.insurance_fund_percent` есть → берём
- Иначе fallback на `FINTECH_CONFIG_DEFAULTS.insurance_fund_percent` (= 0.5)
- Validation: 0 ≤ x ≤ 10 (sanity)

### 3. `lib/services/finance/fintech-snapshot-freeze.service.js` (NEW)

```js
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults'

/**
 * Canonical frozen policy = настройки на 19.08.2026 cutover.
 * Используется для pre-cutover броней без snapshot.
 */
export const FROZEN_POLICY_19AUG2026 = Object.freeze({
  referral_reinvestment_percent: 45,
  acquiring_fee_percent: 4.3,
  ambassador_guest_pool_l1_percent: 42,
  ambassador_guest_pool_l2_percent: 10,
  ambassador_guest_pool_l3_percent: 5,
  ambassador_guest_pool_referee_percent: 43,
  referral_monthly_program_cap_thb: 1_000_000,
  ambassador_guest_l3_enabled: true,
  insurance_fund_percent: 0.5,
  usn_provision_percent: 6,
  vat_provision_percent: 5,
  reserve_bank_percent: 0.5,
  // frozen marker
  _frozen: true,
  _frozen_at: '2026-08-19T00:00:00.000Z',
  _frozen_reason: 'pre-cutover_era_backfill',
})

/**
 * Count bookings without fintech_snapshot.
 * Ops use: запустить до freeze, чтобы знать N.
 */
export async function countBookingsWithoutSnapshot(supabase) {
  // SELECT COUNT(*) FROM bookings WHERE metadata->fintech_snapshot IS NULL
  // или: status IN (CONFIRMED, COMPLETED) AND metadata->>'fintech_snapshot' IS NULL
}

/**
 * Пометить pre-cutover брони как frozen.
 * Dry-run mode сначала: посчитать, показать N, спросить подтверждение.
 * Apply mode: обновить metadata.fintech_snapshot = FROZEN_POLICY_19AUG2026 + frozen=true.
 */
export async function freezeBookingsWithoutSnapshot(supabase, { dryRun = true, batchSize = 100 }) {
  // ... SELECT, batch UPDATE, return { updated, errors }
}
```

### 4. `lib/services/finance/fintech-snapshot.service.js` (фикс resolve)

**Текущая проблема:** `resolveFintechPolicyForBooking` при отсутствии snapshot возвращает **live** `getFintechConfig()`. Это consistency hole.

**Исправление:**
```js
export async function resolveFintechPolicyForBooking(supabase, booking) {
  const snapshot = booking?.metadata?.fintech_snapshot

  // Path 1: snapshot есть + frozen=true → frozen policy (immutable)
  if (snapshot?.frozen === true) {
    return { policy: snapshot, source: 'snapshot_frozen' }
  }

  // Path 2: snapshot есть + frozen=false/undefined → use snapshot (исторический)
  if (snapshot && !snapshot.frozen) {
    return { policy: snapshot, source: 'snapshot' }
  }

  // Path 3: snapshot НЕТ + booking уже оплачен (pre-cutover era) → 
  //   a) для существующих броней (created_at < cutover_date) → use FROZEN_POLICY_19AUG2026
  //   b) для новых броней (created_at >= cutover_date) → FAIL-CLOSED (throw / 4xx)
  const CUTOVER = new Date('2026-08-19T00:00:00.000Z')
  if (booking?.created_at && new Date(booking.created_at) < CUTOVER) {
    return { policy: FROZEN_POLICY_19AUG2026, source: 'frozen_default_pre_cutover' }
  }

  // New booking without snapshot → critical bug, fail-closed
  throw new Error('FIN_SNAPSHOT_MISSING_FOR_NEW_BOOKING')
}
```

**Критично:** fail-closed путь должен срабатывать ТОЛЬКО для **новых** броней (после deploy). Не для существующих (они идут через frozen_default_pre_cutover).

### 5. `scripts/inventory-bookings-without-snapshot.mjs` (one-off)

Standalone Node script для ops:

```js
#!/usr/bin/env node
// Usage: node --import ./scripts/node-test-alias-register.mjs scripts/inventory-bookings-without-snapshot.mjs
//
// Outputs:
// - N bookings without snapshot
// - N pre-cutover (will be frozen)
// - N post-cutover without snapshot (will be fail-closed after deploy)
// - Sample 5 bookings для manual review

import { createClient } from '@supabase/supabase-js'
import { countBookingsWithoutSnapshot } from '@/lib/services/finance/fintech-snapshot-freeze.service.js'

// ... connect, run, print
```

### 6. Тесты `__tests__/stage-202-25-snapshot-coverage.test.js`

Минимум 8:

1. `FROZEN_POLICY_19AUG2026` содержит все обязательные ключи (45/4.3/42/10/5/43/1M/L3 on/0.5/6/5/0.5)
2. `resolveFintechPolicyForBooking` со snapshot.frozen=true → returns frozen policy
3. `resolveFintechPolicyForBooking` со snapshot (без frozen) → returns snapshot
4. `resolveFintechPolicyForBooking` без snapshot + pre-cutover booking → returns FROZEN_POLICY_19AUG2026
5. `resolveFintechPolicyForBooking` без snapshot + post-cutover booking → throws FIN_SNAPSHOT_MISSING
6. `fintech-waterfall` использует `readInsuranceFundPercent`, не hardcoded 0.005
7. `FINTECH_CONFIG_DEFAULTS.insurance_fund_percent` === 0.5
8. `countBookingsWithoutSnapshot` returns число

Опционально:
9. Insurance при невалидном policy (negative, >10) → throw

### 7. Runbook (для FannRent)

Включить в `docs/audits/stage-referral-health-2026-09-01.md` follow-up или отдельный runbook:

```text
Stage 202.25 deploy checklist:

1. PRE-DEPLOY: запустить scripts/inventory-bookings-without-snapshot.mjs
   - Записать N pre-cutover bookings
   - Записать N post-cutover bookings without snapshot (должно быть 0 если Stage 202.21+)
2. DEPLOY code (resolveFintechPolicyForBooking + insurance config)
3. POST-DEPLOY: запустить freezeBookingsWithoutSnapshot({ dryRun: false })
   - Проверить: N updated = N pre-cutover
4. SMOKE: новый booking → snapshot attaches, resolve returns snapshot path
5. SMOKE: 1 COMPLETED pre-cutover booking → resolve returns frozen policy (same numbers as before)
6. SMOKE: insurance в waterfall = 0.5% от partner revenue (для теста 10K THB = 50 THB)
```

---

## SSOT — не трогать

- `lib/services/finance/fintech-waterfall.js` (formula) — только источник insurance %
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-tier-sync.service.js` (PARTNER role)
- `lib/referral/qualified-host-metrics.js` (qualified host)
- `lib/services/admin/local-leader-region.service.js` (Stage 202.23)
- `lib/referral/partner-metrics-glossary.js` (Stage 202.26)
- `lib/admin/money-write-audit.js` (Stage 202.24)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21, кроме опционального добавления insurance ключа)
- Live `system_fintech_settings` (Phase A уже привела к канону; insurance ключ — **отдельный step** через FinTech API)
- ADR-131, ADR-131A, ADR-131-reference

---

## Smoke на prod (после deploy)

1. **`/engagement` endpoint:** работает как раньше
2. **Калькулятор (10K THB):** Acquiring ฿494.5, Pool ฿371, Owner ฿455, **Insurance ฿50** (= 0.5% × 10K)
3. **Калькулятор (35K THB):** Insurance ฿175 (= 0.5% × 35K)
4. **Новый booking** (post-deploy): snapshot attaches автоматически, resolve → snapshot path
5. **Old booking** (pre-cutover, COMPLETED): resolve → frozen_policy, расчёт **идентичен** тому, что был до deploy
6. **Insurance в FinTech panel** (после manual update через API): можно поменять 0.5% → 0.7%, расчёт изменится
7. **Не сломалось:** Stage 202.21/202.22/202.23/202.24/202.26, Phase A/B FinTech, leaderboard
8. **Audit log:** ничего нового (этот Stage — config + freeze, не write-path)

---

## Definition of Done

- [ ] `INSURANCE_FUND_PERCENT_DEFAULT` в `fintech-config-defaults.js`
- [ ] `FINTECH_CONFIG_DEFAULTS.insurance_fund_percent === 0.5`
- [ ] `fintech-waterfall.js` использует `readInsuranceFundPercent(policy)`, не hardcoded
- [ ] `FROZEN_POLICY_19AUG2026` константа с полным каноном
- [ ] `resolveFintechPolicyForBooking`: snapshot.frozen → frozen, snapshot → snapshot, pre-cutover → FROZEN, post-cutover → fail-closed
- [ ] `freezeBookingsWithoutSnapshot` (dryRun + apply)
- [ ] `countBookingsWithoutSnapshot` для ops
- [ ] Опционально: `insurance_fund_percent` в `fintech-owner-canon.js` (если хотим в banner)
- [ ] 8+ unit-тестов pass
- [ ] `scripts/inventory-bookings-without-snapshot.mjs` готов к ops run
- [ ] Runbook в `docs/` (Cursor обновит по `.cursorrules`)
- [ ] НЕ тронуты: split, pool, cap, calculator, ledger write, RBAC, Stage 202.21-202.26
- [ ] Git commit: `Stage 202.25 — Snapshot coverage (inventory + freeze) + insurance SSOT`

---

## После мержа (Pavel делает)

1. **Закоммить** Stage 202.25
2. **Smoke на dev** (8 пунктов)
3. **Запустить inventory** на FannRent (pre-deploy): `node scripts/inventory-bookings-without-snapshot.mjs`
4. **Apply freeze** (post-deploy): `freezeBookingsWithoutSnapshot({ dryRun: false })`
5. **Smoke на prod:** старый COMPLETED booking → resolve returns frozen, numbers **не изменились** vs до deploy
6. **Связаться с медиаперсонами** (когда YooKassa подключит платежи)

**Дальше (Stage 202.27+ из audit):**
- 202.27: engagement perf (P1/P2)
- 202.28: docs passport sync (P2, Cursor через `.cursorrules`)
- 202.29: community i18n currency polish (P1/P2)

---

**Конец промта.** Скопируй и отправь в Cursor. Это **owner-approved stage** (Pavel дал добро на C — Inventory + freeze), Cursor может внедрять сразу. Если Cursor уточняет — отвечай на основе `FINTECH_CONFIG_DEFAULTS`, `FROZEN_POLICY_19AUG2026`, `resolveFintechPolicyForBooking`, **не изобретай** новые config keys, **не меняй** waterfall formula.
