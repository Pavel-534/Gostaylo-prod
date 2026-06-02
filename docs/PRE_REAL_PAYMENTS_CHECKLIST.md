# Чеклист до первой реальной выплаты и подключения ЮKassa

**Для кого:** владелец / финансовый оператор.  
**Когда:** после успешной симуляции Stage 104 (`npm run smoke:full-financial:all`) и настройки мониторинга Stage 105.  
**SSOT:** `ARCHITECTURAL_DECISIONS.md`, ADR-097, `lib/treasury/payout-rails.js`, `lib/treasury/treasury-ops-config.js`.

> **Stage 124.18–124.19 (2026-06-01):** checkout `AWAITING_PAYMENT` + RPC; auth на `submit-txid` / `verify-tron`; webhook guards; smoke шаг **6** = HTTP `initiate` → mock webhook → `PAID_ESCROW`. Миграция `stage124_18_awaiting_payment_escrow_rpc.sql` — на FannRent применена; на **prod** — проверить отдельно, если другой проект Supabase.

> **Stage 108–112.3 final (2026-05-21) — pre-launch hardening завершён.** Код: perimeter prod 404, booking guard, FinTech/home/chat/partner API clients, `components/` без fetch (кроме deprecated bell). Go/No-Go **9/10** — **`docs/GO_NO_GO_FIRST_REAL_PAYMENT.md`**. Осталось внешнее: ЮKassa, ОсОО, договоры (§B–D), деплой prod + verify/smoke на prod.

**Быстрый Go/No-Go (15 мин):** [`docs/GO_NO_GO_FIRST_REAL_PAYMENT.md`](GO_NO_GO_FIRST_PAYMENT.md)

---

## Для владельца: что сделать перед первым реальным платежом

Короткий список без терминала. Детали — разделы A–G ниже.

| # | Действие | Где / как проверить |
|---|----------|---------------------|
| 1 | **Деплой** последнего кода (Stage 124.18+) на production | Vercel / ваш CI |
| 2 | **Миграция БД** `stage124_18_awaiting_payment_escrow_rpc` на prod Supabase (если prod ≠ dev) | Supabase → Migrations или SQL из `migrations/` |
| 3 | Открыть **`/admin/settings/finances`** → карточка **«Статус готовности к реальным платежам»** — все обязательные пункты **зелёные** | FinTech-пульт |
| 4 | **«Запустить полный smoke»** или попросить разработчика `npm run smoke:full-financial` — шаг **6** (HTTP checkout) зелёный | FinTech / терминал |
| 5 | **Cron Health** на том же экране: 7 задач, без «Давно не бегал» / «Ошибка»; настроить **cron-job.org** для `promote-ready-for-payout` (hourly) | `docs/CRON_EXTERNAL_FINANCIAL.md` |
| 6 | **Emergency Pause** выключен; **TREASURY_MANUAL_MODE=1** на prod; mock/sandbox оплаты **выключены** | FinTech → казначейство / env |
| 7 | **ЮKassa**: боевые ключи, webhook `POST …/api/webhooks/payments/confirm`, `YOOKASSA_WEBHOOK_SECRET` в Vercel | §B, §E |
| 8 | **Онлайн-касса**: `FISCAL_PROVIDER_URL` боевой, не sandbox | §A2, §B3 |
| 9 | **Юридическое**: оферта/политики опубликованы (`/admin/settings/legal` → ZIP при необходимости) | §C |
| 10 | **Пилот**: одна тестовая оплата MIR/RUB на минимальную сумму → бронь `PAID_ESCROW`, чек fiscal, уведомление в TG FINANCE | §E |

**Не включайте** приём live-платежей, пока пункты 3–6 и 7–8 не закрыты, даже если код «зелёный».

---

## A. Техническая готовность 100% (код и среда)

**Быстрая проверка владельца (без терминала):** откройте **`/admin/settings/finances`** → вверху карточка **«Статус готовности к реальным платежам»**. Обязательные пункты — **зелёные**. Нажмите **«Запустить полный smoke»** — все шаги зелёные.

### Перед паузой на 1–2 недели (≈10 минут)

1. Откройте **`/admin/settings/finances`** (финансовый пульт).
2. Нажмите **«Подготовить систему к паузе»** → подтвердите.  
   Скачается ZIP: юридические документы, PDF-памятка «при возвращении», отчёт проверки. **Пауза включится автоматически** — новые оплаты остановятся.
3. Сохраните ZIP на компьютер и в облако (Google Drive / почта себе).
4. По желанию: зайдите в **Мониторинг** (вкладка) — убедитесь, что нет красных алертов.
5. Можно спокойно заниматься ЮKassa, ОсОО и договорами.

*Вручную (если кнопка недоступна): smoke → legal ZIP → Emergency Pause — см. runbook §14.*

**Что уже защищено в коде (Stage 106.1–106.2):**

- На production **нельзя** подтвердить MIR/CARD без webhook ЮKassa.
- Mock-эквайринг и тестовая касса **отключены** на production.
- Без **FISCAL_PROVIDER_URL** новые оплаты **блокируются** (понятное сообщение гостю).
- Без **TREASURY_MANUAL_MODE=1** на production оплаты **блокируются** (ручной Concierge).
- **Emergency Pause** блокирует новые оплаты.

---

## A. Техническая готовность (код и среда) — детальный чеклист

### A0. Stage 108–112.3 final (код-уборка + hardening) — выполнено в репозитории

- [x] P0: legacy payout guard, booking status SSOT, schema 103.2 tooling, cron health UI
- [x] P1: chat POST SSOT, inbox Realtime dedup, CHECKED_IN ≠ THAWED, `BOOKING_STATUS` parity, pricing aliases
- [x] **111.1b:** `POST /api/v2/bookings` — `resolveBookingCreateSession` (IDOR fix), `booking-price-gate`, `booking-atomic-insert`
- [x] **111.1b/c perimeter:** prod 404 на `/api/v2/test/notifications`, `/api/db/migrate`, `/api/db/seed`; без Supabase URL в ошибках
- [x] Stage 111–112.3: FinTech/home/chat/calendar/finances → API clients; iCal, seasonal, referral, push, geocode; realtime JWT SSOT
- [x] **112.0 final:** inbox archive/unarchive → `conversation-api-client`
- [x] **112.3 final:** `admin-settings-api-client`; partner Airbnb import + reputation → `partner-listing-client`; `components/` 0 fetch (launch)
- [x] **113.0:** `client-request-dedup` + `client-fetch-policy` на hot-path clients
- [x] **113.1:** удалён `notification-bell`; dedup на `admin-settings` / `marketing-api` / `partner-bookings`; pre-deploy build + smoke
- [x] Go/No-Go + readiness **9/10** — `docs/GO_NO_GO_FIRST_REAL_PAYMENT.md`
- [x] `npm run verify:schema-103-2` — **6/6** на среде из `.env.local` (повторить на prod после деплоя)
- [ ] Деплой на production + повтор verify/smoke на prod

### A1. Симуляция и мониторинг

- [ ] `npm run smoke:full-financial:rub` — **PASS** (в т.ч. шаг **6. HTTP checkout: initiate → webhook → PAID_ESCROW**)
- [ ] `npm run smoke:full-financial:intl` — **PASS**
- [ ] `npm run smoke:full-financial:all` — шаг **«16. Два рельса одновременно»** — **PASS**
- [ ] Dev env: `PAYMENT_ACQUIRING_WEBHOOK_SECRET` (шаг 6 CARD) · для **шага 6b MIR**: `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_WEBHOOK_SECRET` (без них — SKIP)
- [ ] Миграция **124.18** на prod БД (enum `AWAITING_PAYMENT` + RPC whitelist)
- [ ] `/admin/settings/finances` → **Мониторинг**: пороги понятны, алерты приходят в TG (топик FINANCE)
- [ ] `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_GROUP_ID` заданы на prod
- [ ] `TREASURY_MANUAL_MODE` не снят без решения (по умолчанию **true** — авто-пулы выключены)
- [ ] Emergency Pause протестирован: вкл → бронь не создаётся → выкл

### A2. Env (prod)

| Переменная | Рекомендация |
|------------|----------------|
| `TREASURY_MANUAL_MODE` | `1` или не задавать (default ручной) |
| `TREASURY_AUTO_POOL` | `0` до live Concierge |
| `TREASURY_AUTO_PROMOTE` | можно `1` — cron только меняет статусы |
| `TREASURY_ALERT_PAYMENT_THB_MIN` | порог крупной оплаты (default 50000) |
| `TREASURY_ALERT_READY_POOL_THB_MIN` | порог «готово к выплате» (default 100000) |
| `TREASURY_ALERT_LEDGER_DRIFT_THB_MIN` | default 0.5 |
| `PAYMENT_ACQUIRER_RUB_ENABLED` | `1` перед live MIR |
| `PAYMENT_ACQUIRER_RUB_SHADOW` | `0` на prod |
| `FISCAL_PROVIDER_URL` | боевой провайдер кассы |
| `YOOKASSA_*` / webhook secret | по договору с PSP |

### A3. Cron (внешний, cron-job.org)

- [ ] `escrow-thaw` — hourly
- [ ] `promote-ready-for-payout` — hourly  
  См. `docs/CRON_EXTERNAL_FINANCIAL.md`
- [ ] `payout-batch-pools` — пн/чт (или по runbook)
- [ ] FinTech **Cron Health**: `escrow-thaw`, `promote-ready-for-payout`, `payout-batch-pools`, `financial-health-monitor`, `exchange-rates-refresh`, `referral-reconciliation`, `referral-unlock` — без stale/error
- [ ] Auto-создание пулов **не** включено (ручные пулы из FinTech)

### A4. База и миграции

- [ ] `payout_batches`: `locked_at`, `exported_at`, `settled_at` (Stage 103.2)
- [ ] `critical_signal_events` — для аудита алертов
- [ ] RLS и service_role для admin finance API

---

## B. Что нужно сделать **вне кода** (организация, 1–2 недели)

| # | Задача | Кто |
|---|--------|-----|
| B0 | Договор с **ЮKassa**, боевые ключи и webhook URL на prod | Владелец + банк/PSP |
| B1 | **ОсОО KG** / IT-договор, реквизиты в fiscal env | Владелец + юрист |
| B2 | **ИП РФ**: эквайринг, ИНН в `FISCAL_*` env | Владелец |
| B3 | Подключить **боевую онлайн-кассу** (`FISCAL_PROVIDER_URL`, без sandbox) | Владелец + провайдер кассы |
| B4 | Реквизиты партнёров и пилотный лимит первой выплаты | Владелец |
| B5 | Экспорт юр. документов: **`/admin/settings/legal`** → **ZIP** — архив для банка/юриста | Владелец (1 клик) |
| B6 | Telegram FINANCE: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_GROUP_ID` | Владелец |

Пока эти пункты не закрыты — **не включайте** приём live-платежей на production, даже если код зелёный.

---

## C. Юридическое и комплаенс

| # | Задача | ☐ |
|---|--------|---|
| C1 | ИП РФ: договор эквайринга, ИНН в fiscal config | ☐ |
| C2 | ОсОО KG: договор IT-услуг, процедура USDT/KG | ☐ |
| C3 | Оферта гостя и условия партнёра **опубликованы** (`/admin/settings/legal`) | ☐ |
| C4 | Версии в ZIP выплат актуальны | ☐ |
| C5 | Политика ПДн / возвраты — ссылки в checkout | ☐ |

---

## D. Банковское и два рельса

### D1. RUB Direct (`TBANK_RU`)

- [ ] Договор с банком (T-Bank / массовые выплаты)
- [ ] Партнёры RUB: `preferred_payout_currency = RUB`, реквизиты проверены
- [ ] Пилотный пул → `registry-rub-direct.csv` → ручной перевод → «Отметить как оплаченный»
- [ ] PDF-акт партнёру в кабинете «Документы»

### D2. International (`KG_CRYPTO`)

- [ ] Процедура USDT / KG (до API биржи — ручной реестр)
- [ ] `PARTNER_PAYOUT_FX_*` согласованы с финмоделью
- [ ] Пилотный пул → `registry-kg-usdt.csv`
- [ ] Конвертации в FinTech «Конвертации и потери»

**Правило:** не смешивать рельсы в одном банковском платеже.

---

## E. ЮKassa и первый live-платёж

| Шаг | Действие | ☐ |
|-----|----------|---|
| E1 | Боевые ключи ЮKassa, webhook `POST /api/webhooks/payments/confirm` на prod URL | ☐ |
| E2 | Тестовая оплата MIR/RUB на минимальную сумму | ☐ |
| E3 | Webhook → `PAID_ESCROW` + ledger THB | ☐ |
| E4 | Чек fiscal (не `PENDING_FISCAL`) | ☐ |
| E5 | TG: «ПЛАТЁЖ ПОЛУЧЕН»; при крупной сумме — алерт мониторинга | ☐ |
| E6 | Сверка PSP ↔ snapshot RUB ↔ escrow THB | ☐ |

---

## F. Первая реальная выплата партнёру

1. Drift ledger **OK** (< порога), fiscal **0** pending (или объяснён backlog).
2. Пул по **одному** рельсу, lock, CSV/ZIP, перевод в банке/кошельке.
3. «Отметить как оплаченный» → акты → уведомление партнёру.
4. Запись конвертации (если был обмен валют).

---

## G. Go / No-Go

| **Go** | **No-Go** |
|--------|-----------|
| Smoke all rails PASS, мониторинг в TG, ручной режим вкл | Любой FAIL smoke, drift > порога без разбора |
| ЮKassa webhook проверен на staging/prod | Sandbox fiscal на prod |
| Пилот ≤ согласованного лимита | Emergency Pause активен без причины |
| Реквизиты сверены вручную | Смешение RUB Direct и International в одном платеже |

---

## Связанные документы

- `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md` — §12 симуляция, §10 эквайринг  
- `docs/PRE_LAUNCH_CHECKLIST.md` — soft launch  
- `docs/CRON_EXTERNAL_FINANCIAL.md` — cron  

*Stage 105 · 2026-05-19 · обновлено 124.19 (2026-06-01)*
