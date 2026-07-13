# ADR-182: Fee Policy Unification — guest vs host commission SSOT

**Status:** Accepted (2026-07-13) — **Stage 182.0**  
**Related:** ADR-181, Split Fee v3.5 (`pricing-fee-policy.js`), PricingEngine v2 (`pricing_profiles`), Stage 130 YooKassa blueprint

---

## 1. Context

Аудит Stage 181 выявил **три параллельных источника** процентов комиссий:

| Источник | Типичные значения | Кто читает |
|----------|-------------------|------------|
| `system_settings.general.defaultCommissionRate` | **15%** | `getCommissionRate()`, визард UI, `resolveDefaultCommissionPercent()` |
| `system_settings.general.hostCommissionPercent` | **0%** (seed миграции 028) | `getFeePolicy()` → **`calculateFeeSplit()`** → **создание брони** |
| `pricing_profiles.guest_fee_pct` | **15%** (seed 053) | PricingEngine v2 при `PRICING_ENGINE_V2=true` |

Дополнительно колонка **`bookings.commission_thb`** хранит **guest service fee**, не host commission — legacy-именование.

**Следствие:** партнёр в визарде видит net **×(1 − 15%)**, а бронь могла сохраняться с **host commission 0%** и `partner_earnings_thb ≈ subtotal`.

---

## 2. Decision

### 2.1 Единый резолвер host commission (runtime)

**SSOT функция:** `resolveHostCommissionPercentFromGeneral(general)` в `lib/services/pricing/pricing-fee-policy.js`

**Правило (Stage 183):**

1. Явный `hostCommissionPercent` (включая **0**) — SSOT; **не** перекрывается legacy `defaultCommissionRate`.
2. `defaultCommissionRate` — только legacy-зеркало при отсутствии `hostCommissionPercent`.
3. `guestServiceFeePercent` — SSOT guest fee (launch: **15%**).

`getFeePolicy()` и `getFeePolicyBatch()` **обязаны** вызывать этот резолвер.

### 2.2 Синхронизация ключей при записи админки

При сохранении **general** или **finance** settings оба ключа обновляются вместе:

- `buildGeneralSettingsPatch` → пишет `defaultCommissionRate` **и** `hostCommissionPercent`
- `buildFinanceSettingsPatch` → пишет `hostCommissionPercent` **и** `defaultCommissionRate`

### 2.3 Миграция данных

`migrations/stage182_0_fee_policy_host_commission_sync.sql` — копирует `defaultCommissionRate` → `hostCommissionPercent` где host был 0, а legacy rate > 0.

### 2.4 Две комиссии — терминология (норматив)

| Термин | Кто платит | Поле / хранение |
|--------|------------|-----------------|
| **Guest service fee** | Гость | `guestServiceFeePercent`; на брони `commission_thb` (rename planned) |
| **Host commission** | Партнёр (с субтотала) | `hostCommissionPercent` / `custom_commission_rate`; `applied_commission_rate`, `partner_earnings_thb` |

**Не смешивать** guest fee с host commission в UI и формулах.

### 2.5 PricingEngine v2 vs Split Fee

- **Launch SSOT (все рынки):** guest **15%** / host **0%** — `guestServiceFeePercent` + `hostCommissionPercent` в `general`, зеркало в `pricing_profiles` (`pp-global-default`).
- **PricingEngine v2** при `PRICING_ENGINE_V2=true` берёт проценты из `pricing_profiles` (не хардкод в JS).
- **Split Fee v3.5** (`getFeePolicy`) — fallback и витрина; должен совпадать с профилем v2 на launch.

---

## 3. Cleanup backlog (не в 182.0)

| Item | Priority |
|------|----------|
| Rename `bookings.commission_thb` → `guest_service_fee_thb` | P1 |
| Deprecate `calculateCommission()` field names (`commissionThb` = guest) | P1 |
| Remove SQL fallbacks `partner_earnings = price_thb - commission_thb` | P1 |
| Update passport §3.5 (widget uses `guestServiceFeePercent`, not `commissionRate`) | P1 |
| Regional preset: RU `guest 15% / host 0%` in admin | P2 |

---

## 4. Invariants

```
guestServiceFeeThb  = round(subtotal × guestServiceFeePercent / 100)   → commission_thb
hostCommissionThb = round(subtotal × hostCommissionPercent / 100)    → partner_earnings_thb = subtotal - hostCommissionThb
platformMarginThb   = guestServiceFeeThb + hostCommissionThb
```

`getCommissionRate()` (UI) и `getFeePolicy()` (booking) **должны возвращать одинаковый host %** при одинаковых `system_settings` и partner override.

---

## 5. Testing

- [ ] Unit: `resolveHostCommissionPercentFromGeneral` — dedicated 0 + legacy 15 → 15; both 0 → 0; dedicated 12 → 12
- [ ] Integration: create booking after settings save → `applied_commission_rate` matches wizard preview
- [ ] Regression: `npm run build`

---

## 6. References

- `lib/services/pricing/pricing-fee-policy.js`
- `lib/commission/get-commission-rate-server.js`
- `lib/admin/settings-handlers/general-settings.js`, `finance-settings.js`
- `docs/ADR/181-listing-asset-currency-ssot.md`
