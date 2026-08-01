# AUDIT_LEDGER_01 — Ledger & accounting readiness

> **Дата:** 2026-08-01  
> **Проект:** Airento / Supabase **FannRent** (`vtzzcdsjwudkaloxhvnw`)  
> **Канон:** [`ARCHITECTURAL_DECISIONS.md`](../../../ARCHITECTURAL_DECISIONS.md), [`docs/TECHNICAL_MANIFESTO.md`](../../TECHNICAL_MANIFESTO.md), [`docs/SYSTEM_MAP.md`](../../SYSTEM_MAP.md)  
> **Объём:** chart of accounts, journal/entry schema, double-entry, reconciliation, reporting, tax/regulatory gaps  
> **Ограничение:** **анализ only — код не менялся**  
> **Связь:** [`AUDIT_REPORT_03.md`](./AUDIT_REPORT_03.md) (I1/I5/I7 vacuous; money path), Concierge treasury runbook  

**Prod snapshot (из AUDIT_03, 2026-07-31):** `ledger_journals=0`, `ledger_entries=0`, `payouts=0`, `PAID_ESCROW=0`. Живых проводок нет — все ledger-инварианты **vacuous** до первого capture.

---

## 1. Ledger Readiness Score

| Вопрос | Ответ |
|--------|--------|
| **Готов к включению как books-of-record / SoT** | **NO** |
| **Готов к первому posting в прод (capture via RPC) при принятии dual-SSOT** | **CONDITIONAL** — после blockers ниже |

### Что обязательно до включения (blockers)

1. **Seed `la-sys-dispute-hold`** — JS (`dispute-hold.js`) пишет на этот `account_id`, миграции INSERT **нет** → первый dispute hold упадёт по FK.
2. **Staging / financial smoke с реальными `ledger_journals` > 0** — до go-live money нельзя полагаться на vacuous PASS (AUDIT_03 §9).
3. **Решить dual-SSOT:** партнёрский cash (`getPartnerBalance` по статусам броней) ≠ net `PARTNER_EARNINGS` в ledger. Пока баланс UI/payout eligibility booking-derived, ledger нельзя объявлять SoT обязательств.
4. **Закрыть CASCADE audit gap:** `ledger_journals.booking_id → bookings ON DELETE CASCADE` уничтожает историю проводок при удалении брони (cleanup/smoke/admin).
5. **Подтвердить GRANT + RLS** на `ledger_*` в живом проекте (RLS ON без client policies — ок; явных GRANT в ledger-миграциях нет).

### Что можно доделать после включения (nice-to-have)

- Formal trial balance API / period filters  
- `payout_id` FK column on journals (сейчас только `metadata.payout_id`)  
- Append-only triggers (запрет UPDATE/DELETE)  
- Полный chart в `GET /api/v2/admin/ledger-balances` (RU/KG/FX/losses/dispute/settled)  
- Periodic job «PAID_ESCROW без capture journal» (сейчас частично через C3.4 + idempotent RPC)  
- RPC fee-split v2 (RU/KG/FX) вместо legacy 5-leg / `v_insurance:=0`  
- VAT / tax GL accounts  
- Soft-delete booking вместо CASCADE journals  

---

## 2. Invariant Matrix (ledger-specific)

| # | Инвариант | Проверка в коде? | SQL constraint? | Риск |
|---|-----------|------------------|-----------------|------|
| **L1** | `SUM(debit)=SUM(credit)` per journal | **YES** — RPC `move_to_escrow_and_post_ledger_v1` `abs(dr-cr)>0.02` → exception; MVP `runReconciliationMvp` считает unbalanced | **NO** (нет CHECK/trigger на journal) | **WARN** — JS replay (`postPaymentCaptureFromBooking`) **не** re-assert после insert; payout settle — математика 2 строк без assert |
| **L2** | account balance = Σdebit − Σcredit | **Convention inverted in API:** `sum(CREDIT)−sum(DEBIT)` (`ledger-balances`, `ledger-balance.js`) | **NO** stored balance column | **WARN** — соглашение документировано; путаница «asset vs liability» при отчётах |
| **L3** | booking `PAID_ESCROW` → capture journal | **YES** — atomic RPC inserts journal in same txn; key `booking_payment_capture:{id}` UNIQUE | **NO** FK/trigger «status ⇒ journal» | **WARN** — обход RPC (ручной UPDATE status) оставит дыру; heal: `reconcile-confirmed-payments` только для CONFIRMED∧¬escrow |
| **L4** | payout `PAID` → obligation journal | **YES** — app path `postPartnerPayoutObligationSettled` / batch settle; key UNIQUE | **NO** DB trigger on `payouts.status` | **WARN** — fail-open если PAID без вызова ledger (порядок app); orphan journal delete при ошибке entries |
| **L5** | partner balance = ledger-derived | **NO** — SSOT = booking buckets (`balance.service.js`); columns = sync cache; drift check soft (`TOLERANCE_THB=0.05`, alert ≥3 partners) | **NO** | **MISSING** / architectural dual-SSOT |
| **L6** | platform margin = ledger-derived | **NO** — `taxable_margin_amount` на booking = guest − partner; ledger = residual platform/insurance/pot (RPC insurance=0) | **NO** | **MISSING** как GL↔tax bridge |
| **L7** | journal immutable after creation | **NO** — compensating `.delete()` journals; service_role может UPDATE/DELETE; CASCADE from booking | **NO** append-only trigger | **MISSING** |

---

## 3. CRITICAL (блокеры включения как accounting SoT)

### C-L1 — Dual SSOT: partner cash ≠ ledger

- **Где:** `lib/services/escrow/balance.service.js` (`getPartnerBalance` по `PAID_ESCROW` / `THAWED` / …); `profiles.available_balance_thb` / `frozen_balance_thb` = cache (`syncPartnerBalanceColumns`).  
- **Ledger:** `PARTNER_EARNINGS` net; reconcile в `computePartnerFinancesSummary` (`differenceThb`, tol **0.05**).  
- **Почему блокер:** включение posting не делает ledger источником правды для выплат/UI. Расхождения — soft alert (`LEDGER_DRIFT` при ≥3 партнёрах), не hard fail.

### C-L2 — `la-sys-dispute-hold` не засеян

- **Где:** `lib/services/ledger/dispute-hold.js`, `dispute-ledger-timeline.js` — hardcode `la-sys-dispute-hold`.  
- **Миграции:** INSERT отсутствует (в отличие от `030`/`032`/`053`/`056`).  
- **Эффект:** первый hold → FK fail на `ledger_entries.account_id`.

### C-L3 — Journals уничтожаются с бронью

- **Где:** `030_…sql`: `booking_id REFERENCES bookings(id) ON DELETE CASCADE`.  
- **Эффект:** cleanup/smoke/admin delete booking → потеря GL history; regulatory/audit fail.

### C-L4 — Нет append-only / immutability

- Compensating deletes в capture/settlement/dispute/treasury.  
- Нет trigger `BEFORE UPDATE OR DELETE` на `ledger_journals` / `ledger_entries`.  
- RLS deny clients, но **service_role** свободен.

### C-L5 — Prod never posted (vacuous)

- FannRent: journals=0. Atomic path не доказан на живых данных этого проекта.  
- **Требование:** staging smoke: initiate → confirm → `PAID_ESCROW` → journal balanced → (optional) payout settle.

### C-L6 — Capture RPC ≠ financial model v2 / insurance SSOT

- RPC: `v_insurance := 0`; platform = guest − partner − pot; всегда 5 legacy legs.  
- JS v2 (`fee_split_v2` → RU/KG/FX accounts) живёт в `postPaymentCaptureFromBooking` (ops replay), **не** в prod `moveToEscrow` RPC.  
- Manifesto всё ещё описывает CREDIT insurance как норму — **doc/code drift**.  
- **Эффект:** после включения ledger «PLATFORM_FEE» будет смешивать insurance+margin; RU/KG/FX accounts останутся пустыми на hot path.

---

## 4. WARN (можно постить, но риск)

### W-L1 — L1 только в RPC + soft MVP

- Payout / dispute / conversion journals: нет SQL balance assert.  
- `runReconciliationMvp` — admin/ops, не gate на posting.

### W-L2 — L3/L4 application-only

- Нет DB invariant «status implies journal».  
- Admin/manual status edits, failed mid-flight settle → silent gap until someone runs recon.

### W-L3 — `payout_id` только в metadata

- Нет колонки/индекса `ledger_journals.payout_id` → reporting by payout = JSON filter / join через batch items.

### W-L4 — Admin balances API incomplete

- `ledger-balances` SYSTEM_IDS: clearing, PLATFORM_FEE, insurance, pot.  
- Пропущены: `PARTNER_PAYOUTS_SETTLED`, `PLATFORM_FEE_RU/KG`, `FX_MARKUP_REVENUE_KG`, `FX_CONVERSION_LOSSES`, dispute-hold.

### W-L5 — Reconciliation scope MVP

- Clearing vs distribution **только** journals с guest clearing DEBIT; excludes `PARTNER_PAYOUTS_SETTLED`.  
- `payoutSelfCheck` open payouts vs PARTNER_EARNINGS — documented as often false, not Margin Leakage.  
- Gateway vs ledger: 24h window, tol **0.01** (`runGatewayLedgerReconciliation`) — полезно, не full GL.

### W-L6 — Tolerance zoo

- Legs drift absorb: **0.02**  
- Recon MVP: **0.02**  
- Partner finances: **0.05**  
- Gateway: **0.01**  
- Риск ложных PASS/FAIL при смешении отчётов.

### W-L7 — Idempotency UNIQUE ok; compensating delete race

- `idempotency_key UNIQUE` — solid.  
- Insert journal → fail entries → **delete journal** → retry ok, но окно без journal при concurrent readers.

### W-L8 — Amount convention

- `amount_thb >= 0` + `side IN ('DEBIT','CREDIT')` — **правильно** для GL.  
- Signed amounts nowhere — good. Document clearly for analysts.

### W-L9 — Multi-currency

- Books **THB-only**; RUB cols on entries are reporting shadows (`amount_total_rub`, fee rub splits).  
- Guest `price_paid` / `exchange_rate` on booking — not reconstructed from ledger alone.

---

## 5. MISSING (нужно построить)

| ID | Gap |
|----|-----|
| **M-L1** | Periodic reconcile job: `PAID_ESCROW` ∧ ¬`booking_payment_capture:{id}` → alert/heal (C3.4 covers CONFIRMED mid-flight, not all status orphans) |
| **M-L2** | Periodic: `payouts.status=PAID` ∧ ¬`payout_obligation_settled:{id}` |
| **M-L3** | Trial balance for period (`created_at` range): DR/CR per account + zero-sum check |
| **M-L4** | Booking detail API: journals+entries by `booking_id` (partner breakdown has recent entries; no first-class admin booking GL view) |
| **M-L5** | Payout detail API: journals by `metadata.payout_id` / FK |
| **M-L6** | Append-only SQL + revoke DELETE on ledger from app roles (except controlled reverse journals) |
| **M-L7** | Seed + document dispute-hold; optional REVERSE_DISPUTE event types as first-class |
| **M-L8** | Bridge report: `Σ taxable_margin_amount` (paid bookings) vs `Σ PLATFORM_FEE*` + insurance + pot credits |
| **M-L9** | VAT / tax payable accounts + posting rules (today taxable margin is booking economics only) |
| **M-L10** | Extensibility playbook: add account = INSERT seed + LEDGER_ACC + legs builder; avoid hardcoding account ids in dispute path without migration |

---

## 6. Architecture snapshot (A)

### Chart of accounts (seeded)

| id | code | type |
|----|------|------|
| `la-sys-guest-clearing` | `GUEST_PAYMENT_CLEARING` | SYSTEM |
| `la-sys-platform-fee` | `PLATFORM_FEE` | SYSTEM |
| `la-sys-insurance` | `INSURANCE_FUND_RESERVE` | SYSTEM |
| `la-sys-processing-pot` | `PROCESSING_POT_ROUNDING` | SYSTEM |
| `la-sys-partner-payouts-settled` | `PARTNER_PAYOUTS_SETTLED` | SYSTEM |
| `la-sys-platform-fee-ru` | `PLATFORM_FEE_RU_AGENT` | SYSTEM |
| `la-sys-platform-fee-kg` | `PLATFORM_FEE_KG_SERVICE` | SYSTEM |
| `la-sys-fx-markup-kg` | `FX_MARKUP_REVENUE_KG` | SYSTEM |
| `la-sys-fx-conversion-losses` | `FX_CONVERSION_LOSSES` | SYSTEM |
| `la-partner-{partnerId}` | `PARTNER_EARNINGS` | PARTNER (runtime) |
| `la-sys-dispute-hold` | *(intended)* | **NOT SEEDED** |

Sources: `database/migrations/030_*.sql`, `032_*.sql`, `053_*.sql`, `056_*.sql`; constants `LEDGER_ACC` in `lib/services/ledger/ledger-shared.js`.

### Journal / entry schema

**`ledger_journals`:** `id`, `booking_id` (nullable post-032), `event_type`, **`idempotency_key` UNIQUE**, `metadata` JSONB, `created_at`. Index on `booking_id`.

**`ledger_entries`:** `id`, `journal_id` CASCADE, `account_id` RESTRICT, `side` CHECK DEBIT|CREDIT, **`amount_thb >= 0`**, `description`, `metadata`, `created_at`; later RUB/conversion columns (`053`, `056`). Indexes: `journal_id`, `account_id`.

### Double-entry & idempotency

- Assert: RPC after insert entries (±0.02).  
- Duplicate: UNIQUE `idempotency_key` → skip / 23505 treated as success.  
- Keys: `booking_payment_capture:{bookingId}`, `payout_obligation_settled:{payoutId}`, `payout_batch_settled:{batchId}:{bookingId}`, `dispute_hold:{disputeId}`.

### Hot paths

| Event | Mechanism |
|-------|-----------|
| Capture | `EscrowService.moveToEscrow` → `move_to_escrow_and_post_ledger_v1` |
| Capture replay | `LedgerService.postPaymentCaptureFromBooking` (ops; not on hot path) |
| Payout PAID | `postPartnerPayoutObligationSettled` (admin payout route) / batch settle |
| Dispute | `dispute-hold.js` |

---

## 7. Reconciliation / reporting / tax (B–D summary)

| Topic | Status |
|-------|--------|
| Booking → ledger | Atomic with PAID_ESCROW via RPC |
| Payout → ledger | App-level on PAID / batch |
| Partner balance vs ledger | Soft drift only |
| Platform margin vs ledger | No automated bridge |
| Reconcile jobs | MVP admin + financial-health + gateway 24h + C3.4 confirmed-without-escrow |
| Trial balance | **MISSING** |
| Booking/payout GL detail | Partial / metadata |
| Immutability | **MISSING** |
| `taxable_margin_amount` | Booking column; not GL |
| Insurance | Separate account; **RPC posts 0** (folded into PLATFORM_FEE) |
| Multi-currency | THB GL; FX markup/losses accounts; booking stores rate/paid |
| VAT later | New SYSTEM accounts + posting module feasible; no schema pain if ids TEXT + seed INSERT |

---

## 8. SQL Queries for Verification

Запускать после появления первых journals (staging или prod post-go-live).

### 8.1 Unbalanced journals (L1)

```sql
SELECT j.id, j.idempotency_key, j.booking_id, j.event_type,
       SUM(CASE WHEN e.side = 'DEBIT' THEN e.amount_thb ELSE 0 END) AS dr,
       SUM(CASE WHEN e.side = 'CREDIT' THEN e.amount_thb ELSE 0 END) AS cr,
       ABS(
         SUM(CASE WHEN e.side = 'DEBIT' THEN e.amount_thb ELSE 0 END)
         - SUM(CASE WHEN e.side = 'CREDIT' THEN e.amount_thb ELSE 0 END)
       ) AS imbalance
FROM ledger_journals j
JOIN ledger_entries e ON e.journal_id = j.id
GROUP BY j.id, j.idempotency_key, j.booking_id, j.event_type
HAVING ABS(
  SUM(CASE WHEN e.side = 'DEBIT' THEN e.amount_thb ELSE 0 END)
  - SUM(CASE WHEN e.side = 'CREDIT' THEN e.amount_thb ELSE 0 END)
) > 0.02;
```

### 8.2 PAID_ESCROW without capture journal (L3)

```sql
SELECT b.id, b.status, b.partner_earnings_thb, b.price_thb, b.updated_at
FROM bookings b
WHERE upper(b.status::text) = 'PAID_ESCROW'
  AND NOT EXISTS (
    SELECT 1 FROM ledger_journals j
    WHERE j.idempotency_key = 'booking_payment_capture:' || b.id
  );
```

### 8.3 PAID payouts without obligation journal (L4)

```sql
SELECT p.id, p.partner_id, p.status, p.gross_amount, p.amount
FROM payouts p
WHERE upper(p.status::text) = 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM ledger_journals j
    WHERE j.idempotency_key = 'payout_obligation_settled:' || p.id
  );
```

### 8.4 Account nets (API convention: CREDIT − DEBIT)

```sql
SELECT a.code, a.partner_id, a.account_type,
       COALESCE(SUM(CASE WHEN e.side = 'CREDIT' THEN e.amount_thb ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN e.side = 'DEBIT' THEN e.amount_thb ELSE 0 END), 0) AS net_thb
FROM ledger_accounts a
LEFT JOIN ledger_entries e ON e.account_id = a.id
GROUP BY a.id, a.code, a.partner_id, a.account_type
ORDER BY a.code, a.partner_id NULLS FIRST;
```

### 8.5 Booking capture detail

```sql
SELECT j.id AS journal_id, j.event_type, j.idempotency_key,
       a.code, e.side, e.amount_thb, e.description
FROM ledger_journals j
JOIN ledger_entries e ON e.journal_id = j.id
JOIN ledger_accounts a ON a.id = e.account_id
WHERE j.booking_id = '<BOOKING_ID>'
ORDER BY j.created_at, e.side, a.code;
```

### 8.6 Payout settle detail

```sql
SELECT j.id, j.event_type, j.idempotency_key, j.metadata->>'payout_id' AS payout_id,
       a.code, e.side, e.amount_thb
FROM ledger_journals j
JOIN ledger_entries e ON e.journal_id = j.id
JOIN ledger_accounts a ON a.id = e.account_id
WHERE j.metadata->>'payout_id' = '<PAYOUT_ID>'
   OR j.idempotency_key = 'payout_obligation_settled:' || '<PAYOUT_ID>';
```

### 8.7 Platform margin bridge (L6 probe)

```sql
-- Booking taxable margin (paid pipe) vs ledger platform-ish credits in capture journals
WITH paid AS (
  SELECT id, taxable_margin_amount, partner_earnings_thb, price_thb
  FROM bookings
  WHERE upper(status::text) IN ('PAID_ESCROW','THAWED','READY_FOR_PAYOUT','COMPLETED','PAID')
),
cap AS (
  SELECT j.booking_id,
         SUM(CASE WHEN a.code IN (
               'PLATFORM_FEE','PLATFORM_FEE_RU_AGENT','PLATFORM_FEE_KG_SERVICE',
               'FX_MARKUP_REVENUE_KG','INSURANCE_FUND_RESERVE','PROCESSING_POT_ROUNDING'
             ) AND e.side = 'CREDIT' THEN e.amount_thb ELSE 0 END) AS platformish_cr
  FROM ledger_journals j
  JOIN ledger_entries e ON e.journal_id = j.id
  JOIN ledger_accounts a ON a.id = e.account_id
  WHERE j.idempotency_key LIKE 'booking_payment_capture:%'
  GROUP BY j.booking_id
)
SELECT p.id,
       p.taxable_margin_amount,
       c.platformish_cr,
       ROUND(COALESCE(p.taxable_margin_amount,0) - COALESCE(c.platformish_cr,0), 2) AS delta
FROM paid p
LEFT JOIN cap c ON c.booking_id = p.id
WHERE ABS(COALESCE(p.taxable_margin_amount,0) - COALESCE(c.platformish_cr,0)) > 0.05;
```

### 8.8 Dispute-hold account exists?

```sql
SELECT id, code, display_name FROM ledger_accounts WHERE id = 'la-sys-dispute-hold';
-- Expect 1 row before enabling disputes that post hold.
```

### 8.9 Duplicate idempotency (should be empty)

```sql
SELECT idempotency_key, COUNT(*)
FROM ledger_journals
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
```

---

## 9. Verdict

**Не объявлять ledger «включённым» как бухгалтерский SoT.** Hot-path capture posting **уже в коде** и архитектурно сильный (atomic RPC + UNIQUE key), но:

1. обязательства партнёра живут в booking buckets, не в GL;  
2. ~~dispute account не засеян;~~ → **fixed Stage 203.01** (pending apply)  
3. ~~история проводок не append-only и CASCADE-хрупкая;~~ → **fixed Stage 203.02–03** (pending apply)  
4. RPC не отражает v2 fee split / insurance;  
5. на FannRent нет ни одной живой проводки.

**Минимальный путь к CONDITIONAL go-live posting:** apply Stage **203.01→03** → staging smoke с journals → accept dual-SSOT + monitoring → не удалять money bookings (cleanup already skips).  
**Путь к YES (books-of-record):** + hard reconcile L3/L4, + single SSOT partner liability from ledger, + RPC/legs alignment with tax/insurance policy, + trial balance.

### Remediation (C-L2 / C-L3 / C-L4) — 2026-08-01

| ID | Status | Artifact |
|----|--------|----------|
| C-L2 | **fixed** (pending apply) | `migrations/stage203_01_seed_dispute_hold_account.sql` |
| C-L3 | **fixed** (pending apply) | `migrations/stage203_02_ledger_fk_no_cascade.sql` + cleanup skip money statuses |
| C-L4 | **fixed** (pending apply) | `migrations/stage203_03_ledger_append_only.sql` + `ledger-append-only.js` |
| C-L1 dual SSOT | deferred | — |
| C-L5 vacuous | ops | **`npm run smoke:ledger-first-posting`** (staging) |
| C-L6 RPC fee split | deferred | only if ADR-203 **A** — not without owner OK |

---

*End of AUDIT_LEDGER_01 — analysis only (remediation SQL/JS added in follow-up; dual-SSOT/RPC unchanged).*
