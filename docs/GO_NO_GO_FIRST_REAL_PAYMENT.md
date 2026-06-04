# Go / No-Go — первый реальный платёж

**Для кого:** владелец / финоператор + ответственный за деплой.  
**Время:** ~15 минут (UI) + ~10 минут (терминал, опционально).  
**Обновлено:** 2026-06-01 (Stage 130.4 — первый живой MIR)  
**Полный чеклист:** `docs/PRE_REAL_PAYMENTS_CHECKLIST.md` (§E MIR) · **Blueprint:** `docs/YOOKASSA_BLUEPRINT_130.1.md` · **Controlled Live:** `docs/CONTROLLED_LIVE_RUNBOOK.md` · **Выплаты:** `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md`

---

## Оценка готовности (из 10)

| Балл | Смысл |
|------|--------|
| **10 / 10** | Фаза 1 закрыта (125.8); Controlled Live UI (126.0). Go по коду + FinTech. |
| −1 | Внешние блокеры: ЮKassa, касса, деплой prod, cron prod, owner Live Mode activation. |

**Go по коду** — после зелёного smoke и карточки готовности на prod. **No-Go по бизнесу** — пока §B–E в `PRE_REAL_PAYMENTS_CHECKLIST.md` не закрыты.

---

## Go — все пункты «да»

| # | Проверка | Как проверить |
|---|----------|----------------|
| 1 | **Smoke 25/25** | `npm run smoke:full-financial` или кнопка на FinTech |
| 2 | **Pre-Live Readiness** | `/admin/settings/finances` — Фаза 1 + ops зелёные |
| 3 | **Controlled Live** | Кнопка «Перейти в Live Mode» (после пунктов 1–2) |
| 4 | **Schema 103.2** | `npm run verify:schema-103-2` на **production** env |
| 5 | **Concierge режим** | `TREASURY_MANUAL_MODE=1`; авто-пулы **выключены** |
| 6 | **Касса** | `FISCAL_PROVIDER_URL` — боевой провайдер, не пусто |
| 7 | **ЮKassa** | `YOOKASSA_*` + webhook secret; на prod **нет** mock/shadow acquirer |
| 8 | **Cron** | `escrow-thaw`, `promote-ready-for-payout` — hourly (см. `docs/CRON_EXTERNAL_FINANCIAL.md`) |
| 9 | **TG FINANCE** | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_GROUP_ID` на prod |
| 10 | **Emergency Pause** | Протестирован: вкл → новая оплата блокируется → выкл |
| 11 | **Юридическое** | ОсОО, оферта, партнёрские договоры — §B–D в `PRE_REAL_PAYMENTS_CHECKLIST.md` |
| 12 | **Booking IDOR** | `POST /api/v2/bookings` только с сессией (`booking-create-guard`) |
| 13 | **Prod perimeter** | На prod **404**: `/api/v2/test/notifications*`, `/api/db/migrate`, `/api/db/seed` |
| 14 | **Referral program** | FinTech: accounting KPI зелёные; очередь `withdrawable_referral` обрабатывается **вручную** (без автобанка) |

**Решение:** можно принимать **первый реальный платёж** гостя (MIR/CARD) при включённом Concierge и ручном контроле исходящих.

---

## Go / No-Go — первый **живой MIR** (Stage 130.4)

Используйте этот блок, если первый платёж — именно **MIR/RUB через ЮKassa** (не CARD Intl, не crypto).

| # | Go (все «да») | Как проверить |
|---|----------------|---------------|
| M1 | Smoke **6b** PASS с `YOOKASSA_*` (test shop) | `npm run smoke:full-financial` — live initiate + `test: true` assert |
| M2 | Staging ручной E2E (карта 5555…) → `PAID_ESCROW` | `PRE_REAL_PAYMENTS_CHECKLIST.md` §E0 |
| M3 | FinTech **YooKassa Status** = Configured | `/admin/settings/finances` |
| M4 | Webhook prod URL + secret + IP enforce | Vercel env + кабинет ЮKassa |
| M5 | **Live Mode** + `CONTROLLED_LIVE_MAX_THB_PER_DAY` | FinTech Controlled Live |
| M6 | Боевые ключи: intent **`yookassa_test: false`** на пилоте | Recent intents в FinTech |
| M7 | Fiscal A: `FISCAL_PROVIDER_URL` боевой, sandbox выкл | Pre-Live Readiness |
| M8 | Пилот: min сумма, одна бронь, TG настроен | §126.3 в PRE_REAL |
| M9 | Emergency Pause протестирован | вкл → 403 initiate → выкл |

| No-Go MIR | Действие |
|-----------|----------|
| Smoke 6b FAIL / нет `test: true` на test shop | Не переключать prod keys |
| `yookassa_test: true` на **боевом** shop | Неверный магазин / ключи |
| Webhook 403 `ip_not_allowlisted` | Проверить Vercel forwarding + `YOOKASSA_WEBHOOK_ENFORCE_IP` |
| GET verify FAIL на prod | Не принимать платежи до исправления |
| Нет TG FINANCE | Риск слепого пилота |

**После первой live MIR (1 ч):** webhook в логах · intent `yookassa_payment_id` · ledger drift OK · fiscal · TG «первая оплата».

---

## No-Go — любой пункт «нет»

| Симптом | Действие |
|---------|----------|
| Smoke красный | Не включать эквайринг; разобрать шаг в логе / FinTech-пульте |
| Schema verify < 6/6 | Применить миграции, повторить verify |
| Красные пункты готовности | Исправить env/конфиг по подсказке карточки |
| Нет fiscal URL | Оплаты блокируются — сначала касса |
| Legacy payout без guard | Только `PayoutBatchService` + `legacy-payout-guard` |
| Нет договоров / ОсОО | Юридический No-Go даже при зелёном коде |
| Test/migrate API на prod ≠ 404 | Не деплоить — см. `prod-perimeter-guard.js` |

**Решение:** включить **Emergency Pause** (или «Подготовить систему к паузе»), не снимать `TREASURY_MANUAL_MODE` без плана.

---

## Что почистили в 109–113.x (итоговая сводка)

| Стадия | Суть |
|--------|------|
| **109** | FinTech console split; i18n/referral/dispute/payout modules; UnifiedMessages + wizard hooks |
| **110** | SSOT цены, статусы, ledger, FX retail; chat server POST + inbox Realtime dedup |
| **111.0** | P1 pages → hooks; admin payments API client |
| **111.1** | Home + FinTech + catalog-public + auth API clients |
| **111.1b** | `POST /api/v2/bookings` session guard; `booking-price-gate`; atomic RPC SSOT |
| **111.1b/c** | Prod **404** на test notifications + db migrate/seed; sanitize Supabase URL в ошибках |
| **111.2** | FinTech panels 0 fetch; home без двойного listings на mount |
| **112.0** | `chat-ui-api-client`; inbox archive; admin messages single enrich |
| **112.1** | Thread/read + FinTech bundle init; home live-count dedup |
| **112.2** | Partner calendar/bookings/finances clients; chat booking actions |
| **112.3** | iCal/seasonal/referral/push/geocode; realtime JWT SSOT |
| **112.3 final** | `admin-settings-api-client`; partner import → `partner-listing-client` |
| **113.0** | `client-request-dedup` + TTL policy на API clients |
| **113.1** | Удалён dead `notification-bell`; dedup на admin/marketing/partner-booking clients; `components/` **0 fetch** |

### Ключевые UI без прямого `fetch` (launch path)

| Зона | SSOT |
|------|------|
| Главная | `usePlatformHomePage` + `platform-home-api-client` + `catalog-public-client` |
| FinTech пульт | `useAdminFinTechConsole` + `admin-fintech-api-client` |
| FinTech панели | `components/admin/finances/*` |
| Чат | `conversation-api-client`, `chat-ui-api-client`, server POST |
| Checkout | `useCheckout*` hooks |
| Partner import / reputation | `partner-listing-client`, `usePartnerReputationHealthQuery` |
| Admin marketing cockpit | `admin-settings-api-client` + `marketing-api-client` |

## Referral program — Go / No-Go (Stage 114.7)

**SSOT:** `docs/REFERRAL_ACCOUNTING.md` · **FinTech:** `/admin/settings/finances` → Referral Liability · **Runbook:** `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md` §16.

| # | Проверка | Go |
|---|----------|-----|
| R1 | Smoke 15/15 включает referral wallet path | `npm run smoke:full-financial` |
| R2 | FinTech accounting + **monthly spend bar** (warn 80% / hard 100%) | Жёлтая полоса до лимита, красная при превышении |
| R3 | Очередь withdrawal: поиск, сортировка, approve/reject (в т.ч. filtered) | `ReferralPayoutWorkflowPanel` |
| R4 | TG FINANCE: `REFERRAL_ADMIN_ALERT` (large / burst / monthly / approaching) | Опционально на staging |
| R5 | UX: `/profile/referral`, `/u/[id]` — skeleton, empty states, tooltips уровней/медалей | Ручной smoke mobile |
| R6 | **Нет автовывода** referral на банк | Только `withdrawable_referral` → админ |
| R7 | Ежедневный контроль по runbook §16 | FinTech + payouts 5–10 мин |

**No-Go referral:** monthly spend **hard** alert без ревью; **Reject filtered** без проверки email; массовый approve без сверки суммы; promo tank &lt; прогноза host activation без topup.

**Лимиты:** `referral_admin_monthly_spend_alert_thb` (150k), `referral_admin_monthly_spend_warn_percent` (80), large earn 10k, hourly burst 25k — §6.1 `REFERRAL_ACCOUNTING.md`.

---

### Backlog (не блокирует launch)

Legacy admin/partner **pages** с прямым `fetch` в `app/**` (не в guest/checkout/financial hot path) — вынос в API clients на Stage 114+.

---

## После первого live-платежа (24 ч)

- [ ] Webhook ЮKassa в журнале / ledger без drift
- [ ] Фискальный чек / статус в FinTech
- [ ] Нет неожиданных алертов TG FINANCE
- [ ] Первая выплата партнёру — только по runbook §1–§12 (CSV, ручная отметка)
