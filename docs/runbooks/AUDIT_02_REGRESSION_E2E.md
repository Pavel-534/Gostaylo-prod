# AUDIT_02 — Critical-path regression (manual + auto)

**Цель:** проверить remediations AUDIT_02 на Concierge settle / chat invoice / referral unlock / SKIPPED re-queue.  
**Статус:** **CLOSED** (tag `v1.0.1-audit02`) — remaining = WARN backlog only.  
**Авто:** `npm run smoke:audit02` → `lib/smoke/audit02-regression-smoke.js`  
**CI:** `.github/workflows/audit02-regression-smoke.yml` (PR/push to `main`, secrets-gated)  
**Миграции:** `stage201_01` → `stage201_02` → `stage201_03` (held + settle claim/release + heartbeat).

---

## Автоматический прогон

```bash
# .env с SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL
npm run smoke:audit02
npm run smoke:audit02 -- --skip-cleanup
```

Скрипт симулирует (service_role, без UI):

1. Chat invoice sync → charge = `chat_invoice_quote` / metadata / `fee_split_v2`  
2. 3× READY bookings → draft pool → Lock  
3. Partial settle (пустой `partner_id` на 3-м item) → batch `LOCKED`, 2× `SETTLED`, 1 ledger fail  
4. Repair settle → journals **ровно 1** на booking; batch `SETTLED`  
5. Dispute meta → settle → item `SKIPPED` → clear freeze → новый пул  
6. Referral `earned_held` → held = Σ rows → unlock → `earned` + credit  

---

## Settle lock / TTL (pre-merge checklist)

| Item | Verdict |
|------|---------|
| Migration order | Independent RPCs; apply **01 → 02 → 03**; no shared-object race |
| Typical settle duration X | Mid-pool ledger + PDF ≈ **2–5 min**; serverless often ≤300s |
| TTL | **1800s** (+ heartbeat every ~45s) — X ≪ TTL |
| `finally` release | try/catch around release; crash → TTL reclaim only |
| Lock growth | Metadata keys only — reclaim/release clears; see Concierge §3.1.1 |

---

## Ручной чек-лист (UI / staging)

### Предусловия

| | |
|--|--|
| Env | `PRICING_ENGINE_V2=true`, service role, stage201_01/02/03 applied |
| Партнёр | verified + payout profile |
| FinTech | `/admin/settings/finances` Concierge |

### Шаги

| # | Действие | Проверка |
|---|----------|----------|
| 1 | Guest: inquiry → host chat invoice Special Offer | Checkout total = invoice amount; snapshot **без** stale `final_breakdown`; `rounding_diff_pot=0` |
| 2 | Host «подтверждает» / guest платит | `AWAITING_PAYMENT` → `PAID_ESCROW`; host UI status + `partner_earnings_thb` |
| 3 | Thaw + promote (cron или wait) | `THAWED` → `READY_FOR_PAYOUT` |
| 4 | Admin: сформировать пул (≥3 строк) | DRAFT → Lock → CSV |
| 5 | *Staging only:* сломать 1 item (`partner_id=''`) → «Закрыть пул» | HTTP **422** `ledger_errors`; batch **LOCKED**; 2 items **SETTLED**; TG partial alert |
| 6 | SQL: `ledger_journals` where `idempotency_key like 'payout_batch_settled:%'` | **1** journal на каждый успешный booking |
| 7 | Восстановить `partner_id` → settle снова | Success; journals всё ещё **1** (idempotent); batch **SETTLED** |
| 8 | Double-click settle | Второй → **409** `settle_in_progress` (или уже SETTLED repair без дублей PDF) |
| 9 | Guest открывает спор с freeze на READY-брони в новом пуле → settle | Item **SKIPPED** |
| 10 | Закрыть спор / снять freeze → новый пул | Booking снова в pool (SKIPPED не блокирует `getBookingIdsBlocked…`) |
| 11 | Referral hold → unlock cron/smoke | `held_referral_balance_thb` = Σ `earned_held`; после unlock → `earned` + wallet credit, held сходится |
| 12 | Lock hygiene | Нет stale `settle_lock_token` старше TTL (Concierge §3.1.1) |

### SQL sanity

```sql
-- Idempotent settle journals
SELECT idempotency_key, count(*)
FROM ledger_journals
WHERE idempotency_key LIKE 'payout_batch_settled:%'
  AND idempotency_key LIKE '%:<booking_id>'
GROUP BY 1;

-- Batch / items
SELECT status, metadata->>'last_settle_partial'
FROM payout_batches WHERE id = '<batch_id>';
SELECT booking_id, status, metadata->>'ledger_error'
FROM payout_batch_items WHERE batch_id = '<batch_id>';

-- Invoice charge SSOT
SELECT
  metadata->>'chat_invoice_amount_thb',
  pricing_snapshot->'chat_invoice_quote'->>'amount_thb',
  pricing_snapshot->'fee_split_v2'->>'guest_payable_rounded_thb',
  pricing_snapshot ? 'final_breakdown' AS has_fb
FROM bookings WHERE id = '<invoice_booking_id>';

-- Held vs ledger
SELECT held_referral_balance_thb FROM user_wallets WHERE user_id = '<partner_id>';
SELECT status, sum(amount_thb) FROM referral_ledger
WHERE referrer_id = '<partner_id>' AND status = 'earned_held'
GROUP BY 1;
```

---

## Связанные файлы

- `lib/smoke/audit02-regression-smoke.js`
- `lib/services/payout-batch/payout-batch-settlement.js`
- `lib/services/payout-batch/payout-batch-settle-lock.js`
- `lib/chat/sync-booking-for-chat-invoice.server.js`
- `docs/archive/audits/AUDIT_REPORT_02.md`
- `docs/runbooks/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md` §3.1.1
