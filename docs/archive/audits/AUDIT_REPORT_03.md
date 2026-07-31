# AUDIT REPORT 03 — Systemic money-flow risks (booking → partner payout)

> **Дата:** 2026-07-31  
> **Проект:** Airento / Supabase **FannRent** (`vtzzcdsjwudkaloxhvnw`)  
> **Канон:** [`docs/CONSTITUTION.md`](../../CONSTITUTION.md), [`docs/SYSTEM_MAP.md`](../../SYSTEM_MAP.md), [`ARCHITECTURAL_DECISIONS.md`](../../../ARCHITECTURAL_DECISIONS.md)  
> **Объём:** end-to-end цепочка денег + cross-system + external boundaries + invariant matrix I1–I8  
> **Ограничение:** **анализ only — код не менялся**  
> **Связь:** [`AUDIT_REPORT_01.md`](./AUDIT_REPORT_01.md), [`AUDIT_REPORT_02.md`](./AUDIT_REPORT_02.md) (точечные money bugs закрыты; здесь — паттерны)

**Prod snapshot (SQL, 2026-07-31):** `bookings=11`, `ledger_journals=0`, `ledger_entries=0`, `payouts=0`, `PAID_ESCROW=0`, `critical_signal_events=354` (с 2026-04-08), `chat_push_delivery_batch` stale>24h = 0.

---

## 1. Executive Summary

| Severity | Count |
|----------|------:|
| **CRITICAL** | **11** |
| **WARN** | **14** |
| **MISSING** | **8** |

Деньги в целом **unsafe для масштаба и для crypto/admin payout concurrency**, несмотря на закрытый AUDIT_02 Concierge-settle: card/intent escrow-path имеет сильную идемпотентность (`booking_payment_capture:{id}` + RPC), но **crypto webhook доверяет caller amount + не уникализирует txid**, **partner/admin payouts без CAS**, **invoice→intent sticky amount**, **thaw scan `.limit(800)` без due-filter**, а **system alerts по умолчанию режутся до 1/сутки**. На текущем объёме FannRent (нет ledger journals / payouts) денежные инварианты I1–I3/I5/I7 **vacuous PASS** — код-дыры ещё не «взорвались» в данных.

---

## 2. Invariant Matrix

| # | Инвариант | Результат | Пояснение |
|---|-----------|-----------|-----------|
| **I1** | `SUM(debit)=SUM(credit)` per journal | **PASS (vacuous)** | `ledger_journals=0`. Код RPC assert ±0.02; живых нарушений нет. |
| **I2** | `partner_earnings_thb` = Σ PARTNER_EARNINGS credits | **CANNOT VERIFY** | Нет journals; нет paid bookings. Схема: journal→entries via `account_id`, не `booking_id` на entry. |
| **I3** | `available+frozen` = Σ partner_earnings | **CANNOT VERIFY** | Нет post-escrow броней; available считается сервисом (THAWED − pending), колонки — sync-кэш. |
| **I4** | `price_thb = pricing_snapshot.totalPrice` | **FAIL** | `totalPrice` часто **null**; у AWAITING_PAYMENT: `price_thb=10625`, `chat_invoice_quote=12500`, `fee_split_v2.guest_payable=155250` (stale от 135k inquiry). Инвариант сформулирован слишком узко — реальность multi-SSOT. |
| **I5** | `PAID_ESCROW` → capture journal | **PASS (vacuous)** | `PAID_ESCROW=0`. Код: atomic RPC. |
| **I6** | `THAWED` → `now >= escrow_thaw_at` | **PASS (vacuous)** | Нет THAWED. Риск раннего thaw — TZ fallback / backfill `escrow_started=now` (WARN). |
| **I7** | `payouts.PAID` → obligation journal | **PASS (vacuous)** | `payouts=0`. Код: key `payout_obligation_settled:{id}`. |
| **I8** | push batch нет строк >24h | **PASS** | Stale count = 0 (`window_deadline_at`/`updated_at`). |

---

## 3. Systemic Patterns Found

### P-A — Client/caller controls verification truth
Сумма/флаги с клиента обходят server SSOT.  
**Места:** crypto `expectedAmount` · verify-tron `expectedAmountUsdt` · inquiry `privateTrip`/`contactInquiry`/`negotiationRequest` skip attestation · payment-intent `Boolean(invoice)` → amount always «matches».

### P-B — Status mutate before external/ledger confirm (fail-open mid-flight)
Статус пишется до завершения денег.  
**Места:** `PaymentsV3Service.confirmPayment` → `CONFIRMED` затем `moveToEscrow` · admin PATCH ledger-then-status (обратный порядок, но без CAS) · tbank CSV mark PROCESSING per-row без txn.

### P-C — Read-check-write without CAS / row lock
Concurrent admins/partners дублируют деньги.  
**Места:** `requestPayout` · `exportRegistryAndMarkProcessing` · `PATCH /admin/payouts/[id]` PAID/FAILED · thaw page без `ORDER BY escrow_thaw_at`.

### P-D — Dual writers / dual money paths
Один бизнес-событие — несколько входов.  
**Места:** crypto webhook vs verify-tron · payment-intent webhook vs legacy `payments` · Concierge batch settle vs manual partner `payouts` · JS ledger legs vs RPC insurance=0.

### P-E — Soft fail-open guards
Пустой список / parse fail = «разрешено».  
**Места:** `allowed_methods.length > 0` · Tron `amount > 0` иначе skip underpay · invalid timezone → Bangkok · `SYSTEM_ALERT_DAILY_LIMIT` default 1.

### P-F — Snapshot not immutable
`pricing_snapshot` переписывается invoice sync / promo; columns и nested quotes расходятся (см. I4 FAIL на prod).

---

## 4. CRITICAL (P0)

| ID | Зона | Суть | Exploit / edge | Fix strategy (не делать сейчас) |
|----|------|------|----------------|----------------------------------|
| **C3.1** | Crypto webhook | Body `expectedAmount` перекрывает `getExpectedUsdtForBooking` | С `CRYPTO_WEBHOOK_SHARED_SECRET`: on-chain 1 USDT + `expectedAmount:1` → бронь на полную сумму | Игнорировать body amount; только DB/intent SSOT |
| **C3.2** | Crypto | Нет UNIQUE на `txid` / global settle CAS | Один успешный tx → settle N PENDING bookings | Unique `(tx_id)` + claim before confirm |
| **C3.3** | Tron verify | Если `txInfo.amount==0` (parse miss) — underpay check **skipped** → SUCCESS | Сломанный TronScan shape → оплата без суммы | Fail-closed если amount unresolved |
| **C3.4** | Crypto / payments-v3 | `CONFIRMED` до escrow; retry short-circuit `alreadyConfirmed` без escrow | Crash mid-flight → paid row, booking не PAID_ESCROW | Confirm+escrow в одной txn / reconcile path |
| **C3.5** | Partner payout request | TOCTOU: read available → insert PENDING, no lock | 2× concurrent request на весь available | Atomic reserve RPC / `FOR UPDATE` wallet+sum |
| **C3.6** | T-Bank registry | PROCESSING update без `.eq('status','PENDING')` | 2 админа → 2 CSV с одними payouts → double bank pay | CAS update returning; build CSV only from claimed rows |
| **C3.7** | Admin PATCH payout | PAID/FAILED без status CAS; FAILED может перезаписать PAID | Admin A PAID+ledger; Admin B FAILED → резерв снят, ledger settled, банк уже платил | `.eq('status', expected)`; forbid FAILED after PAID; reverse ledger |
| **C3.8** | Invoice → intent | `amountMatches = Boolean(invoice) \|\| …` — при invoice всегда true | Host re-invoice ↑ price; guest платит sticky old intent | Compare intent.amount to invoice.amount_thb; recreate on mismatch |
| **C3.9** | Invoice sync | POST invoice переписывает booking amounts без status gate | Mutate AWAITING_PAYMENT / post-checkout | Block sync if paid/intent active; or version invoice |
| **C3.10** | Escrow thaw | `.limit(800)` PAID_ESCROW **без** `escrow_thaw_at<=now` / ORDER BY | >800 escrowed → due rows вне страницы не thaw'ятся | Filter due in SQL + order + cursor |
| **C3.11** | Ops alerts | `SYSTEM_ALERT_DAILY_LIMIT` default **1** | После 1 алерта/сутки money/webhook alerts silent | Raise limit; bypass for CRITICAL/money |

---

## 5. WARN (P1)

| ID | Зона | Суть | Когда | Mitigation |
|----|------|------|-------|------------|
| **W3.1** | Inquiry create | `privateTrip`/`negotiationRequest`/`contactInquiry` skip attestation + min 100 | Client flags | Re-gate at invoice→pay |
| **W3.2** | Min 100 THB | Не на chat invoice / partner manual booking | Special offer / offline | Platform payment invariant |
| **W3.3** | Guest total attestation | Optional skip → `{ok, skipped}` | Omit clientQuotedGuestTotalThb | Require on payable create |
| **W3.4** | Atomic booking RPC | Нет retry на lock timeout/deadlock | Contended listing | Backoff + telemetry |
| **W3.5** | Payment intent | `allowed_methods=[]` fail-opens method check | Legacy/corrupt intent | Treat empty as deny or default set |
| **W3.6** | Card webhook | Legacy `payments` path рядом с intent | Non-pi payment ids | Sunset legacy |
| **W3.7** | Escrow legs | JS insurance/v2 vs RPC `v_insurance:=0` | Fee taxonomy drift | Single SSOT in RPC args |
| **W3.8** | Thaw TZ | Invalid TZ → Asia/Bangkok | Wrong listing metadata | Reject / alert on invalid TZ |
| **W3.9** | Thaw cron lag | Hourly (or daily Hobby) | Up to ~1h (or 1d) delay | Acceptable ops; document SLO |
| **W3.10** | Payout method | `ON DELETE SET NULL` + null method fee=0 | Admin deletes method | Reject null method_id |
| **W3.11** | Crypto FX | Live `resolveThbPerUsdt` vs booking lock | USDT rate move after create | Lock USDT at create/initiate |
| **W3.12** | Cron secret | Shared secret, not timingSafeEqual | Leak → mass job trigger (not forge thaw_at) | Per-job secrets + timingSafe |
| **W3.13** | Dual schedulers | Vercel + cron-job.org (+ GHA push) | Duplicate runs | Distributed lock / single owner |
| **W3.14** | Snapshot / I4 | Multi-SSOT columns vs quote vs fee_split | Invoice + stale v2 | Document SSOT hierarchy; scrub stale fee_split on invoice |

---

## 6. MISSING (P2)

| ID | Зона | Что отсутствует | Почему важно |
|----|------|-----------------|--------------|
| **M3.1** | Crypto | Unique txid + ignore client amount | Blocks C3.1–C3.2 |
| **M3.2** | Crypto | Reconcile CONFIRMED∧¬PAID_ESCROW | Heals C3.4 |
| **M3.3** | Payouts | Atomic request + CAS admin transitions | Blocks C3.5–C3.7 |
| **M3.4** | Invoice | Status guard + intent amount CAS | Blocks C3.8–C3.9 |
| **M3.5** | Thaw | Due-filtered scanner + metrics lag | Blocks C3.10 |
| **M3.6** | Telemetry | Retention/TTL for `critical_signal_events` | 354 rows since Apr; unbounded |
| **M3.7** | Alerts | CRITICAL bypass daily guard | Ops blindness C3.11 |
| **M3.8** | Tests/E2E | Concurrent payout / crypto replay / invoice reprice | Regressions silent |

---

## 7. SQL Queries for Manual Verification

Выполнять в **Supabase SQL Editor** (service role / dashboard).

### I1 — Unbalanced journals

```sql
SELECT j.id, j.idempotency_key, j.booking_id,
       SUM(CASE WHEN upper(e.side) IN ('DEBIT','DR') THEN e.amount_thb ELSE 0 END) AS debit,
       SUM(CASE WHEN upper(e.side) IN ('CREDIT','CR') THEN e.amount_thb ELSE 0 END) AS credit
FROM ledger_journals j
JOIN ledger_entries e ON e.journal_id = j.id
GROUP BY j.id, j.idempotency_key, j.booking_id
HAVING ABS(
  SUM(CASE WHEN upper(e.side) IN ('DEBIT','DR') THEN e.amount_thb ELSE 0 END)
  - SUM(CASE WHEN upper(e.side) IN ('CREDIT','CR') THEN e.amount_thb ELSE 0 END)
) > 0.02;
```

### I2 — Partner earnings vs ledger (adjust account code to live `ledger_accounts.code`)

```sql
SELECT b.id, b.partner_earnings_thb,
       coalesce(sum(e.amount_thb) FILTER (WHERE upper(e.side) IN ('CREDIT','CR')), 0) AS ledger_partner_cr
FROM bookings b
LEFT JOIN ledger_journals j ON j.booking_id = b.id
LEFT JOIN ledger_entries e ON e.journal_id = j.id
LEFT JOIN ledger_accounts a ON a.id = e.account_id
WHERE b.status IN ('PAID_ESCROW','THAWED','READY_FOR_PAYOUT','COMPLETED','CHECKED_IN')
  AND (a.code ILIKE '%PARTNER%EARN%' OR a.id ILIKE '%partner%earn%')
GROUP BY b.id, b.partner_earnings_thb
HAVING abs(coalesce(b.partner_earnings_thb,0)
  - coalesce(sum(e.amount_thb) FILTER (WHERE upper(e.side) IN ('CREDIT','CR')),0)) > 1;
```

### I4 — Snapshot / column drift (FAIL observed)

```sql
SELECT id, status, price_thb, commission_thb, rounding_diff_pot,
       pricing_snapshot->>'totalPrice' AS snap_total,
       pricing_snapshot->'chat_invoice_quote'->>'amount_thb' AS inv_quote,
       pricing_snapshot->'fee_split_v2'->>'guest_payable_rounded_thb' AS v2_payable,
       metadata->>'chat_invoice_amount_thb' AS meta_inv
FROM bookings
WHERE status IN ('AWAITING_PAYMENT','PENDING','PAID_ESCROW','INQUIRY')
ORDER BY created_at DESC
LIMIT 50;
```

### I5 — PAID_ESCROW without capture journal

```sql
SELECT b.id, b.status, b.updated_at
FROM bookings b
WHERE b.status = 'PAID_ESCROW'
  AND NOT EXISTS (
    SELECT 1 FROM ledger_journals j
    WHERE j.idempotency_key = 'booking_payment_capture:' || b.id
  );
```

### I6 — THAWED before thaw time

```sql
SELECT id, status, escrow_thaw_at, updated_at
FROM bookings
WHERE status = 'THAWED'
  AND escrow_thaw_at IS NOT NULL
  AND escrow_thaw_at > updated_at + interval '1 minute';
```

### I7 — PAID payout without obligation journal

```sql
SELECT p.id, p.status, p.partner_id, p.gross_amount
FROM payouts p
WHERE upper(p.status) = 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM ledger_journals j
    WHERE j.idempotency_key = 'payout_obligation_settled:' || p.id
  );
```

### I8 — Stale push batches

```sql
SELECT count(*) AS stale_batches
FROM chat_push_delivery_batch
WHERE coalesce(window_deadline_at, updated_at) < now() - interval '24 hours';
```

### Extra — Crypto replay surface / CONFIRMED stranded

```sql
-- Duplicate tx_id across payments (when data exists)
SELECT tx_id, count(*) FROM payments
WHERE tx_id IS NOT NULL AND trim(tx_id) <> ''
GROUP BY 1 HAVING count(*) > 1;

-- CONFIRMED payment but booking not in escrow pipeline
SELECT p.id, p.booking_id, p.status AS pay_status, b.status AS book_status
FROM payments p
JOIN bookings b ON b.id = p.booking_id
WHERE upper(p.status) = 'CONFIRMED'
  AND upper(b.status) NOT IN ('PAID_ESCROW','CHECKED_IN','THAWED','READY_FOR_PAYOUT','COMPLETED');
```

---

## 8. Next Steps

### Очереди

| Queue | Items | Priority | Status |
|-------|-------|----------|--------|
| **CRITICAL_03** | **C3.1** expectedAmount override | P0 | **fixed** `79f91f69` |
| **CRITICAL_03** | **C3.2** crypto txid replay | P0 | **fixed** `de60c5e3` |
| **CRITICAL_03** | **C3.3** Tron amount=0 skip | P0 | **fixed** `8cd38e74` |
| **CRITICAL_03** | **C3.4** CONFIRMED without escrow | P0 | **fixed** `076b2a31` |
| **CRITICAL_03** | C3.5 partner payout TOCTOU | P0 | **fixed** `c09b3634` |
| **CRITICAL_03** | C3.6/C3.7 admin CAS + T-Bank | P0 | **fixed** `e82a865b` |
| **CRITICAL_03** | C3.8 invoice sticky intent | P0 | **fixed** `26577b76` |
| **CRITICAL_03** | **C3.9** invoice status gate | P0 | **fixed** `81227b35` |
| **CRITICAL_03** | C3.10 thaw .limit(800) | P0 | **fixed** `90ff15c8` |
| **CRITICAL_03** | C3.11 alert daily limit | P0 | **fixed** `fd63d14f` |
| **WARN_03** | **W3.1** inquiry attestation re-gate | P1 | **fixed** (pending commit) |
| **WARN_03** | **W3.2** min 100 chat invoice | P1 | **fixed** (pending commit) |
| **WARN_03** | W3.3 guest attestation optional | P1 | deferred |
| **WARN_03** | **W3.4** atomic RPC lock retry | P1 | **fixed** (pending commit) |
| **WARN_03** | **W3.5** empty allowed_methods | P1 | **fixed** (pending commit) — fail-closed `NO_PAYMENT_METHODS_AVAILABLE` |
| **WARN_03** | **W3.6** legacy payments deprecation | P1 | **fixed** (pending commit) |
| **WARN_03** | **W3.7** escrow insurance SSOT | P1 | **fixed** (pending commit) — JS folds insurance→platform to match RPC `v_insurance:=0` |
| **WARN_03** | **W3.8** TZ invalid alert | P1 | **fixed** (pending commit) |
| **WARN_03** | **W3.9** thaw SLO docs | P1 | **fixed** (pending commit) |
| **WARN_03** | **W3.10** payout method null | P1 | **fixed** (pending commit) |
| **WARN_03** | **W3.11** crypto FX lock | P1 | **fixed** (pending commit) |
| **WARN_03** | **W3.12** cron timingSafeEqual | P1 | **fixed** (pending commit) |
| **WARN_03** | **W3.13** dual schedulers docs | P1 | **fixed** (pending commit) |
| **WARN_03** | W3.14 snapshot / I4 | P1 | deferred |
| **MISSING_03** | M3.1–M3.5, M3.8 | P2 | deferred (mostly covered by CRITICAL) |
| **MISSING_03** | **M3.6** critical_signal retention | P2 | **fixed** (pending commit) |
| **MISSING_03** | **M3.7** CRITICAL alert ceiling | P2 | **fixed** (pending commit) |

### Remediation commits (CRITICAL only)

| CRITICAL | Commit | Notes |
|----------|--------|-------|
| C3.1 | `79f91f69` | Ignore body `expectedAmount`; USDT SSOT = `getExpectedUsdtForBooking` / intent `amountThb`→USDT |
| C3.2 | `de60c5e3` | `payments_tx_id_unique` + `assertCryptoTxidAvailable` → 409 `already_processed`; key `crypto_payment:{txid}:{booking_id}` |
| C3.3 | `8cd38e74` | `verifyTronTransaction`: unresolved/`0` amount + expected → `AMOUNT_UNRESOLVED` (fail-closed; no underpay skip) |
| C3.4 | `076b2a31` | `ensureEscrowForConfirmedPayment` + cron `/api/cron/reconcile-confirmed-payments`; `metadata.escrow_attempted_at` |
| C3.5 | `c09b3634` | RPC `insert_partner_host_payout_if_available` (advisory lock + reserve vs gross); no debit of `profiles.available_balance_thb` |
| C3.6/C3.7 | `e82a865b` | Admin PATCH CAS `updated_at` + status; T-Bank `claim_payouts_for_tbank_registry` |
| C3.8 | `26577b76` | Intent reuse requires matching invoice_id + amount_thb; metadata.invoice_id |
| C3.9 | `81227b35` | `syncBookingForPayableChatInvoice` blocks escrow/COMPLETED + active intents → 409 `BOOKING_ALREADY_PAID` |
| C3.10 | `90ff15c8` | Cursor pagination over PAID_ESCROW |
| C3.11 | `fd63d14f` | Hourly per-class alert window (default 20); env `SYSTEM_ALERT_HOURLY_LIMIT` |

### Рекомендации процесса

1. Не смешивать CRITICAL_03 с feature work — отдельный money-hardening PR.  
2. После фиксов — `smoke` concurrent payout + crypto replay + invoice reprice.  
3. Повторять **AUDIT_03-style** systemic pass **раз в квартал** (или после любого нового PSP / payout rail).  
4. Пока `ledger_journals=0` в prod — добавить staging financial smoke с реальными journals до go-live money.
5. CRITICAL_03 закрыты. Safe + risky WARN (кроме **W3.3**, **W3.14**) — в working tree (pending commit). MISSING: M3.6–7 fixed; M3.8 deferred.

---

## Appendix — Scope checklist (brief)

| # | Topic | Verdict |
|---|-------|---------|
| A1 Booking create | Standard path OK; inquiry flags / min bypass WARN→CRITICAL via invoice | |
| A2 Payment initiate | Adapter fail-closed OK; empty allowed_methods WARN | |
| A3 Card webhooks | Sig 401 OK; legacy path WARN | |
| A4 moveToEscrow | Atomic RPC OK; JS≠RPC legs WARN | |
| A5 Thaw | 800-scan CRITICAL latent; TZ/cron WARN | |
| A6 Partner request | KYC OK; TOCTOU CRITICAL | |
| A7 Admin payout | No CAS CRITICAL; ledger key OK | |
| B8 Invoice/checkout | Sticky intent CRITICAL | |
| B9 Snapshot | Mutable; I4 FAIL | |
| B10 FX | Crypto live rate WARN→CRITICAL arbitrage | |
| C11 Crypto | C3.1–C3.4 | |
| C12 Cron | Auth OK; leak mass-trigger WARN | |
| C13 Alerts/telemetry | Daily limit CRITICAL; retention MISSING | |

*AUDIT_03 analysis was code-read only; CRITICAL remediations from §8 ТЗ landed in commits above.*

