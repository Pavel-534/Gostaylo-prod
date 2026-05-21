# Go / No-Go — первый реальный платёж

**Для кого:** владелец / финоператор + ответственный за деплой.  
**Время:** ~15 минут (UI) + ~10 минут (терминал, опционально).  
**Полный чеклист:** `docs/PRE_REAL_PAYMENTS_CHECKLIST.md` · **Операции выплат:** `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md`

---

## Go — все пункты «да»

| # | Проверка | Как проверить |
|---|----------|----------------|
| 1 | **Smoke 15/15** | `npm run smoke:full-financial` (локально) или кнопка на `/admin/settings/finances` |
| 2 | **Schema 103.2** | `npm run verify:schema-103-2` на **production** env |
| 3 | **Готовность в UI** | `/admin/settings/finances` → карточка «Статус готовности» — обязательные поля **зелёные** |
| 4 | **Concierge режим** | `TREASURY_MANUAL_MODE=1` (или не задан — default ручной); авто-пулы **выключены** |
| 5 | **Касса** | `FISCAL_PROVIDER_URL` — боевой провайдер, не пусто |
| 6 | **ЮKassa** | `YOOKASSA_*` + webhook secret; на prod **нет** mock/shadow acquirer |
| 7 | **Cron** | `escrow-thaw`, `promote-ready-for-payout` — hourly (см. `docs/CRON_EXTERNAL_FINANCIAL.md`) |
| 8 | **TG FINANCE** | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_GROUP_ID` на prod |
| 9 | **Emergency Pause** | Протестирован: вкл → новая оплата блокируется → выкл |
| 10 | **Юридическое** | ОсОО, оферта, партнёрские договоры — §B–D в `PRE_REAL_PAYMENTS_CHECKLIST.md` |

**Решение:** можно принимать **первый реальный платёж** гостя (MIR/CARD) при включённом Concierge и ручном контроле исходящих.

---

## No-Go — любой пункт «нет»

| Симптом | Действие |
|---------|----------|
| Smoke красный | Не включать эквайринг; разобрать шаг в логе / FinTech-пульте |
| Schema verify < 6/6 | Применить миграции, повторить verify |
| Красные пункты готовности | Исправить env/конфиг по подсказке карточки |
| Нет fiscal URL | Оплаты блокируются — сначала касса |
| Legacy payout без guard | Только `PayoutBatchService` + `legacy-payout-guard` (Stage 108) |
| Нет договоров / ОсОО | Юридический No-Go даже при зелёном коде |

**Решение:** включить **Emergency Pause** (или «Подготовить систему к паузе»), не снимать `TREASURY_MANUAL_MODE` без плана.

---

## Код-уборка 109–112.x (кратко)

| Стадия | Суть |
|--------|------|
| **109** | FinTech console split, i18n/referral modules, UnifiedMessages + wizard hooks |
| **110** | SSOT цены, статусы, ledger, FX retail; chat server POST + inbox bridge |
| **111** | P1 pages → hooks; FinTech/home/catalog API clients; без двойного search на главной |
| **112.0–112.1** | Chat UI/hooks SSOT; FinTech один bundle-load; Go/No-Go doc |
| **112.2** | `partner-calendar-client`, `partner-bookings-client`, settlement docs; calendar + chat booking UI без `fetch` |
| **112.3** | iCal/seasonal/referral/push/geocode clients; realtime auth SSOT; calendar-sync + seasonal UI без `fetch` |

**Прямой `fetch` в UI (backlog, не блокирует launch):** `SystemSettingsMarketing`, legacy `notification-bell`, `PartnerListingImportBlock`, checkout/wizard hooks.

---

## После первого live-платежа (24 ч)

- [ ] Webhook ЮKassa в журнале / ledger без drift
- [ ] Фискальный чек / статус в FinTech
- [ ] Нет неожиданных алертов TG FINANCE
- [ ] Первая выплата партнёру — только по runbook §1–§12 (CSV, ручная отметка)
