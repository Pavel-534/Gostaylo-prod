# Календарь: ночи, iCal и часовые пояса

**Stage 152.3 (v12.152.3)** — SQL occupancy parity: **`batch_check_listing_availability`** и **`create_booking_atomic_v1`** оба интерпретируют ночи брони через **`timezone(resolve_listing_timezone_v1(metadata), check_in/out)::date`** (`migrations/stage152_03_batch_availability_tz_fix.sql`). **Wave 3b backlog:** JS-слой каталога (`CalendarService.checkBatchAvailability` → **`calendar-update.service.js`**) по-прежнему приводит гостевые даты поиска через глобальный env TZ (`toListingDate`) без per-listing TZ в мульти-рыночном batch — отдельный этап.

**Stage 152.1 (v12.152.1)** — модель **Floating Local Date**: все операции календаря оперируют строками **`YYYY-MM-DD`**. Блокировка ночи привязана к локальному времени объекта (`listing.metadata.timezone` → SSOT **`lib/geo/listing-timezone-ssot.js`**).

## Ночная модель (OTA)

- **Занятые ночи:** от `check_in` (включительно) до `check_out` **не включая** — день выезда не считается ночью проживания.
- **День выезда** в партнёрском UI может отображаться как доступный для нового заезда (после выезда гостя).
- **Блоки** (`calendar_blocks`): границы **включительно** `[start_date, end_date]`, если в коде не указано иное.
- **Приоритет при пересечении на одну дату:** бронь (ночь) > блок > свободно.

## SSOT занятых статусов

- JS: **`lib/booking/status-sets.js`** → `OCCUPYING_BOOKING_STATUSES` (вкл. **`AWAITING_PAYMENT`**, **`THAWED`**).
- SQL: **`create_booking_atomic_v1`**, **`batch_check_listing_availability`** — дефолтные массивы синхронизированы (`migrations/stage152_01_thawed_occupying_ssot.sql` добавил **`THAWED`**); ночной overlap броней — per-listing TZ (**`stage152_03`**).

## Checkout hold TTL (Stage 152.1)

- Брошенный checkout в **`AWAITING_PAYMENT`** автоматически отменяется cron **`/api/cron/cleanup-drafts`** через **`processExpiredAwaitingPaymentCheckouts`** (`lib/booking/checkout-hold-expiry.js`).
- TTL по умолчанию **30 мин** (`CHECKOUT_HOLD_TTL_MINUTES` env, минимум 5).
- Якорь: `max(payment_intents.initiated_at | payment_intents.created_at, bookings.created_at)` — **без** `updated_at` (случайные touch не продлевают hold).

## iCal (all-day + timezone)

- По **RFC 5545** для `VALUE=DATE` поле **DTEND — исключительная** граница: последняя занятая дата = день **до** DTEND (`lib/ical-all-day-range.js`).
- **Stage 152.1:** парсер **`lib/services/ical-calendar-blocks-sync.js`** — **без** костыля `hour - 7`; даты приводятся к **`YYYY-MM-DD`** в TZ листинга (`resolveListingTimeZoneFromMetadata`), без промежуточного сдвига через системный UTC Node.
- All-day: компактные `YYYYMMDD` → inclusive `start_date` / exclusive `DTEND` → inclusive `end_date`.
- **Stage 152.2:** iCal sync — **`replaceCalendarBlocksForSource`** → RPC **`replace_calendar_blocks_for_source_v1`** (atomic DELETE+INSERT; migration **`stage152_02`**).
- Datetime с `Z`: instant → `toListingDate(utc, listingTz)`.
- Floating datetime (без Z/TZID): календарный день из компонент DT*.

## Утилиты дат

- **`lib/listing-date.js`** — `toListingDate`, `listingDateToday`, `addListingDays`, `listingYmdLocalWallTimeToUtcIso` (escrow thaw wall time).
- Env fallback: `LISTING_DATE_TZ` / `NEXT_PUBLIC_LISTING_DATE_TZ` (default `Asia/Bangkok`).
- Гео-fallback: `Asia/Bangkok` (TH), `Europe/Moscow` (RU) и др. в `listing-timezone-ssot.js`.
