# Architectural Decisions — GoStayLo / Super App

## Единственный источник истины (SSOT)

- **Этот файл (`ARCHITECTURAL_DECISIONS.md` в корне репозитория)** — канонический манифест проекта: стек, золотые правила, порядок ревью.
- **`.cursorrules`** — только короткий «указатель» для Cursor: напоминание открыть этот файл и не дублировать политики. **При любом расхождении побеждает только `ARCHITECTURAL_DECISIONS.md`.**
- Менять архитектурные правила нужно **здесь**; затем при необходимости сжато обновить `.cursorrules` (если добавились новые жёсткие триггеры для агента).

---

## Перед задачей (команда: человек + AI)

Перед выполнением **любой** нетривиальной задачи сверяйся с этим документом. Если в коде встречается или предлагается хардкод вроде **15%** комиссии или **35.5** для курса — **не добавляй и не размножай**: бери данные из **`system_settings`**, **`exchange_rates`**, **`profiles`**, полей **бронирования** (снимок на момент создания), **`JWT_SECRET` / FX-ключей из env** и существующих хелперов (`PricingService`, **`lib/services/currency.service.js`**, `getJwtSecret` и т.д.). Числовые аварии только через **`lib/services/currency-last-resort.js`** + env / опциональное поле `general.fallbackThbPerUsdt` (см. Golden rule §2).

**Явный отказ от магических чисел в прод-коде CurrencyService:** запрещено снова вводить в **`currency.service.js`** (и размножать по UI) фиксированные курсы вроде **35.5** THB/USDT и фиксированный множитель **1.02** для чат-счетов. Канон: **`exchange_rates`** + API/env/`general.fallbackThbPerUsdt` для USDT; для чата — **`general.chatInvoiceRateMultiplier`** (админка) → **`CHAT_INVOICE_RATE_MULTIPLIER`** → единственный числовой дефолт множителя в **`platformDefaultChatInvoiceRateMultiplier()`** внутри **`currency-last-resort.js`**.

---

This document is the **project manifesto**: how we build, what is allowed, and what to fix when drift appears.

---

## Current tech stack (high level)

| Layer | Choice |
|--------|--------|
| **App** | Next.js (App Router), React |
| **Database** | PostgreSQL via **Supabase** (REST + `supabase-js` / service role on server) |
| **Auth** | Custom JWT in HttpOnly cookie (`gostaylo_session`), bcrypt passwords in `profiles` |
| **ORM / schema** | **Prisma `schema.prisma`** as **documentation and typing reference** for tables/enums — **not** the primary runtime data layer |
| **Realtime / storage** | Supabase (where configured): Realtime, Storage |
| **Email** | Resend (when `RESEND_API_KEY` is set) |
| **FX / комиссия (канон)** | **`lib/services/currency.service.js`** (`getDisplayRateMap`, `resolveThbPerUsdt`, `resolveDefaultCommissionPercent`, `getEffectiveRate`, `resolveChatInvoiceRateMultiplier` для чат-счетов). **`lib/services/currency-last-resort.js`** — env / `general.fallbackThbPerUsdt`, **`CHAT_INVOICE_RATE_MULTIPLIER`**, платформенный дефолт множителя чата — без литералов курсов/комиссий в `currency.service`. Таблица **`exchange_rates`**, ExchangeRate-API v6. |
| **Deploy** | Typical: Vercel + Supabase project |

---

## Golden rules

### 1. Database: Supabase first; Prisma for schema docs only

- **All production reads/writes** go through **Supabase** (`@/lib/supabase`, `supabaseAdmin`, or REST from server routes).
- **`prisma/schema.prisma`** stays aligned with the real Supabase schema and enums, but **do not introduce new Prisma Client queries** for product features unless ADR explicitly allows it.
- **`lib/prisma.js` was removed** — runtime data access uses Supabase only; Prisma remains as **`schema.prisma` documentation** (see Golden rule §1).

### 2. No hardcoded commissions or exchange rates

- **Commissions** must come from **`profiles.custom_commission_rate`**, **`system_settings`** (e.g. `general.defaultCommissionRate`), **`DEFAULT_COMMISSION_PERCENT`** env, or **values snapshotted on the booking row** — not magic numbers in UI or payment stubs. В **`currency.service.js`** нет числовых запасных констант: при полном отсутствии источников выбрасывается **ошибка** с понятным логом.
- **Exchange rates** must come from **`exchange_rates`** and/or the **approved FX service** using **env-provided API keys** — не вносить литералы курсов в `currency.service.js`. Аварийный порядок: **`FALLBACK_THB_PER_USDT`** env и/или **`system_settings.general.fallbackThbPerUsdt`** (см. **`currency-last-resort.js`**).
- **Множитель курса для счетов в чате (THB↔USDT):** **`system_settings.general.chatInvoiceRateMultiplier`** (админка `/admin/settings`) → env **`CHAT_INVOICE_RATE_MULTIPLIER`** → дефолт платформы только в **`currency-last-resort.js`** (`platformDefaultChatInvoiceRateMultiplier`; исторически это замена захардкоженного **1.02**). В **`currency.service.js`** не хранить жёсткий множитель.
- **Курсы THB/USDT и кресты:** не использовать в проде захардкоженные значения вроде **35.5** — только **`exchange_rates`**, утверждённый FX API с ключом из env и цепочка **`currency-last-resort.js`** / **`general.fallbackThbPerUsdt`**.
- **Allowed exception:** единый модуль **`currency-last-resort.js`** читает только **env / JSON settings**, без дублирования магических чисел по проекту.

### 3. Booking logic lives in service layers

- **Availability, pricing, creation, status transitions, and calendar side-effects** must be implemented in **dedicated services** (e.g. `CalendarService`, `BookingService`, `PricingService`, `EscrowService`) and called from route handlers.
- **API routes** should validate input, auth, and delegate; **avoid** duplicating night-overlap rules, seasonal price rules, or commission math across multiple files.

### 4. Mock / fake code: report and schedule removal

- Any **mock payment**, **in-memory “DB”**, **demo fallbacks**, or **placeholder API keys** discovered during work must be:
  1. **Reported** (ticket / doc / PR description),
  2. **Guarded** behind explicit env flags or `NODE_ENV` where it must remain short-term,
  3. **Scheduled for removal** with an owner and target date.
- **Production** must not depend on mock branches without a deliberate, reviewed exception.

### 5. Security configuration

- **`JWT_SECRET`** is **mandatory** in every deployed environment; the app must **fail loudly** (500 + clear message) if it is missing — never ship with an implicit default secret.

### 6. Environment variables

- **Document** all required secrets in **`.env.example`** (without real values).
- Prefer **one canonical name** per integration (e.g. FX: align `EXCHANGE_RATE_KEY` / `EXCHANGE_API_KEY` in docs and code).

### 7. Display names and image uploads (privacy & consistency)

- **All user-facing name formatting** that shows a person to another user (reviews, chat labels, invoice sender, typing indicator, etc.) must use **`lib/utils/name-formatter.js`** (`formatPrivacyDisplayName`, `formatPrivacyDisplayNameForParticipant`, `formatReviewerInitial`) so display stays **first name + last initial**, with **`stripLegacyModeratorMarker`** applied via that module — do not reimplement ad hoc.
- **All browser image uploads** that end up in product Storage must go through **`lib/services/image-upload.service.js`** (compression to WebP, resize, then `POST /api/v2/upload`) so behavior stays consistent; new buckets must be allowlisted in **`app/api/v2/upload/route.js`**.

### 8. Calendar blocking (single source of truth)

- **Manual blocks, iCal imports, and availability checks** must use **`calendar_blocks`** together with **`CalendarService`** / booking overlap rules. Do not add parallel block tables for product flows; **`availability_blocks`** is legacy and must not be written from partner APIs.

---

## LIVE PRODUCT STATE

Операционное поведение продуктовых модулей **как в коде сейчас** (канон для аудита; при расхождении с чатами править код или этот раздел).

### Pricing & Discounts (длительность)

- **Где хранится:** `listings.metadata.discounts` — канонический ввод партнёра: **`{ "weekly": 7, "monthly": 20 }`** (7 и 30 ночей соответственно); дополнительно поддерживаются **legacy**-ключи `N_days` / `N` (см. `parseDurationDiscountTiers` в `lib/services/pricing.service.js`).
- **Когда считается:** процент скидки применяется к **субтоталу после ночных/сезонных ставок** (не к базе за одну ночь в отрыве от дат). «Лучший» подходящий порог (max % среди tier’ов с `nights >= minNights`) побеждает.
- **Партнёрский ввод:** форма «Скидки за длительность» (`PartnerListingDurationDiscountFields`) на `/partner/listings/new` и `/partner/listings/[id]` пишет **`weekly` / `monthly`** (через `applyDurationDiscountField` / `duration-discount-helpers`).
- **Публичный UI:** блок **«Special offers»** (`DurationDiscountOffersBlock` в `components/listing/BookingWidget.jsx`) показывает настроенные уровни **до** выбора дат (включая legacy-пороги **3+, 5+** и т.д., не только 7/30); после выбора дат — разбивка цены, строка скидки за длительность и усиленная строка **«Итого»**, если применилась скидка (длительность или сезонная скидка по ставкам).
- **Транспорт, яхты и туры (подписи):** **`getListingRentalPeriodMode`** в `lib/listing-booking-ui.js` — режим **`day`** для **vehicles**, **yacht/boat** в slug и **tours** / подстроки **tour**; в виджете бронирования — **сутки/дни**, не «ночи».
- **Туры — размер группы и дни в БД:** лимит гостей задаётся в **`listings.metadata.group_size_min` / `group_size_max`**; при создании брони **`POST /api/v2/bookings`** для `categories.slug === 'tours'` проверяется **`guestsCount`**, а не длина периода против min/max дней. Колонки **`min_booking_days` / `max_booking_days`** для туров в партнёрском потоке выставляются в **1 / 730** (не семантика «группа»). Миграция старых значений из колонок в metadata: **`mergeTourGroupMetadataFromListingColumns`** в **`lib/partner/listing-wizard-metadata.js`**. Подробная таблица — **`docs/TECHNICAL_MANIFESTO.md`** §3.
- **Чат:** отправка сообщений с клиента — **`POST /api/v2/chat/messages`**. Роута **`/api/messages`** в App Router нет; системные сообщения о статусе брони пишет сервер через **`syncBookingStatusToConversationChat`** (**`lib/booking-status-chat-sync.js`**), а не отдельный устаревший HTTP-вызов с фронта.

### Currency System

- **Канон:** один серверный модуль **`lib/services/currency.service.js`** (курсы, USDT, дефолтная комиссия, **`getEffectiveRate`** с **`resolveChatInvoiceRateMultiplier`** для счетов в чате). Устаревший реэкспорт **`currency-helper.js`** удалён — импорты только из **`currency.service.js`**.
- **Last-resort без литералов в CurrencyService:** **`lib/services/currency-last-resort.js`** — `FALLBACK_THB_PER_USDT`, `DEFAULT_COMMISSION_PERCENT`, `CHAT_INVOICE_RATE_MULTIPLIER`, опционально **`general.fallbackThbPerUsdt`** в `system_settings`; дефолт множителя чата — **`platformDefaultChatInvoiceRateMultiplier`**.
- **Источник истины для курсов отображения:** таблица **`exchange_rates`** в Supabase (`rate_to_thb` = сколько THB за **1** единицу валюты). Символы и список валют селектора: `lib/currency.js` (`CURRENCIES`), API: `GET /api/v2/exchange-rates` (`app/api/v2/exchange-rates/route.js`).
- **Серверный TTL «свежести» БД:** `EXCHANGE_RATES_DB_TTL_MS` = **6 часов** в `lib/services/currency.service.js` — пока строки не старше TTL, внешний **ExchangeRate-API** не дергается; при необходимости обновления выполняется запрос и **upsert** в `exchange_rates` (ключи `EXCHANGE_RATE_KEY` / `EXCHANGE_API_KEY`).
- **Клиент:** `fetchExchangeRates()` в `lib/client-data.js` ходит на тот же API и кеширует `rateMap` в **localStorage** с TTL, **согласованным с 6 часами** (тот же горизонт, что и серверный TTL БД), чтобы не долбить `/api/v2/exchange-rates` на каждом монтировании.
- **Отображение сумм:** `formatPrice` в **`lib/currency.js`** использует только переданный **`exchangeRates`** (как `rateMap` с API); в модуле **нет** захардкоженной таблицы курсов для отображения (удалены неиспользуемые `convertFromThb` / `convertToThb` с литералами).

### Calendar & Timezones

- **Календарные даты листингов (день без времени):** каноническая таймзона — **`Asia/Bangkok`** через `lib/listing-date.js` (`LISTING_DATE_TZ` / `NEXT_PUBLIC_LISTING_DATE_TZ`).
- **Доступность и блокировки:** единая модель **`calendar_blocks`** + `CalendarService` (см. Golden rule §8); устаревший путь **`availability_blocks`** не использовать для записи из партнёрских API.
- **iCal (прод, синхронизация внешних календарей → `calendar_blocks`):** единый модуль **`lib/services/ical-calendar-blocks-sync.js`** (разбор VEVENT с unfold строк, all-day и datetime, запись в **`calendar_blocks`**, логи **`ical_sync_logs`**). Его вызывают **`GET/POST /api/cron/ical-sync`** (Vercel Cron по **`vercel.json`**), **`app/api/ical/sync/route.js`**, **`app/api/v2/admin/ical/route.js`**; включение источников — **`isIcalSyncSourceEnabled`**. **Экспорт** подписного `.ics` для гостя: **`app/api/v2/listings/[id]/ical/route.js`** (`X-WR-TIMEZONE:Asia/Bangkok`). Файл **`lib/services/ical-sync.service.js`** **удалён** (был не подключён к роутам; дублировал логику).
- **Операционные кроны** (время в комментариях к route): payouts / check-in reminder завязаны на **Bangkok** как продуктовый локальный день.

### Booking Snapshots (расчёт в БД)

- **Колонка:** `bookings.pricing_snapshot` (**JSONB**), миграция `database/migrations/017_booking_pricing_snapshot.sql`.
- **Содержимое (v1):** строится `buildBookingPricingSnapshot` в `lib/booking-pricing-snapshot.js` при создании брони в `BookingService` — ночи, субтоталы, блок `duration_discount` (процент, сумма THB, порог ночей, подписи ru/en), опционально `promo`.
- **Назначение:** зафиксировать детальный расчёт на момент бронирования для чеков, споров и истории; не подменять задним числом расчёт из текущих `metadata` листинга.

### Профили, публичная идентичность и приватность

- **Источник данных сессии (рентер / партнёр / общий UI):** серверный **`GET` / `PATCH /api/v2/auth/me`** читает и обновляет строку в **`profiles`** (JWT из cookie `gostaylo_session`). Клиент после успешных ответов обновляет **`localStorage['gostaylo_user']`** и должен диспатчить **`gostaylo-refresh-session`** (и при необходимости опираться на **`auth-change`**) чтобы шапка сайта, сайдбар партнёра и портал рентера подхватывали **аватар** и поля профиля без перезагрузки страницы.
- **Публичная карточка пользователя:** маршрут **`/u/[id]`** (App Router) показывает **только** то, что отдаёт **`GET /api/v2/profiles/[id]/public`**: отображаемое имя (канон — правила приватности из **`lib/utils/name-formatter.js`**, без email в публичном API), **аватар** (URL из БД прогоняется через **`toPublicImageUrl`** / `/_storage/…` на клиенте), **дата регистрации** (месяц/год), **флаг верификации** (`is_verified` / статус), блок **отзывов**. **Email и телефон на публичной странице не отображаются и не отдаются этим API.** Профили с ролью вне **RENTER / PARTNER / USER** публичным эндпоинтом **не раскрываются** (404).
- **Отзывы на публичной странице:** для **партнёра** — **`GET /api/v2/reviews?partner_id=`** (отзывы по всем его листингам). Для **рентера** — **`GET /api/v2/reviews?reviewer_id=`** (отзывы, где `user_id` совпадает с профилем). **Важно:** если у партнёра **нет** листингов, API возвращает **пустой список**, а не все отзывы платформы (защита от утечки данных).
- **Листинг (владелец в JSON):** в **`GET /api/v2/listings/[id]`** в объект **`owner`** попадают **`email` и `phone` только** если запрос идёт от **владельца этого листинга** или **ADMIN/MODERATOR** (проверка по сессии). Иначе в ответе остаются только публичные поля (имя, аватар, верификация и т.д.).
- **Связь с пользователем без утечки контактов:** с публичного профиля контакт возможен только через **«Написать в чат»** → **`POST /api/v2/chat/conversations/from-profile`** с телом **`{ targetUserId, language }`**. Поддерживаются пары **(рентер или staff-роль) ↔ партнёр** и **партнёр ↔ рентер**; у стороны с ролью **partner** в диалоге должен существовать хотя бы один листинг со статусом **ACTIVE** (используется как опора для той же модели `conversations`, что и инквайри с листинга). Текст первого сообщения зависит от **`language`** (ru/en/zh/th).
- **Аватары (загрузка):** файлы уходят в **`POST /api/v2/upload`** с бакетом **`listing-images`** и префиксом пути **`avatars/{userId}/`**; в **`profiles.avatar`** сохраняется **публичный URL** объекта в Storage. Опционально в allowlist добавлен бакет **`avatars`** (изображения только). Отображение везде через **`toPublicImageUrl`** для единообразия с остальным медиа.
- **UI-навигация к профилю:** в **`components/listing/ListingInfo.jsx`** клик по **фото/имени хозяина** ведёт на **`/u/{owner.id}`** (при наличии `owner.id`).
- **Экраны настроек:** **рентер** — **`/renter/settings`** (имя, фото, часть notification preferences); **партнёр** — **`/partner/settings`** (фото, телефон, prefs). Локализация новых строк — **`lib/translations/ui.js`** (в т.ч. ключи **`publicProfile*`**).

---

## Completed roadmap items (reference)

- **Category Unification & Tours Logic Fix** — **COMPLETED** (see **`ROADMAP.md`** §1.3, **`docs/TECHNICAL_MANIFESTO.md`** §3.1–3.2).

---

## Review cadence

Re-read this file when:

- Adding a new **payment**, **payout**, or **FX** path.
- Touching **bookings**, **calendar**, or **commissions**.
- Introducing a new **data access** pattern.
- Changing **profiles**, **public `/u/[id]`**, **chat entry from profile**, or **PII exposed on listing/review APIs**.

---

*SSOT: this file only. Cursor entrypoint: `.cursorrules`.*
