# AUDIT REPORT — Money Flow / FSM / Webhooks / Dual SSOT / Errors / DB

> **Дата:** 2026-08-01  
> **Тип:** анализ only (код в этом отчёте не чинился; исключения — уже известные Stage 203 / ADR-203).  
> **Канон:** [`CONSTITUTION.md`](../CONSTITUTION.md), [`SYSTEM_MAP.md`](../SYSTEM_MAP.md), ADR-203, [`LAUNCH_RISK_REGISTER.md`](../LAUNCH_RISK_REGISTER.md).  
> **Связь:** AUDIT_01–03 (pricing/escrow/webhooks/WARN), AUDIT_LEDGER_01.

---

## Executive verdict

| Вопрос | Ответ |
|--------|--------|
| Единая State Machine для броней? | **Да** для money/API + Telegram approve/decline: `transitionBookingStatus` + RPC escrow. Smoke legal path — тот же FSM (`lib/smoke/smoke-booking-status.js`); negative tests — только `smokeForceBookingStatusNegativeTest`. |
| Двойной webhook → двойное эскроу? | **Маловероятно** на capture: RPC `FOR UPDATE` + UNIQUE `booking_payment_capture:{id}`. |
| Webhook OK, БД упала после ledger? | Capture в **одной** RPC-транзакции со статусом. JS settle/refund/dispute — **не** атомарны. |
| Ручной confirm + webhook? | **Безопасно** для capture (тот же RPC/UNIQUE). |
| Истина баланса партнёра? | **Status SoT** (`getPartnerBalance`) для UI и payout. Ledger = audit + **shadow**. |
| Ежедневный reconcile status↔ledger? | **Да** — `ledger-shadow-reconcile` (Vercel daily); drift → `[LEDGER_DRIFT]`. |
| Кто главный при выплате? | **Status / getPartnerBalance** (и READY queue для batch). Не `accountNetThb`. |

**Итог для запуска:** capture-path зрелый; главные дыры — **settle ledger≠COMPLETED** (mitigated two-phase), ~~тихие cron/stale gaps~~ (**Fixed 2026-08-01** soft-fail + `STALE_CRON`). (Telegram / smoke FSM / freeze fail-open / intent heal — закрыты 2026-08-01.)

---

## 1. FSM — «Статус → Кто меняет → Guard → Транзакция → Лог»

SSOT: `lib/booking/status-transitions.js` · apply: `lib/services/booking/booking-status.service.js` (`transitionBookingStatus`) · escrow: `move_to_escrow_and_post_ledger_v1`.

| Статус (to) | Кто меняет (типичный путь) | Guard FSM? | В транзакции с ledger? | Лог |
|-------------|----------------------------|------------|------------------------|-----|
| PENDING / CONFIRMED (create) | `create_booking_atomic_v1` / inquiry / manual-booking insert | N/A (insert) | N/A | RPC / insert |
| CONFIRMED / CANCELLED (partner API) | `PUT …/partner/bookings/[id]` → `transitionBookingStatus` | **Да** | Нет | DB `audit_logs` trigger |
| **CONFIRMED / CANCELLED (Telegram)** | `callbacks.js` → `transitionBookingStatus` (+ inventory/hold/snapshot/notify) | **Да** | Нет | FSM + `TELEGRAM_BOOKING_FSM_FAIL` |
| AWAITING_PAYMENT | payment/initiate, chat invoice sync | **Да** | Нет | service |
| **PAID_ESCROW** | Webhook / confirm / reconcile → `EscrowService.moveToEscrow` → **RPC** | Status в RPC; JS side-effects `viaEscrowRpc` | **Да (RPC)** | journal UNIQUE + webhook logs |
| CHECKED_IN | guest check-in confirm | **Да** | Нет | console |
| THAWED | cron escrow-thaw → `thaw.service` | **Да** | Нет | `ops_job_runs` |
| READY_FOR_PAYOUT | cron promote / batch creation | **Да** | Нет | `ops_job_runs` |
| COMPLETED | batch settle / partner / legacy payout | **Да** (batch) | **Нет** с ledger settle | batch + transition |
| REFUNDED | dispute engine / cancel | **Да** | ledger refund отдельно | admin audit (dispute) |
| CANCELLED | cancel API, checkout-hold expiry, cleanup-drafts | **Да** | refund optional | service |

**Нет статуса брони `SETTLED`.** `SETTLED` = `payout_batches` / items. Бронь после выплаты → **COMPLETED**.

### Вердикт FSM

- [x] **Деньги / HTTP API** в основном через одну функцию перехода (+ RPC для PAID_ESCROW)  
- [x] ~~Telegram callbacks bypass~~ — **fixed**  
- [x] ~~Smoke/E2E raw status UPDATE (High)~~ — **fixed 2026-08-01:** `smokeTransitionBookingStatus` / `smokePromoteEscrowToReadyForPayout`; force only via `smokeForceBookingStatusNegativeTest` (`negative_test:…` + SMOKE/E2E env). Residual: some fixtures still **INSERT** terminal status (referral COMPLETED) — not UPDATE bypass.

### НАРУШЕНИЯ (priority)

| Pri | Место | Суть |
|-----|-------|------|
| **CRITICAL** ~~Telegram raw PATCH~~ | `lib/services/telegram/handlers/callbacks.js` | **Fixed 2026-08-01:** `transitionBookingStatus` + inventory/hold/snapshot/notify parity; signal `TELEGRAM_BOOKING_FSM_FAIL` |
| **High** ~~smoke raw status~~ | `lib/smoke/*` | **Fixed 2026-08-01:** `lib/smoke/smoke-booking-status.js` |
| **High (дизайн)** ~~CHECKED_IN vs thaw~~ | Thaw / balance | **Fixed 2026-08-01:** FSM `CHECKED_IN→THAWED`; thaw sources `PAID_ESCROW`∪`CHECKED_IN`; frozen bucket includes CHECKED_IN |

---

## 2. Ledger / Escrow / Payout writers

| Операция | Файл (якорь) | Слой | Txn? | Idempotency |
|----------|--------------|------|------|-------------|
| Capture + PAID_ESCROW | RPC `move_to_escrow_and_post_ledger_v1` ← `escrow.service.js` | Service+SQL | **Да** | `booking_payment_capture:{bookingId}` UNIQUE |
| Payout obligation settled | `ledger-settlement.js` ← admin payouts PAID | Route→Service | **Нет** | `payout_obligation_settled:{id}` |
| Batch booking settled | `ledger-settlement.js` ← `payout-batch-settlement.js` | Service | **Нет** (+ settle lock) | `payout_batch_settled:{batch}:{booking}` |
| Partial refund | `ledger-refund.js` | Service | **Нет** | `booking_refund_partial:{id}` |
| Dispute hold/release/split | `dispute-hold.js` | Service | **Нет** | `dispute_hold:{disputeId}` и др. |
| Treasury conversion | `admin/finances/conversions` | Route | **Нет** | **stable** (`client` / `ext:` / same-day `fp:`) |

**Callers `moveToEscrow`:**  
`webhooks/payments/confirm` · `webhooks/crypto/confirm` · `bookings/[id]/payment/confirm` · `payments-v3.confirmPayment` · `reconcile-confirmed-without-escrow` · E2E/smoke.

---

## 3. Webhook audit (YooKassa / crypto)

### Handlers

| Handler | Path |
|---------|------|
| Acquiring (YooKassa / MIR / adapters) | `app/api/webhooks/payments/confirm/route.js` |
| Crypto | `app/api/webhooks/crypto/confirm/route.js` |

### Checklist

| Проверка | Payments confirm | Crypto confirm |
|----------|------------------|----------------|
| Idempotency по статусу брони (уже escrow pipeline) | Да → 2xx skip | Да |
| Unique event / payment | Intent + amount verify; YooKassa GET для MIR | **txid UNIQUE** + `assertCryptoTxidAvailable` |
| Ledger unique | Через RPC `booking_payment_capture:{id}` | То же |
| HTTP 2xx только после успешного escrow (happy path) | Да; fail → **502** | Да; fail → **502** |
| Heal «оплатил, webhook нет» | Manual confirm + cron **`reconcile-confirmed-payments`** (legacy `payments.CONFIRMED`) | Частично; см. CRITICAL ниже |
| Не начислять эскроу дважды (DB) | UNIQUE journal + RPC FOR UPDATE | + txid unique |

### Cron reconcile-confirmed-payments

| | |
|--|--|
| Код | `app/api/cron/reconcile-confirmed-payments` → `runReconcileConfirmedPaymentsCron` (legacy + intents + crypto) |
| Schedule | Vercel daily fallback `0 0 * * *`; **prod: hourly cron-job.org** (`CRON_REGISTRY`) |
| Действие | До 50 `payments` CONFIRMED + `payment_intents` PAID (≥5m) + CRYPTO+txid → `moveToEscrow`; terminal booking → `HEAL_SKIP` |
| Gap | ~~Не лечит intents~~ **Fixed 2026-08-01** (`lib/payment/reconcile-paid-intents-without-escrow.js`) |

### Таблица рисков webhook

| Риск | Вердикт |
|------|---------|
| Двойной webhook → двойное эскроу | **Нет (практически)** — RPC + UNIQUE |
| Webhook принят, БД упала mid-capture | Capture atomic в RPC; при fail до commit → 502 → PSP retry |
| Ручной confirm + webhook | **OK** — идемпотентный RPC |
| Intent PAID, escrow fail, retries stopped | **Healed** — cron intents path |
| Crypto: txid записан, escrow fail → retry 409 | **Healed** — crypto path + `assertCryptoTxidAvailable` (same booking → retry escrow) |

---

## 4. Dual SSOT — баланс партнёра

```
bookings (+ settlement snapshot) + dispute freeze
        │
        ├─► getPartnerBalance  ──► UI / requestPayout / profiles cache
        │         │
        │         └─► READY_FOR_PAYOUT queue ──► payout_batches ──► Concierge settle
        │
ledger_* ──► getPartnerBalanceFromLedger (shadow buckets + accountNetThb)
        │
        └─► cron ledger-shadow-reconcile ──► ops_job_runs.zeroDrift / [LEDGER_DRIFT]
```

| Вопрос | Ответ |
|--------|--------|
| Где истина для выплаты? | **Status SoT** (`getPartnerBalance` / READY earnings) |
| Ежедневный reconcile vs ledger? | **Да** — shadow; tol ฿0.05 |
| При drift? | `recordCriticalSignal('LEDGER_DRIFT')` + TG `[LEDGER_DRIFT]`; **SoT не flip** |
| UI одно, ledger другое при выплате? | UI=status; `accountNet` может быть ниже после settle — **ожидаемо**. Платить по `accountNet` alone = **HIGH** ошибка процесса |

**HIGH:** FinOps путает `accountNetThb` с available UI после PAID payout при брони ещё READY (см. dry-run ADR-203).

---

## 5. Ошибки / «тихие смерти»

| # | Место | Почему CRITICAL |
|---|-------|-----------------|
| 1 | ~~`getFrozenBookingIdSet` fail-open~~ | **Fixed 2026-08-01:** FAIL-CLOSED — Set всех id + `queryFailed`; `FREEZE_FAIL` TG/critical; thaw/promote/batch/settle abort |
| 2 | ~~escrow-thaw: `success:false` → ops часто **success**~~ | **Fixed 2026-08-01:** `resolveEscrowThawOps` → `ops_job_runs.status=error` + TG |
| 3 | payout-batch-pools soft error → ops **success** | То же |
| 4 | ledger-shadow: compare `errors++` без TG | Gate 30d может тихо стоять |
| 5 | ~~Batch settle: ledger OK, `COMPLETED` fail~~ | **Fixed 2026-08-01:** two-phase + catch-up; `SETTLE_ORPHAN` health scan |
| 6 | financial-health 500 без TG | Падение скана незаметно |
| 7 | Stale cron **не** включает `ledger_shadow_reconcile` / `reconcile-confirmed-payments` | Нет TREASURY_CRON_STALE |
| 8 | Stale alert только при открытии FinTech treasury-ops | Не proactive cron |

**Webhook 200 до операции:** на success path **нет** (2xx после escrow / idempotent skip). Crypto/Telegram anti-retry `{ok:true}` на handler error — не money capture.

---

## 6. DB: транзакции / constraints / RLS / индексы

| Операция | В транзакции | Constraint | Индекс / доступ |
|----------|--------------|------------|-----------------|
| moveToEscrow + capture | **Да (RPC)** | UNIQUE idempotency_key | FOR UPDATE booking |
| JS ledger settle/refund/dispute | **Нет** | UNIQUE keys; append-only | orphan journal risk |
| Batch settle + COMPLETED | **Нет** (multi-query) | item + batch CAS | **CRITICAL gap** |
| Partner payout claim | **Да (RPC)** | open-payout filters | advisory lock |
| ledger FK Stage 203 | — | ON DELETE SET NULL booking_id | history keep |
| RLS ledger/payouts | — | ON, no anon policies; service_role | OK |
| bookings status/partner | — | — | `idx_bookings_status`, partner indexes (legacy/prisma) |

**CRITICAL:** ~~money settle без одной транзакции «ledger + booking COMPLETED»~~ — **mitigated 2026-08-01** two-phase + catch-up + SETTLE_ORPHAN (не RPC).  
**OK:** capture path — эталон.

---

## 7. Приоритетный backlog (если чинить)

1. **P0** ~~Telegram callbacks → `transitionBookingStatus`~~ — **done 2026-08-01**  
1b. **P0** ~~Smoke raw booking status UPDATE → FSM helpers~~ — **done 2026-08-01** (`lib/smoke/smoke-booking-status.js`)  
2. **P0** ~~Fail-closed `getFrozenBookingIdSet`~~ — **done 2026-08-01** (`FREEZE_FAIL`, `queryFailed`, callers abort).  
3. **P0** ~~Heal path: intent PAID ∧ ¬escrow (+ crypto 409 after partial write)~~ — **done 2026-08-01** (`reconcile-paid-intents-without-escrow` in same cron).  
4. **P1** ~~Atomicity batch settle~~ — **done 2026-08-01** (two-phase + SETTLE_ORPHAN / SETTLE_STUCK; no public FSM change).  
5. **P1** ~~ops_job_runs: soft fail ≠ success; stale monitor + ledger-shadow + reconcile-confirmed~~ — **done 2026-08-01** (`lib/ops/ops-job-outcome.js`, `lib/ops/stale-cron-monitor.js`, signal `STALE_CRON`).  
6. **P2** ~~CHECKED_IN ∩ thaw eligibility; conversion idempotency key~~ — **done 2026-08-01** (`ESCROW_THAW_SOURCE_STATUSES`, frozen balance+shadow, `buildTreasuryConversionIds`).

---

## 8. Ссылки на код (якоря)

- FSM apply: `lib/services/booking/booking-status.service.js`  
- Escrow: `lib/services/escrow.service.js` · RPC migrations `stage124_*` / later  
- Payments WH: `app/api/webhooks/payments/confirm/route.js`  
- Crypto WH: `app/api/webhooks/crypto/confirm/route.js`  
- Reconcile: `lib/payment/reconcile-confirmed-without-escrow.js`  
- Shadow: `lib/ops/ledger-shadow-reconcile.js` · balance SoT: `lib/services/escrow/balance.service.js`  
- Telegram FSM: `lib/services/telegram/handlers/callbacks.js`  
- Smoke FSM: `lib/smoke/smoke-booking-status.js`  
- Freeze fail-closed: `lib/partner/partner-payout-eligibility.js` `getFrozenBookingIdSet` / `isFrozenBookingLookupFailed` · signal `FREEZE_FAIL`

*Отчёт живой: после фиксов P0 обновить таблицу нарушений и снять CRITICAL.*
