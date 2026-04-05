# GoStayLo — Technical Manifesto (code-truth)

**Назначение:** короткий операционный снимок **текущего** кода. Детали политики и обзор продукта — в корневом **`ARCHITECTURAL_DECISIONS.md`** (SSOT). Этот файл не дублирует длинные списки API и не хранит секреты.

**Стек (факт из репозитория):** Next.js **14** (App Router), React, Supabase (Postgres + Storage), JWT в cookie `gostaylo_session`, Prisma `schema.prisma` только как описание схемы (рантайм — Supabase).

---

## 1. Как мы считаем деньги

- **База:** все денежные суммы в БД и расчётах — **THB** (`base_price_thb`, брони, снимки).
- **Курсы для UI (карточки, каталог):** таблица **`exchange_rates`** (`rate_to_thb` = THB за 1 единицу валюты). Сервер: **`lib/services/currency.service.js`** → **`getDisplayRateMap`**, TTL **6 ч** (`EXCHANGE_RATES_DB_TTL_MS`), при необходимости ExchangeRate-API v6 и upsert в БД. Публичный API: **`GET /api/v2/exchange-rates`**. Клиентский кеш: **`lib/client-data.js`** (`fetchExchangeRates`).
- **USDT для платежей / уведомлений:** **`resolveThbPerUsdt()`** — сначала свежая строка USDT в **`exchange_rates`**, иначе API, иначе env **`FALLBACK_THB_PER_USDT`** / **`general.fallbackThbPerUsdt`** (через **`currency-last-resort.js`**). В **`currency.service.js`** нет захардкоженных курсов вроде **35.5**.
- **Комиссия платформы (дефолт):** **`resolveDefaultCommissionPercent()`** — `system_settings.general.defaultCommissionRate` → env **`DEFAULT_COMMISSION_PERCENT`**. Не подставлять **15** в UI как единственный источник.
- **Счета в чате (THB ↔ USDT):** **`getEffectiveRate`** умножает курс на **`resolveChatInvoiceRateMultiplier`**: `general.chatInvoiceRateMultiplier` (админка **`/admin/settings`**) → **`CHAT_INVOICE_RATE_MULTIPLIER`** → дефолт только в **`platformDefaultChatInvoiceRateMultiplier()`** в **`currency-last-resort.js`**. В **`currency.service.js`** нет литерала **1.02**.
- **Цена брони по датам:** **`lib/services/pricing.service.js`** (ночи/дни, сезонные ставки, скидки за длительность из `metadata.discounts`). Снимок на бронь: **`lib/booking-pricing-snapshot.js`** + колонка **`bookings.pricing_snapshot`**.

**Важно (долг):** параллельно живёт **`lib/services/forex.service.js`** + **`GET /api/v2/forex`** (свой кеш и маркап **1.035**), на него смотрит **`hooks/use-currency.js`**. Это **второй** FX-пайплайн рядом с CurrencyService — не смешивать с каноном отображения без ревью.

---

## 2. Как мы синхронизируем календари

- **Истина по блокировкам:** таблица **`calendar_blocks`** + **`lib/services/calendar.service.js`** (доступность, пересечения с бронями).
- **Импорт внешних календарей (iCal → `calendar_blocks`):** один модуль **`lib/services/ical-calendar-blocks-sync.js`** (unfold строк, all-day и datetime, фильтр «конец ≥ сегодня», delete+insert по `source` URL).
- **Кто вызывает:** **`/api/cron/ical-sync`**, **`/api/ical/sync`**, **`/api/v2/admin/ical`**. Включение источников: **`lib/ical-sync-source-enabled.js`**.
- **Логи:** **`ical_sync_logs`**. Экспорт `.ics` гостю: **`/api/v2/listings/[id]/ical`**.
- **Даты листинга:** гражданский день в **`Asia/Bangkok`**: **`lib/listing-date.js`**. All-day iCal: **`lib/ical-all-day-range.js`** (exclusive DTEND).

**Не использовать** для прод-записи партнёрами: устаревший **`availability_blocks`** (см. ADR).

---

## 3. Как мы разделяем жильё / транспорт / туры

- **Категории** приходят как slug (например `property`, `vehicles`, `tours`, `yachts`) — см. БД/админку категорий, **`lib/listing-category-slug.js`**.
- **UX бронирования (эксклюзив vs shared «места»):** **`lib/listing-booking-ui.js`** — `getListingBookingUiMode`, `isExclusiveInventoryCategory`, `isSharedInventoryCategory`, цельное судно: `isWholeVesselListing`.
- **Подписи «ночи» vs «сутки/дни»:** **`getListingRentalPeriodMode`** — режим **`day`** для транспорта (**`vehicles`**), яхт/лодок (**slug содержит yacht/boat**), туров (**`tours`** или **`tour`** в slug); иначе **`night`**. Виджет: **`components/listing/BookingWidget.jsx`**.
- **Расчёт ночей/дней в цене** завязан на **`PricingService`** и тип листинга; UI-режим day/night влияет на копирайт и выбор периода, а не заменяет серверную валидацию.

---

## 4. Указатель на ядро (файлы)

| Область | Файл(ы) |
|--------|---------|
| FX / комиссия / чат-курс | `lib/services/currency.service.js`, `lib/services/currency-last-resort.js` |
| Календарь + бронь | `lib/services/calendar.service.js`, `lib/services/booking.service.js` |
| Цены | `lib/services/pricing.service.js` |
| iCal → блоки | `lib/services/ical-calendar-blocks-sync.js` |
| Категории / UI режим | `lib/listing-booking-ui.js`, `lib/listing-category-slug.js` |
| Платежи / эскроу (крон) | `lib/services/payment.service.js`, `lib/services/escrow.service.js`, `app/api/cron/payouts` |

---

**Версия документа:** переписан под код после унификации iCal, CurrencyService и day/night UX (апрель 2026). Устаревшие детали старого паспорта удалены намеренно.
