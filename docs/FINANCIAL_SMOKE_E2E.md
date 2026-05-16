# Financial Smoke E2E — Stage 99

**Цель:** один проход «бронь → batch export» на staging перед soft launch.  
**SSOT:** `docs/PRE_LAUNCH_CHECKLIST.md`, `lib/partner/partner-payout-eligibility.js`, ADR-097.

---

## Предусловия

| Env | Значение |
|-----|----------|
| `PRICING_ENGINE_V2` | `true` |
| `FISCAL_SANDBOX` | `true` на staging / `false` только после prod OFD smoke |
| `FISCAL_PROVIDER_URL` | prod URL при live fiscal |
| `CRON_SECRET` | для cron-шагов |
| Партнёр | `is_verified`, payout profile |

**Клиент:** `GET /api/v2/pricing/engine-config` → `roundingMode: integer`.

---

## Сценарий A — Happy path (ручной)

| # | Шаг | Проверка |
|---|------|----------|
| A1 | Создать листинг (stay), бронь, оплатить (mock или prod adapter) | `status=PAID_ESCROW`, `pricing_snapshot.v=2`, `final_breakdown` |
| A2 | Guest total attestation | Client `clientQuotedGuestTotalThb` = server `computeAttestationGuestTotalThb` (v2); tamper → `PRICE_MISMATCH` |
| A3 | Ledger | Admin compliance → `ledger_legs`: split RU/KG/FX/pot/partner |
| A4 | Fiscal | `metadata.fiscal.status` → `ISSUED` или `PENDING_FISCAL` + Retry |
| A5 | Завершить stay (partner) | `escrow_thaw_at` задан |
| A6 | `POST /api/cron/escrow-thaw` | `THAWED`, `metadata.escrow_thawed_at` |
| A7 | Партнёр `/partner/finances` | Карточка «Разморозка (24 ч)», не «Доступно» |
| A8 | Симулировать 24h *или* сдвинуть `escrow_thawed_at` в metadata (staging only) | — |
| A9 | `POST /api/cron/promote-ready-for-payout` | `READY_FOR_PAYOUT` |
| A10 | Партнёр UI | «Доступно к выводу» |
| A11 | Admin «Сформировать пул» | DRAFT batch, CSV export |
| A12 | Lock → export CSV | строки partner + amount |

---

## Сценарий B — Dispute freeze

| # | Шаг | Проверка |
|---|------|----------|
| B1 | Бронь `THAWED` или `READY_FOR_PAYOUT` | — |
| B2 | Открыть официальный спор (guest) | `disputes.freeze_payment=true`, OPEN |
| B3 | Партнёр finances | «Заблокировано спором», banner |
| B4 | Запрос выплаты | Отклонён / сумма не включает frozen |
| B5 | Ledger | Journal `DISPUTE_PARTNER_FUNDS_HELD` |
| B6 | Admin close dispute | `DISPUTE_PARTNER_FUNDS_RELEASED`, metadata unfreeze |
| B7 | Finances | Средства снова в доступных (с учётом 24h) |

---

## Сценарий C — Cron bundle (staging)

```bash
# Authorization: Bearer $CRON_SECRET
curl -X POST "$BASE/api/cron/escrow-thaw"
curl -X POST "$BASE/api/cron/promote-ready-for-payout"
curl -X POST "$BASE/api/cron/payout-batch-pools" -H "Content-Type: application/json" -d '{"force":true}'
curl -X POST "$BASE/api/cron/financial-health-monitor"
```

Ожидание: JSON `success: true`, без 500.

---

## SQL sanity (опционально)

```sql
-- Ledger capture exists
SELECT id, event_type FROM ledger_journals WHERE booking_id = '<booking_uuid>';

-- Dispute hold/release
SELECT event_type, idempotency_key FROM ledger_journals
WHERE booking_id = '<booking_uuid>' AND event_type LIKE 'DISPUTE_%';

-- Open dispute freeze
SELECT id, status, freeze_payment FROM disputes
WHERE booking_id = '<booking_uuid>' AND status IN ('OPEN','IN_REVIEW');
```

---

## Playwright (roadmap)

Добавить spec `tests/e2e/financial-v2-smoke.spec.ts`:

1. Login partner + guest (fixtures).
2. Create booking via API fixture.
3. Assert finances-summary buckets via `GET /api/v2/partner/finances-summary`.

Пока SSOT — этот чеклист + сценарий A/B вручную на staging.

---

## Sign-off

| Роль | Дата | Staging | Prod |
|------|------|---------|------|
| FinTech | | ☐ | ☐ |
| QA | | ☐ | ☐ |
| Бухгалтерия (fiscal) | | ☐ | ☐ |
