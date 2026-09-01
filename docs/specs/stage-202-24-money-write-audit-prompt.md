# Stage 202.24 — Admin money write audit + idempotency — Промт для Cursor

**Зачем:** 01.09.2026 audit (см. `docs/audits/stage-referral-health-2026-09-01.md`) нашёл **3 P0** — money-adjacent admin write-endpoints **без `recordAdminAudit`**. Это значит, что ручные payout actions, KYC verify и wallet unlock **не оставляют следа** в admin audit explorer. Опасно для compliance, ops и расследования инцидентов.

**Скоуп:** исправить 3 P0 endpoints, **повторив паттерн `disputes/[id]/action`** (он уже всё делает правильно: `denyUnlessAdminFinancialRole` + Idempotency-Key + `recordAdminAudit`). БЕЗ изменения формул, split, pool, cap. Без новых таблиц.

---

## Что строим

В каждом из 3 endpoints добавить:
1. **`Idempotency-Key` header support** — dedupe по ключу (helpers в `lib/services/audit/admin-audit.js`)
2. **`recordAdminAudit()` после успешной мутации** — payload `{ before, after, source }`
3. **Smoke + unit-тесты** — что audit пишется, idempotency работает, RBAC не сломан

---

## Не делать (явно)

- ❌ Не менять money formulas (split, pool, cap, waterfall, payout amounts)
- ❌ Не менять ledger write logic (только audit-обёртка)
- ❌ Не менять RBAC (уже правильно настроен в 3 P0 endpoints)
- ❌ Не вводить новые таблицы для audit (используем `admin_audit_logs` через `recordAdminAudit()`)
- ❌ Не лезть в `lib/services/finance/*` (waterfall SSOT — sensitive)
- ❌ Не трогать disputes route (он эталон, не ломаем)
- ❌ Не делать self-protection / CAS / optimistic concurrency (это Stage 202.25+)
- ❌ Не исправлять fraud-queue / emergency-actions (P1, отдельный этап)

---

## Архитектура

### Файлы, которые трогаем

```
app/api/v2/admin/payouts/[id]/route.js                  # P0-1
app/api/v2/admin/partner-payout-profiles/[id]/route.js   # P0-2
app/api/v2/admin/wallet/payouts/route.js                 # P0-3 (только PATCH / verified_for_payout)
```

### Файлы, которые НЕ трогаем (но используем как reference / utility)

```
app/api/v2/admin/disputes/[id]/action/route.js           # эталон (pattern copy)
lib/services/audit/admin-audit.js                        # recordAdminAudit, Idempotency-Key helpers
lib/admin/admin-api-access.ts                             # RBAC matrix (уже зарегистрировано)
```

### Новые файлы

```
__tests__/stage-202-24-money-write-audit.test.js         # 6+ тестов (3 endpoint × audit + idempotency)
```

---

## Требования

### Reference pattern (как делает disputes)

`app/api/v2/admin/disputes/[id]/action/route.js` уже реализует:
- `denyUnlessAdminFinancialRole` middleware (RBAC для money actions)
- Чтение `Idempotency-Key` header
- Helpers из `lib/services/audit/admin-audit.js` (dedupe по ключу)
- `recordAdminAudit({ action, entity_type, entity_id, payload_json: { before, after, source } })` после успеха
- Возврат 409 если повторный hit с тем же ключом и другим payload
- Возврат 200 если повторный hit с тем же ключом и тем же payload

**Сначала прочитай `disputes/[id]/action/route.js` и `admin-audit.js` целиком** (патерн copy, не изобретай). Используй **те же helper'ы**, **тот же payload-формат**, **ту же RBAC-проверку**.

### 1. `app/api/v2/admin/payouts/[id]/route.js` (PATCH PAID/FAILED)

**Текущая проблема:** есть `metadata.admin_marked_paid_by` в booking, но нет `recordAdminAudit`.

**Что добавить:**
- Чтение `Idempotency-Key` header
- Если есть — `idempotency.lookupOrReserve(key, expectedPayload)` (helper из admin-audit)
- После успешной мутации (status → PAID/FAILED) — `recordAdminAudit`:
  ```js
  {
    action: 'payout_status_change',
    entity_type: 'payout',
    entity_id: payoutId,
    payload_json: {
      before: { status: 'PENDING', amount_thb: ... },
      after:  { status: 'PAID', amount_thb: ... },
      source: 'admin_payouts_panel',
      adminId: ...,
    },
  }
  ```
- На повторный hit с тем же ключом — вернуть 200 с тем же ответом (или 409 если payload разный)
- Существующий CAS на `updated_at` + status IN (PENDING, PROCESSING) — **оставить как есть**

**НЕ менять:** settlement logic, amount math, ledger write.

### 2. `app/api/v2/admin/partner-payout-profiles/[id]/route.js` (PATCH verify)

**Текущая проблема:** KYC verify (разблокировка выплат) без audit. Это compliance hole.

**Что добавить:**
- `Idempotency-Key` support
- `recordAdminAudit` после успешной verify/reject:
  ```js
  {
    action: 'partner_payout_profile_verify',  // или 'reject' / 'clear'
    entity_type: 'partner_payout_profile',
    entity_id: profileId,
    payload_json: {
      before: { kyc_status: 'pending', kyc_verified_at: null, kyc_verified_by: null },
      after:  { kyc_status: 'verified', kyc_verified_at: '...', kyc_verified_by: adminId },
      source: 'admin_partner_payout_profile',
      adminId: ...,
    },
  }
  ```

**НЕ менять:** KYC state machine, RBAC для verify.

### 3. `app/api/v2/admin/wallet/payouts/route.js` (PATCH verified_for_payout)

**Текущая проблема:** разблокировка выплат на wallet без audit.

**Что добавить:**
- `Idempotency-Key` support (только на PATCH; GET оставить как есть)
- `recordAdminAudit` для actions с verified_for_payout / clear:
  ```js
  {
    action: 'wallet_payout_verification',  // или 'clear'
    entity_type: 'wallet',
    entity_id: walletId,
    payload_json: {
      before: { verified_for_payout: false },
      after:  { verified_for_payout: true },
      source: 'admin_wallet_panel',
      adminId: ...,
    },
  }
  ```

**НЕ менять:** GET endpoint, RBAC.

### 4. Тесты `__tests__/stage-202-24-money-write-audit.test.js`

Минимум 6:

1. **payouts PAID**: PATCH с валидным `Idempotency-Key` → `recordAdminAudit` вызван, payload содержит before/after
2. **payouts PAID**: повторный PATCH с тем же ключом и тем же payload → 200 без новой мутации
3. **payouts PAID**: повторный PATCH с тем же ключом и другим payload → 409
4. **partner-payout-profiles verify**: PATCH → audit записан с правильным `action` и `entity_id`
5. **wallet/payouts**: PATCH verified_for_payout → audit записан
6. **Все 3**: без `Idempotency-Key` header → endpoint работает как раньше (обратная совместимость), audit всё равно пишется

Опционально:
7. Idempotency-Key срок жизни (24h TTL?) — если helper поддерживает
8. Self-protection (admin меняет сам себя) — НЕ в этом Stage (отдельный этап)

### 5. i18n

**БЕЗ UI-изменений в этом Stage** (admin actions показывают toast с id, не нужен новый copy). Если audit logs нужно показывать в admin UI — это Stage 202.28+.

---

## SSOT — не трогать

- `lib/services/finance/fintech-waterfall.js` (waterfall)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M)
- `lib/services/finance/fintech-snapshot.service.js` (snapshot)
- `lib/referral/qualified-host-metrics.js` (Stage 202.22)
- `lib/services/admin/local-leader-region.service.js` (Stage 202.23)
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- `app/api/v2/admin/disputes/[id]/action/route.js` (эталон, не трогаем)
- Live `system_fintech_settings`
- ADR-131, ADR-131A, ADR-131-reference

---

## Smoke на prod (после деплоя)

1. **payouts PAID** (test payout): 
   - PATCH с `Idempotency-Key: test-1` → 200, audit записан в `admin_audit_logs`
   - PATCH с тем же ключом → 200 (no new mutation, no new audit)
   - PATCH с другим payload → 409
2. **partner-payout-profiles verify**:
   - PATCH verify → 200, audit записан с action `partner_payout_profile_verify`
3. **wallet/payouts verified_for_payout**:
   - PATCH → 200, audit записан с action `wallet_payout_verification`
4. **Audit UI** (если есть): все 3 actions видны в audit explorer
5. **Без Idempotency-Key** (старый код клиента): endpoints работают, audit пишется
6. **RBAC** (старый): non-admin получает 403, как раньше
7. **CAS / race** (payouts): две параллельные PAID → одна проходит, вторая 409 (старая логика + audit для каждой успешной)
8. **Не сломалось**: Stage 202.21 FinTech guardrails, Stage 202.22 `/engagement`, Stage 202.23 region admin, calculator, leaderboard

---

## Definition of Done

- [ ] 3 endpoints: PATCH /api/v2/admin/payouts/[id], /partner-payout-profiles/[id], /wallet/payouts
- [ ] `Idempotency-Key` header support в каждом (через helpers в `lib/services/audit/admin-audit.js`)
- [ ] `recordAdminAudit()` после успеха в каждом, payload `{ before, after, source, adminId }`
- [ ] 6+ unit-тестов pass (минимум 2 на endpoint)
- [ ] НЕ тронуты: settlement logic, KYC state machine, wallet state machine, RBAC, money math
- [ ] НЕ тронут disputes route (эталон)
- [ ] БЕЗ новых таблиц для audit
- [ ] БЕЗ UI-изменений (admin actions = toast)
- [ ] Git commit: `Stage 202.24 — Admin money write audit + idempotency (P0 fix from health audit)`

---

## После мержа (Pavel делает)

1. **Закоммить** Stage 202.24
2. **Smoke** на dev (8 пунктов выше) + на prod
3. **Связаться с медиаперсонами** (узкое место №1, не код)

**Дальше (Stage 202.25+ из audit):**
- 202.25: snapshot coverage & insurance SSOT (P1, ~1-2 days, **owner sign-off** нужен)
- 202.26: partner metrics glossary (P1, copy-only)
- 202.27: engagement perf (P1/P2)
- 202.28: docs passport sync (P2, Cursor через `.cursorrules`)
- 202.29: community i18n currency polish (P1/P2)

---

**Конец промта.** Скопируй и отправь в Cursor. Это **повторение паттерна disputes route**, не изобретение. Если Cursor уточняет — отвечай на основе `disputes/[id]/action/route.js` (эталон) и `lib/services/audit/admin-audit.js` (helpers), **не выдумывай** новые audit-форматы.
