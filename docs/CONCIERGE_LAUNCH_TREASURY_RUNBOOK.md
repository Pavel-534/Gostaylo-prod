# Concierge Launch — Treasury Runbook (ручной контроль денег)

**Для кого:** владелец продукта / финансовый оператор на soft launch.  
**Режим:** каждый исходящий перевод партнёру — **осознанное действие**; автоматических банковских API-выплат в коде **нет**.  
**SSOT по статусам и 24h:** `lib/partner/partner-payout-eligibility.js`  
**Связанные доки:** `docs/PRE_LAUNCH_CHECKLIST.md`, `docs/CRON_EXTERNAL_FINANCIAL.md`, `docs/SOFT_LAUNCH_PLAN.md`, аудит Stage 100.2 (чат / ADR-097).

---

## 1. Что такое Concierge Launch (в одном абзаце)

Платформа **учитывает** деньги в Postgres (ledger + статусы брони). **Физический** перевод на счёт партнёра делаете **вы** (банк / USDT / реестр T-Bank) по CSV из админки. Cron в этом режиме либо **выключен**, либо делает только **смену статусов** и **черновики пулов** — никогда не списывает с вашего расчётного счёта сам.

| Слой | Кто контролирует |
|------|------------------|
| Эквайринг (ЮKassa / Mandarin / crypto) | PSP + ваши договоры |
| Учёт (ledger THB) | Код при webhook → `move_to_escrow_and_post_ledger_v1` |
| «Когда можно платить партнёру» | `escrow_thaw_at` + 24h + споры |
| Исходящий платёж | **Вы** (CSV / ручная отметка payout) |

### 1.1. Курсы для партнёра (четыре слоя — не путать)

| Что видит партнёр | Смысл |
|-------------------|--------|
| **Сумма в карточке брони / snapshot** (`settlement_v3.partner_net.preferred_amount`) | Исторический ориентир на **raw** курсе из `pricing_snapshot` на момент брони. **Не** сумма к переводу сегодня. |
| **Карточка «Расчёт выплаты», модалка, портфель net, строки истории** | **Актуальная** сумма: `GET /api/v2/partner/payouts/preview` и `POST …/preview-batch` → `partner-payout-fx.js` (live mid; RUB минус `PARTNER_PAYOUT_FX_RUB_SPREAD_PCT`). Фронт **не** считает курс сам. |
| **T-Bank CSV / заявка PENDING** | `amount_in_payout_currency` из того же расчёта, что preview (слой 4). |
| **Админ `/admin/financial-health`** | В таблице PROCESSING: THB + `amount_in_payout_currency` (как у партнёра в preview). |

Оператору: если партнёр сравнивает ₽ в **карточке брони (snapshot)** с ₽ в **истории/модалке** — расхождение **нормально** (исторический raw vs live + выплатной спред). Текст в UI: «ориентир на текущий момент; факт — при исполнении заявки».

### 1.2. Как фиксировать конвертации (Stage 101)

Когда вы физически делаете обмен (например, RUB → KGS → USDT), это нужно занести в финтех-пульт:

1. Откройте **`/admin/settings/finances`** → блок **«Конвертации и потери»**.
2. Выберите тип операции и валюты (`from` / `to`).
3. Введите:
   - сумму «из» и сумму «в» (факт сделки),
   - фактический курс,
   - комиссию в THB (и RUB, если есть в банковском документе),
   - курсовую потерю в THB,
   - `tx hash` / ID банковской операции.
4. Нажмите **«Зафиксировать конвертацию»**.
5. Для бухгалтера нажмите **«Экспорт CSV»** — выгружаются все операции за выбранный период.

Что происходит после сохранения:
- создаётся журнал `TREASURY_CONVERSION_RECORDED` в ledger;
- в `ledger_entries` пишутся поля `conversion_*` + `external_tx_reference`;
- потери сразу попадают в виджет **«Реальная маржа за период»**.

Формула виджета:

`Реальная маржа = Принято от гостей (THB) − Выплачено партнёрам (THB) − Потери на конвертациях (THB)`

В интерфейсе дополнительно показывается справочный показатель «Принято от гостей (RUB)» для owner-view.

CSV-формат:
- разделитель `;` (Excel RU открывает без ручной настройки),
- поля: дата, тип операции, валюты, суммы, курс, комиссии, потери, tx/hash, комментарий, `journal_id`.

### 1.3. Ежедневный контроль (Stage 101.2)

Рекомендуемый ритуал владельца (5–10 минут):

1. Откройте **`/admin/settings/finances`** → **«Конвертации и потери»**.
2. Выберите период (**Сегодня** / **7 дней** / **30 дней** или свои даты).
3. Посмотрите блок **«Реальная маржа за период»**:
   - принято от гостей (RUB, справочно) и в батах;
   - выплачено партнёрам;
   - потери на конвертациях;
   - чистая маржа и **% от поступлений**.
4. После каждого физического обмена нажмите **«Зафиксировать конвертацию»** (курс, комиссии, tx/hash).
5. При необходимости отфильтруйте журнал по **типу операции** или **валюте** (RUB/KGS/USDT).
6. Нажмите **«Экспорт CSV»** — передайте файл бухгалтеру.
7. Нажмите **«Сверка с CSV»** — система сравнит журнал ledger с тем же SSOT-форматом выгрузки; зелёный статус = расхождений нет.

Если сверка показывает расхождения — проверьте период, повторите экспорт или обратитесь к разработчику (тип `FIELD_MISMATCH` / `MISSING_IN_CSV` в блоке сверки).

### 1.4. Пульт при 100+ бронях в месяц (Stage 101.3)

На **`/admin/settings/finances`**:

1. **Шапка** — красные/жёлтые бейджи: очередь чеков, расхождение книги, крупная сумма «готово к выплате» (порог по умолчанию ฿100 000, настраивается в `system_settings.general.fintech_ready_payout_alert_thb` или `FINTECH_READY_PAYOUT_ALERT_THB`).
2. **Вкладка «Обзор»** — маржа за месяц (полоска), сверка книги, касса, тарифы.
3. **Вкладка «Пулы»** — после перевода в банке нажмите зелёную **«Отметить как оплаченный»** (статусы LOCKED / EXPORTED).
4. **Вкладка «Журнал»** — все движения (конвертации, пулы, ledger, fiscal) с фильтрами.
5. **Вкладка «Выгрузки»** — **«Скачать пакет за текущий месяц»** (реестр броней + конвертации).

---

## 2. Cron: что включить, что выключить

Все financial cron: `POST https://<domain>/api/cron/<route>` + заголовок  
`Authorization: Bearer <CRON_SECRET>` или `x-cron-secret: <CRON_SECRET>`.  
Без секрета → **401**; без env на сервере → **503**.

### 2.1. Рекомендуемая матрица для Concierge

| Job | Concierge (ручной treasury) | Зачем / риск |
|-----|------------------------------|--------------|
| **`financial-health-monitor`** | **ВКЛ** (daily) | Telegram/telemetry: очередь чеков, drift ledger |
| **`escrow-thaw`** | **По выбору** | **ВКЛ hourly** — брони сами уйдут `PAID_ESCROW` → `THAWED` после `escrow_thaw_at`. **ВЫКЛ** — thaw только вручную (SQL/скрипт) — больше контроля, больше ручной работы |
| **`promote-ready-for-payout`** | **По выбору** | **ВКЛ hourly** — через 24h после thaw → `READY_FOR_PAYOUT`. **ВЫКЛ** — статус подтянет кнопка **«Сформировать пул»** (она вызывает promote внутри API) |
| **`payout-batch-pools`** | **ВЫКЛ** | Создаёт **DRAFT** без вашего просмотра. На Concierge пул только с **«Сформировать пул на сегодня»** в `/admin/settings/finances` |

**Vercel Hobby:** в `vercel.json` уже только **daily** `escrow-thaw` (00:00 UTC) и `financial-health-monitor`. Hourly — только **cron-job.org** (`docs/CRON_EXTERNAL_FINANCIAL.md`).

### 2.2. Как «выключить» job на cron-job.org

1. Открыть job → **Pause** / удалить расписание.  
2. Убедиться, что никто не дергает URL без вашего ведома.  
3. После паузы: брони остаются в текущем статусе; деньги **не уходят** с банка (их и так не уводит код).

### 2.3. Минимально жизнеспособный Concierge (рекомендация)

| Включено | Выключено |
|----------|-----------|
| `financial-health-monitor` daily | `payout-batch-pools` auto |
| `escrow-thaw` hourly *или* ручной thaw по чеклисту брони | Любые скрипты с `processAllPayoutsForToday` |
| `promote-ready-for-payout` **опционально** (можно заменить кнопкой пула) | Авто-выплаты legacy |

---

## 3. Первая реальная бронь — пошагово (владелец)

Замените `<BOOKING_ID>`, `<DOMAIN>`.

### Фаза A — до оплаты (день 0)

| # | Действие | Где | Ожидание |
|---|----------|-----|----------|
| A1 | `PRICING_ENGINE_V2=true`, fiscal prod согласован | Vercel env + `/admin/settings/finances` | Движок «Вкл», fiscal не «Песочница» |
| A2 | Партнёр: `is_verified`, payout profile | `/admin/marketing/payouts` или профиль | Иначе вывод заблокирован |
| A3 | Создать бронь, проверить сумму | Checkout / compliance | `pricing_snapshot` v2, сумма UI = server |
| A4 | Compliance **до** оплаты (опционально) | Export по UUID | Сохранить копию для бухгалтерии |

### Фаза B — оплата (день 0)

| # | Действие | Где | Ожидание |
|---|----------|-----|----------|
| B1 | Гость платит (MIR / card / crypto) | Checkout → PSP | Redirect / success |
| B2 | Webhook отработал | Логи / Supabase | `bookings.status = PAID_ESCROW` |
| B3 | Ledger | SQL ниже | Journal `booking_payment_capture:<id>`, debits = credits |
| B4 | Фискализация | `/admin/settings/finances` → очередь чеков | `ISSUED` или **Перепробить** |
| B5 | Ручной confirm (только если webhook не пришёл) | `/admin/finances` | Pending payment → confirm — **не** дублировать успешный webhook |

**Проверка в Supabase (read-only):**

```sql
SELECT id, status, partner_earnings_thb, commission_thb, escrow_thaw_at,
       metadata->>'escrow_started' AS escrow_started
FROM bookings WHERE id = '<BOOKING_ID>';

SELECT id, event_type, idempotency_key
FROM ledger_journals WHERE booking_id = '<BOOKING_ID>';
```

### Фаза C — эскроу (до конца проживания / услуги)

| # | Действие | Где | Ожидание |
|---|----------|-----|----------|
| C1 | Партнёр видит «В эскроу» | `/partner/finances` | `frozenBalanceThb` ↑ |
| C2 | Спор (если есть) | `/admin/disputes` | `freeze_payment` → thaw/promote **не** трогают бронь |
| C3 | Дождаться `escrow_thaw_at` | Категория: `lib/escrow-thaw-rules.js` | Жильё: обычно после check-in + правило TZ |

**Thaw вручную (если cron выключен):**

```bash
curl -X POST "https://<DOMAIN>/api/cron/escrow-thaw" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Или дождаться daily Vercel cron (раз в сутки) — медленнее.

| После thaw | Поле / статус |
|------------|----------------|
| Статус | `THAWED` |
| Метка | `metadata.escrow_thawed_at` |
| UI партнёра | «Разморозка (24 ч)» |

### Фаза D — 24 часа после thaw

| # | Действие | Где | Ожидание |
|---|----------|-----|----------|
| D1 | Не платить партнёру раньше 24h | — | SSOT: `PARTNER_WITHDRAWAL_HOLD_MS` |
| D2 | Promote (если cron выключен) | Кнопка **«Сформировать пул»** *или* cron | `READY_FOR_PAYOUT`, `ready_for_payout_at` |
| D3 | Партнёр UI | `/partner/finances` | «Доступно к выводу» |

```bash
curl -X POST "https://<DOMAIN>/api/cron/promote-ready-for-payout" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Фаза E — ваш перевод денег (treasury)

**Порядок блоков и кнопок в пульте** (`/admin/settings/finances`, Stage 100.5):

Сверху вниз на экране:

| # | Блок в UI | Действие |
|---|-----------|----------|
| 1 | **Сверка денежной книги** | «Запустить сверку сейчас» → расхождение ≈ 0 |
| 2 | **Пулы выплат партнёрам** | Чипы 1–6 в шапке блока = тот же порядок, что в таблице ниже |
| 3 | **Конвертации и потери** | Заглушка Stage 101 — пока внешняя таблица; кнопка «Сохранить» покажет тост |
| 4 | **Реестр для банка и бухгалтерии** | CSV по **дате оплаты**, разделитель `;` |

**Внутри пула (Пн/Чт — treasury day):**

```
1. «Сформировать пул на сегодня» → DRAFT (вне Пн/Чт → «Вне расписания (форс)»)
2. «Зафиксировать перед выгрузкой» → LOCKED
3. «Скачать CSV для банка»        → проверить суммы и реквизиты
4. Банк / T-Bank                  → физический перевод (вне приложения)
5. «Отметить как оплаченный»      → зелёная кнопка в строке пула (LOCKED/EXPORTED)
   → SETTLED, брони COMPLETED, ledger + sync балансов партнёров
```

| # | API (если нужно из curl) |
|---|---------------------------|
| Создать пул | `POST /api/admin/finances/payout-batches` body `{"rail":"TBANK_RU","force":true}` |
| Lock | `PATCH /api/admin/finances/payout-batches/<batchId>` body `{"action":"lock"}` |
| CSV | `GET /api/admin/finances/payout-batches/<batchId>/export?format=csv` |
| Settled | `PATCH ...` body `{"action":"settled"}` |

#### 3.1. Закрытие пула (Stage 100.3)

В `/admin/settings/finances` у пула в статусе **LOCKED** или **EXPORTED** — зелёная кнопка **«Отметить как оплаченный»** (`PATCH action: settled`).  
Сервер: `PayoutBatchService.markBatchSettled` — проводки `PARTNER_PAYOUT_OBLIGATION_SETTLED` по каждой брони, `bookings` → `COMPLETED`, `syncPartnerBalanceColumns`.

**Альтернатива — поштучные заявки партнёра:**

| Шаг | Где |
|-----|-----|
| Партнёр `POST /api/v2/partner/payouts` (не stub `/payouts/request`) | `/partner/finances` |
| Админ PROCESSING → PAID/FAILED | `/admin/financial-health` |
| Реестр T-Bank | Кнопка registry на financial-health |

### Фаза F — после выплаты

| # | Действие | Ожидание |
|---|----------|----------|
| F1 | Реестр CSV (период или UUID) | `/admin/settings/finances` → **Скачать CSV**; фильтр по **дате оплаты**; разделитель `;` для Excel; колонки на русском; пустой период — строка-пояснение в файле |
| F2 | Партнёр: история выплат | `GET /api/v2/partner/payouts` |
| F3 | Сохранить CSV + checksum пула | `payout_batches.export_checksum` после export |

---

## 4. Ежедневный чеклист владельца (5–10 мин)

| ✓ | Пункт | Путь |
|---|--------|------|
| ☐ | Сверка ledger | `/admin/settings/finances` → **Запустить сверку** |
| ☐ | Очередь чеков 54-ФЗ | Тот же пульт → **Перепробить** при ошибках |
| ☐ | Счётчик «Готово к выплате» | Карточка в шапке пульта |
| ☐ | Открытые споры с freeze | `/admin/disputes` |
| ☐ | Ops / Telegram | `financial-health-monitor`, `PENDING_FISCAL`, `LEDGER_DRIFT` |
| ☐ | Тестовые платежи не смешаны с боевыми | `/admin/finances` — бейдж **ТЕСТ** |

**Пн и Чт (treasury day):**

1. Сверка → 2. Пул (или Force) → 3. Lock → 4. CSV → 5. Банк → 6. Settled (API).

---

## 5. Чего не делать на Concierge

| Запрет | Почему |
|--------|--------|
| Включать auto `payout-batch-pools` без просмотра | Появится DRAFT без вашего чека сумм |
| Дважды confirm одну оплату (webhook + admin) | Риск дублей; webhook идемпотентен, ручной confirm — нет |
| Вызывать `processAllPayoutsForToday` в prod | Legacy: `PAID_ESCROW` → `COMPLETED` в обход batch (ADR-097) |
| Путать `/api/v2/partner/payouts/request` (stub) и `/api/v2/partner/payouts` | Stub **не создаёт** выплату |
| Платить партнёру при активном `freeze_payment` | Нарушение dispute policy |
| Менять % в pricing profiles без ADR | SSOT комиссий для новых броней |

---

## 6. Быстрая диагностика по статусу брони

| Статус | Деньги у партнёра (учёт) | Следующий шаг владельца |
|--------|---------------------------|-------------------------|
| `PENDING` / `CONFIRMED` | Нет capture | Дождаться оплаты |
| `PAID_ESCROW` | В эскроу (ledger credit есть) | Ждать `escrow_thaw_at` или cron thaw |
| `THAWED` (< 24h) | Hold | Ждать 24h, не платить |
| `THAWED` (≥ 24h) | Доступно в UI | Promote или кнопка пула |
| `READY_FOR_PAYOUT` | В очереди treasury | Пул → CSV → банк |
| `COMPLETED` | Закрыто в продукте | Архив, compliance |

---

## 7. Карта админ-экранов (одна страница)

| Задача | URL |
|--------|-----|
| Treasury, пулы, v2, compliance | `/admin/settings/finances` |
| Pending payments, ручной confirm | `/admin/finances` |
| Ledger balances, T-Bank registry, payout PAID | `/admin/financial-health` |
| Споры | `/admin/disputes` |
| Referral payout verify | `/admin/marketing/payouts` |

| Партнёр: балансы и вывод | `/partner/finances` — полоска «В эскроу / Разморозка 24 ч / Доступно / Выплачено» |
| Партнёр: реквизиты RUB / USDT | `/partner/payout-profiles` — карта или счёт, USDT TRC20 |
| Партнёр: брони в эскроу | `/partner/bookings` |

---

## 8. Smoke перед первым live-гостем

```bash
CRON_SECRET=xxx BASE_URL=https://<DOMAIN> EXPECT_PRICING_V2=true \
  node scripts/financial-prelaunch-smoke.mjs
```

Staging: полный сценарий `docs/FINANCIAL_SMOKE_E2E.md` (A: happy path, B: dispute).

---

## 9. Rollback (одна строка решения)

| Проблема | Действие |
|----------|----------|
| Неверный pricing v2 | `PRICING_ENGINE_V2=false` + стоп новых броней |
| Fiscal down | `FISCAL_SANDBOX=true`, escrow не откатывать |
| Неверный пул | Не Lock; удалить DRAFT по runbook в `PRE_LAUNCH_CHECKLIST` §9 |
| Ledger drift | Стоп оплат, сверка, compliance export, разбор journal |

---

## 10. Эквайринг RUB (Stage 100.3)

| Env | Значение | Эффект |
|-----|----------|--------|
| `PAYMENT_ACQUIRER_RUB_ENABLED` | `1` (default) | YooKassa/MIR: `currency: RUB`, сумма из `pricing_snapshot` / `price_paid` |
| `PAYMENT_ACQUIRER_RUB_ENABLED` | `0` | Legacy: THB в запросе (только для отката) |
| `PAYMENT_ACQUIRER_RUB_SHADOW` | `1` | Лог RUB, в PSP уходит THB (staging) |

SSOT расчёта: `lib/services/payment-adapters/acquirer-charge-amount.js`.  
Webhook сверяет RUB с snapshot; escrow/ledger — **THB** (`intent.amount_thb`).

Перед первым live MIR: убедитесь, что у брони в snapshot есть `final_breakdown.total_guest_brutto` с `currency: RUB` (Pricing Engine v2 + `currency: RUB` при создании).

---

## 11. Дорожная карта (после Concierge)

1. **Env-флаги** `TREASURY_AUTO_PROMOTE`, `TREASURY_AUTO_POOL` — явное отключение auto в cron routes.
2. **Единый экран treasury** — объединить `/admin/finances` и `/admin/settings/finances`.
3. **PSP ↔ ledger reconcile** — отчёт «эквайер vs guest-clearing».

---

*Версия runbook: 2026-05-16 · Stage 100.5 (финтех-пульт: русский UI, пулы + «Отметить как оплаченный», заглушка конвертаций; партнёрские балансы и реквизиты) · при изменении cron/API обновить `docs/CRON_EXTERNAL_FINANCIAL.md` и `docs/PRE_LAUNCH_CHECKLIST.md`.*
