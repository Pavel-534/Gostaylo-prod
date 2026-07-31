# AUDIT REPORT 02 — MISSING из AUDIT_01 + очередь WARN

> **Дата:** 2026-07-31  
> **Канон:** [`docs/CONSTITUTION.md`](../../CONSTITUTION.md), [`docs/SYSTEM_MAP.md`](../../SYSTEM_MAP.md), guides referral / Concierge  
> **Объём (из AUDIT_01 § MISSING):** referral L2 / MLM · payout-batch CSV / Concierge settle · chat invoice math · PricingEngine v2 vs `rounding_diff_pot`  
> **Ограничение:** анализ only — **код не менялся**.  
> **Связь:** [`AUDIT_REPORT_01.md`](./AUDIT_REPORT_01.md) — CRITICAL #1–#3 закрыты; WARN_01 — отдельная очередь (см. § Backlog WARN_01).

---

## Краткий вердикт

Три зоны дают **CRITICAL** на прод-деньги / Concierge / checkout display:

1. **Payout settle** может закрыть пул `SETTLED` при ошибках ledger; SKIPPED по спору навсегда выкидывает бронь из пулов; **bank-package ZIP** падает с `ReferenceError` (`request` не объявлен).  
2. **Chat invoice sync** оставляет stale `final_breakdown` (и не трогает `rounding_diff_pot`) → UI/ledger readers ≠ `amount_thb` charge.  
3. **Referral unlock / alreadyEarned** — under-credit и stranded `pending` siblings (не double-credit).

**WARN_01** (price-breakdown fallback, demo 15%, ledger MODERATOR gate, SYSTEM_MAP gaps, crypto wallet hardcode) — **не** чинились в этом проходе; очередь ниже.

---

### [OK]

| Модуль / область | Комментарий |
|------------------|-------------|
| Referral accrual trigger | COMPLETED → `referral-lifecycle-hook` → `ReferralPayoutService.distribute*` |
| Guest pool / host MLM knobs | `system_fintech_settings` + `FINTECH_CONFIG_DEFAULTS`; runtime читает policy |
| Referral wallet credit idempotency | RPC `referral_distribute_bonus_atomic` + `reference_id = referral_ledger:{id}` |
| Referral tables RLS | service_role only (stage154); API writes через `supabaseAdmin` |
| Ambassador display FX | mid-only (`useAmbassadorDisplayFx` / ADR-134) — CONSTITUTION §3.1 |
| Self-referral hard-stop | `referral-payout.service` + critical telemetry |
| PayoutBatch facade | DRAFT → LOCKED → EXPORTED → SETTLED; legacy `processPayout` за guard |
| Settle ledger keys | `payout_batch_settled:{batchId}:{bookingId}` idempotent |
| Settle HTTP gate | `requireAdminStaff` + FinTech ADMIN menu RBAC; `supabaseAdmin` |
| Cron auto-pool | Concierge gate `assertTreasuryOpsAllowed('auto_pool')` |
| Compliance CSV | отдельный SSOT `compliance-registry-csv.js` (не путать с bank registry) |
| Invoice retail FX settle | `settleInvoiceDisplayAmount` + storefront rate map; multiplier last-resort `1.02` |
| PricingEngine mode switch | `getServerGuestRoundingMode` / attestation — integer vs pot10 явные |
| Fee defaults | `platform-split-fee-defaults.js` — не размазан 15% по engine |

---

### [WARN]

| ID | Файл / зона | Проблема | Рекомендация |
|----|-------------|----------|--------------|
| W2.1 | `referral-policy` / calculator / admin settings / UI | Литералы `45/12/43`, `70/30`, `15`, fee `1.5` вне импорта `FINTECH_CONFIG_DEFAULTS` | Фоллбэки только из defaults-модуля |
| W2.2 | `fintech-config-defaults.js` | Комментарий «flag off at launch», значение `ambassador_guest_l2_enabled: true` | Синхронизировать коммент/прод-флаг |
| W2.3 | Host MLM L2 | Не гейтится `ambassador_guest_l2_enabled` | Явно в CONSTITUTION / guides |
| W2.4 | `referral-payout` program cap | Monthly/program spend считает L1+referee, L2 row всё равно может создаться | Включать L2 в cap или defer |
| W2.5 | `referral-hold` RMW | Held balance read-modify-write без atomic RPC | RPC / row lock |
| W2.6 | Guides `REFERRAL_ACCOUNTING` | Всё ещё `WalletService.addFunds` | Обновить на atomic RPC |
| W2.7 | CONSTITUTION §5 SSOT table | Нет строки referral accrual / MLM / ledger | Добавить SSOT-файлы |
| W2.8 | Payout settle / lock | Нет CAS `.eq('status',…)`; UI не шлёт `Idempotency-Key` | CAS + header из FinTech client |
| W2.9 | `payout-batch-export` | CSV без обязательного Lock | Только LOCKED+ или warn Concierge |
| W2.10 | `(batch_id, booking_id)` unique only | TOCTOU dual draft pool | Unique `booking_id` where open, или advisory lock |
| W2.11 | `FINANCIAL_FLOW_MAP` §6 | Указывает legacy `escrow/payout.service` | → `PayoutBatchService` |
| W2.12 | `ALLOW_LEGACY_PAYOUT=1` | Escape hatch на prod | Ops checklist / alert |
| W2.13 | Checkout `useCheckoutPricing` | Label = invoice; `totalWithFee` может ≠; fallback fee `15` | Один source для display+charge |
| W2.14 | `price-truth` / search | Всегда pot10 при живом v2 integer charge | Mode-aware search/calendar |
| W2.15 | `getEffectiveRate` | Множитель USDT↔THB vs retail divide — похоже мёртвый конфликт | Удалить или выровнять |
| W2.16 | DealDetails host fallback | Может показать `price_thb` (subtotal) | Guest payable / invoice |

---

### [CRITICAL]

| ID | Файл:зона | Проблема | Срочная рекомендация |
|----|-----------|----------|----------------------|
| C2.1 | `app/api/admin/finances/payout-batches/[id]/bank-package/route.js:11–12` | `GET(_request, …)` затем `requireAdminStaff(request)` → **ReferenceError**; ZIP для банка сломан | Переименовать param в `request` |
| C2.2 | `lib/services/payout-batch/payout-batch-settlement.js` | После ledger fail цикл может COMPLETED; batch **всегда** → `SETTLED`; retry → `alreadySettled` | Fail-closed: не SETTLED пока ledgerErrors; repair-settle для failed lines |
| C2.3 | settle SKIPPED + `payout-batch-creation` exclude any prior `booking_id` | Спор → SKIPPED → бронь **никогда** не попадёт в новый пул; может зависнуть `READY_FOR_PAYOUT` | Re-queue / release SKIPPED после dispute; exclude только SETTLED items |
| C2.4 | `referral-payout.service.js:378–385` | Любой `earned`/`earned_held` → skip **всего** `distribute`, в т.ч. leftover `pending` (L2) | Idempotency per-row / continue pending siblings |
| C2.5 | `referral-ledger.service.js:728–748` | Unlock: status→`earned`, debit held, **потом** wallet credit; crash → under-credit, reconciliation не лечит | Credit atomic до/вместе со status; heal cron |
| C2.6 | `lib/chat/sync-booking-for-chat-invoice.server.js:52–90` | Пишет `chat_invoice_quote` + columns, **не** чистит `final_breakdown`, **не** обновляет `rounding_diff_pot` | Invalidate v2 snapshot; set pot=0 или пересчитать; readers предпочитают invoice quote |
| C2.7 | Invoice fee economics | Prefill = guest payable → `calculateCommission(amountThb)` = fee **on top of** gross; sync back-split `price = total − fee` | Fee от lodging subtotal; snapshot legs согласованы с charge |
| C2.8 | CONSTITUTION §2.3 | Документирует **pot10** как guest payable canon; HTML CONFLICT vs v2 integer | Зафиксировать: v2 = Math.round 1 THB; pot10 = legacy only (как integrity comment) |

*Не найдено:* anon write в referral ledger; double wallet credit при штатном atomic path; живые call sites `processPayout` без guard.

---

### [MISSING] / пробелы карты (после AUDIT_02)

| Пробел | Деталь |
|--------|--------|
| Referral в CONSTITUTION §5 | Accrual/MLM/ledger не в SSOT-таблице — агенты идут в guides |
| Repair UX Concierge | Нет админ-flow «переоткрыть failed ledger lines» после partial settle |
| E2E chat invoice + v2 inquiry | Нет явного теста «stale final_breakdown vs amount_thb» |
| Search vs checkout delta | Catalog pot10 vs v2 create — до ~9 THB; не в SYSTEM_MAP UX |

---

## Зоны подробно (сводка)

### 1. Referral L2 / MLM

```
COMPLETED → distribute(guest): pool → pending L1+cashback [+ L2 if flag]
         → earned_held / atomic earned+wallet
         → cron unlock → earned + credit
Host activation: promo tank → MLM L1/L2 (не guest L2 flag)
```

Guest L2: `ambassador_guest_l2_enabled` (default **true** в defaults). Host L2 всегда при upline.

### 2. Payout-batch / Concierge

Lock → CSV/ZIP → bank → settle. ZIP **сломан** (C2.1). Settle **не fail-closed** (C2.2). Dispute SKIPPED **permanent exclude** (C2.3).

### 3. Chat invoice vs checkout

Charge с invoice: `payment-intent` → `invMeta.amount_thb`. Display/ledger часто: `final_breakdown` / columns+pot. Sync не выравнивает snapshot/pot → **divergence**.

### 4. PricingEngine v2 vs pot10

Код: dual mode. Док CONSTITUTION: pot10. Search/`price-truth`: pot10. Live v2 charge: integer 1 THB.

---

## Backlog WARN_01 (из AUDIT_01 — отдельная очередь)

| # | Тема | Статус |
|---|------|--------|
| 1 | `components/price-breakdown.js` fallback total без fee | open |
| 2 | Demo `0.15` / admin «15%» copy | open |
| 3 | Ledger balances gate ADMIN vs MODERATOR (`requireAdminStaff`) | open |
| 4 | SYSTEM_MAP path gaps (promo, payment-intent, emergency) | open |
| 5 | Crypto wallet hardcode в `app-constants` | open |
| — | DECLINED → CANCELLED map | частично fixed в partner PUT (AUDIT_01 remediation) |

---

## Предлагаемый порядок hotfix (когда скажете «чини»)

| Prio | ID | Оценка |
|------|-----|--------|
| P0 | C2.1 bank-package `request` | 1-liner |
| P0 | C2.2 settle fail-closed + repair | средний |
| P0 | C2.6–C2.7 invoice sync / fee legs | средний |
| P1 | C2.3 SKIPPED re-queue | средний |
| P1 | C2.4–C2.5 referral alreadyEarned / unlock | средний |
| P1 | C2.8 CONSTITUTION pot10 vs v2 | док |
| P2 | WARN_02 + WARN_01 backlog | по списку |

---

## Следующий шаг

После вашего ОК: hotfix P0 (bank-package + settle fail-closed + invoice snapshot), затем P1 referral/SKIPPED, затем очередь WARN_01/02. Этот файл — **только аудит**.

---

## Remediation P0 (2026-07-31)

| CRITICAL | Статус | Где |
|----------|--------|-----|
| C2.1 bank-package `request` | **Fixed** | `app/api/admin/finances/payout-batches/[id]/bank-package/route.js` |
| C2.2 settle SETTLED on ledger fail | **Fixed** | `payout-batch-settlement.js` — fail-closed + repair when SETTLED; API `422` |
| C2.6–C2.7 invoice sync / fee on gross | **Fixed** | `calculateCommissionFromGuestPayable` + sync clears `final_breakdown` / pot=0; integrity prefers invoice quote |

## Remediation P1 (2026-07-31)

| CRITICAL | Статус | Где |
|----------|--------|-----|
| C2.3 SKIPPED permanent exclude | **Fixed** | `getBookingIdsBlockedFromNewPayoutPools` — SKIPPED may re-enter pool |
| C2.4 alreadyEarned stranded pending | **Fixed** | `referral-payout.service.js` — continue pending/L2; no blanket skip |
| C2.5 unlock under-credit | **Fixed** | per-row unlock + credit; reconciliation heal `earned` |
| C2.8 CONSTITUTION pot10 vs v2 | **Fixed** | §2.3 dual-mode table; referral SSOT row |

Open: WARN_01 / WARN_02 backlog.

---

## Remediation WARN (2026-07-31)

| WARN | Статус | Где |
|------|--------|-----|
| price-breakdown total without fee | **Fixed** | `components/price-breakdown.js` |
| demo 0.15 / admin «15%» | **Fixed** | demo page + admin users copy |
| ledger MODERATOR gate | **Fixed** | `ledger-balances` → `requireAccess({ roles: ['ADMIN'] })` |
| crypto wallet hardcode | **Fixed** | env `NEXT_PUBLIC_CRYPTO_RECEIVE_WALLET` (+ fallback) |
| SYSTEM_MAP gaps | **Fixed** | payment-intent, apply-promo, emergency, payout-batches |
| Checkout fee `15` literal | **Fixed** | `PLATFORM_SPLIT_FEE_DEFAULTS` |
| Settle/lock Idempotency + CAS | **Fixed** | FinTech client + lock/export/settle |
| CSV without Lock | **Fixed** | export requires LOCKED/EXPORTED/SETTLED |
| FINANCIAL_FLOW_MAP §6 | **Fixed** | Concierge / PayoutBatchService |
| DealDetails host price_thb | **Fixed** | partner earnings only |
| getEffectiveRate conflict | **Deprecated** | unused; comment |

## Remediation WARN deferred (2026-07-31)

| WARN | Статус | Где |
|------|--------|-----|
| W2.1 fintech literals | **Fixed** | `FINTECH_JS_DEFAULTS` in policy/payout/calculator/landing/withdrawal/L2 shadow |
| W2.2 L2 flag comment | **Fixed** | `fintech-config-defaults.js` |
| W2.4 program cap + L2 | **Fixed** | `finalReferralPoolThb` includes `l2AmountThb` |
| W2.5 held RMW | **Fixed** | `adjust_held_referral_balance_thb` + CAS |
| W2.6 REFERRAL_ACCOUNTING | **Fixed** | atomic RPC / earned_held path |
| W2.14 price-truth / search | **Fixed** | `getServerGuestRoundingMode` in calendar + price-truth opts |

---

## Closure (2026-07-31) — tag `v1.0.1-audit02`

**AUDIT_02 CRITICAL + in-scope WARN remediations: CLOSED.**

| Gate | Status |
|------|--------|
| Migrations `stage201_01` → `02` → `03` | Ordered; independent objects; heartbeat TTL 1800s |
| Settle `finally` + crash path | Release in try/catch; crash → TTL reclaim; no lock-table growth |
| `npm run smoke:audit02` | Script + CI workflow `audit02-regression-smoke.yml` |
| Runbook lock hygiene | Concierge §3.1.1 + regression E2E §12 |

Remaining product debt: **WARN_01 backlog** rows still marked open above (if any copy lagged) and deferred product items outside CRITICAL — track outside AUDIT_02.

Этот файл остаётся **историческим аудитом** (+ remediation/closure append). Живой канон: Manifesto / Constitution / System Map.