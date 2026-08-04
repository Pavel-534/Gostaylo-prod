# Day-0 Soft Launch Checklist — первые пользователи

> **Version:** 1.0.0 · **Updated:** 2026-08-01 · **Brand:** Airento (`getSiteDisplayName()`)  
> **Цель:** узкий invite (гости + партнёры) под Concierge, без Cap/L2/авто-банка.  
> **Полные источники:** [`GO_NO_GO_FIRST_REAL_PAYMENT.md`](./GO_NO_GO_FIRST_REAL_PAYMENT.md) · [`PRE_REAL_PAYMENTS_CHECKLIST.md`](./PRE_REAL_PAYMENTS_CHECKLIST.md) · [`CONTROLLED_LIVE_RUNBOOK.md`](./CONTROLLED_LIVE_RUNBOOK.md) · [`CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md`](./CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md) · [`LAUNCH_RISK_REGISTER.md`](../LAUNCH_RISK_REGISTER.md) · [`CRON_EXTERNAL_FINANCIAL.md`](./CRON_EXTERNAL_FINANCIAL.md)

**Правило:** любой ☐ в блоке **A** = No-Go на invite. Блоки B–C можно закрывать параллельно, но не вместо A.

---

## A. Money Go (обязательно)

| # | Проверка | Как | ☐ |
|---|----------|-----|---|
| A1 | Financial smoke зелёный | `npm run smoke:full-financial` или FinTech smoke | ☐ |
| A2 | Pre-Live Readiness зелёный | `/admin/settings/finances` | ☐ |
| A3 | Controlled Live + дневной cap | Live Mode ON; `CONTROLLED_LIVE_MAX_THB_PER_DAY` задан | ☐ |
| A4 | ЮKassa prod | `YOOKASSA_*` + webhook secret; intents **`yookassa_test: false`** на пилоте | ☐ |
| A5 | Webhook | URL + IP enforce; тест confirm → `PAID_ESCROW` | ☐ |
| A6 | Касса | `FISCAL_PROVIDER_URL` боевой; sandbox выкл | ☐ |
| A7 | Concierge | `TREASURY_MANUAL_MODE=1`; авто-банк payouts **выкл** | ☐ |
| A8 | Emergency Pause | вкл → initiate 403 → выкл | ☐ |
| A9 | Cron hourly (cron-job.org) | `escrow-thaw`, `reconcile-confirmed-payments`, `promote-ready-for-payout` | ☐ |
| A10 | TG FINANCE | bot + group; тестовый alert доходит | ☐ |
| A11 | Schema 103.2 на prod | `npm run verify:schema-103-2` | ☐ |
| A12 | Юридика §B–D | оферта / агентская / партнёрские договоры согласованы | ☐ |

**После первой live MIR (≤1 ч):** webhook в логах · intent с `yookassa_payment_id` · fiscal не завис · нет `[LEDGER_DRIFT]` / `PENDING_FISCAL` backlog.

---

## B. Ops перед invite

| # | Проверка | ☐ |
|---|----------|---|
| B1 | Playbook «гость: оплатил, статус не сменился» → FinTech intent → один admin confirm / wait reconcile | ☐ |
| B2 | Чеклист Concierge payout (4 глаза на первый live + суммы выше порога Owner) | ☐ |
| B3 | Модерация: SLA &lt; 24ч; нет авто-approve | ☐ |
| B4 | `STALE_CRON` / FinTech cron health: last **success** свежий (hourly ≤2ч) | ☐ |
| B5 | ADR-203 shadow: `ledger_shadow_reconcile` success; **не** платить по `accountNetThb` | ☐ |
| B6 | Referral withdraw: только ручная очередь (без автобанка) | ☐ |
| B7 | Prod perimeter: 404 на test/migrate/seed API | ☐ |

---

## C. Пилот (первые пользователи)

| # | Правило | ☐ |
|---|---------|---|
| C1 | Лимит: 10–50 Concierge-броней / узкий whitelist | ☐ |
| C2 | Min сумма пилота + одна вертикаль сначала (не весь каталог) | ☐ |
| C3 | Партнёры: подписанный договор + проверенные payout реквизиты | ☐ |
| C4 | Гости: known / invite-only; канал support (TG/email) с SLA | ☐ |
| C5 | Daily standup FinOps 10 мин: fiscal queue, stale cron, open disputes | ☐ |
| C6 | Kill switch известен Owner: Emergency Pause + выкл Live Mode | ☐ |

---

## D. Явно не делать на Day-0

| Тема | Почему отложить | Когда вернуться |
|------|-----------------|-----------------|
| **Capacitor / native** | Store/APNs/deep links ≠ доверие к эскроу; риск второй math-поверхности; PWA уже канал | После зелёного soft launch + измеренного PWA smoke |
| **Ambassador L2 live** | `ambassador_guest_l2_enabled` launch default **false**; live L2 = новые ledger-обязательства до доказанного Concierge payout | После shadow L2 validation + caps + Owner sign-off |
| Авто-банк partner/referral payouts | Человеческий фактор на пилоте безопаснее | После 2–4 недель без settle/orphan инцидентов |
| Mandarin / crypto как основной рельс | MIR Concierge path — канон пилота | После стабильного MIR+fiscal |
| Flip ADR-203 ledger SoT | Hard gate 30d `zeroDrift` | Только после Phase 1 proof |

---

## E. Day-0 script (порядок в день invite)

1. A1–A12 все ☑  
2. Одна live MIR min → наблюдение 1ч  
3. B1–B7 ☑  
4. Invite партнёров (C3) → 1–2 тестовых листинга ACTIVE  
5. Invite гостей (C4) под cap (A3/C1)  
6. Не трогать Cap / L2 / auto-payout до ретро через 7 дней

**Owner sign-off:** _________________ дата _______  
**FinOps:** _________________ дата _______
