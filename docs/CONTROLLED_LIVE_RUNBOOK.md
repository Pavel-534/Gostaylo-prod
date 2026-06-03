# Controlled Live — runbook владельца

**Режим:** реальные входящие платежи, выплаты партнёрам — **только вручную** (Concierge).

---

## Перед стартом (один раз)

1. Pre-Live Readiness зелёный, smoke **25/25**, Emergency Pause **выключен**
2. ЮKassa + касса на prod, Cron Health OK
3. `/admin/settings/finances` → **«Перейти в Live Mode»** → проверить TG FINANCE

---

## Ежедневно (5–10 мин)

| Шаг | Где |
|-----|-----|
| Карточка **Controlled Live** — оплаты 24ч/7д, PAID_ESCROW, drift, webhook | `/admin/settings/finances` |
| Список **реальных броней** (без smoke) + P&L | `/admin/finance/intelligence` → «Брони» → **Real Payments Only** |
| TG FINANCE — «ПЛАТЁЖ ПОЛУЧЕН», нет необъяснённых critical | Telegram |

**Не нужно:** отдельные дашборды, ежедневные digest-cron — достаточно TG по событиям + FI.

---

## При новой оплате

1. TG: одно «ПЛАТЁЖ ПОЛУЧЕН» на бронь
2. FI → клик по брони → P&L (сумма, fiscal, referral)
3. Fiscal = **ISSUED** (не PENDING_FISCAL)

---

## Если что-то не так

| Симптом | Действие |
|---------|----------|
| Drift > ฿0.50 | Не выплачивать → сверка ledger на FinTech |
| Webhook error | Проверить секрет ЮKassa |
| PENDING_FISCAL | Fiscal retry / провайдер кассы |
| Нужно остановить приём | **Emergency Pause** на FinTech-пульте |

---

## Первые 3 реальные оплаты — на что смотреть особенно

После каждой из **первых трёх** MIR/live-оплат (не smoke):

| # | Проверка | Ожидание |
|---|----------|----------|
| 1 | **TG FINANCE** | Одно «ПЛАТЁЖ ПОЛУЧЕН · MIR» + RUB; на **первой** — отдельный critical «ПЕРВАЯ MIR-ОПЛАТА» |
| 2 | **FinTech** | Баннер **CONTROLLED LIVE: ACTIVE**, счётчик 24ч вырос |
| 3 | **FI → Real Payments Only** | Бронь в списке; клик → P&L: THB, RUB, fiscal, referral |
| 4 | **Fiscal** | `ISSUED` (не зависший `PENDING_FISCAL`) |
| 5 | **Ledger drift** | ≤ ฿0.50 на FinTech |
| 6 | **Повтор webhook** (если PSP шлёт retry) | 2xx, без второго списания / второго TG |

Если хоть один пункт красный — **Emergency Pause**, разбор до следующей оплаты.

---

## Пилотный лимит (опционально)

`CONTROLLED_LIVE_MAX_THB_PER_DAY` (default **0** = выкл.) — при превышении **только алерт в TG**, checkout **не блокируется**. Решение: Pause или поднять лимит.

---

## Критерии успеха пилота (2 нед.)

- [ ] ≥1 MIR end-to-end (escrow + fiscal + ledger)
- [ ] 0 необъяснённых drift / webhook errors
- [ ] 1 ручная выплата (пул → банк → settled)

SSOT: `docs/PRE_REAL_PAYMENTS_CHECKLIST.md` · `docs/GO_NO_GO_FIRST_REAL_PAYMENT.md`

*Stage 126.3 · 2026-06-03*
