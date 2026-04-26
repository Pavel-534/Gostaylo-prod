# Gostaylo — Architectural Passport

> **Version**: 9.6.0 | **Last Updated**: 2026-04-26 | **Status**: Production-Ready — **Stage 66.0 (Moderation + listing featured SSOT):** **`PATCH /api/admin/moderation`** — **`{ listingId, action }`**: **`approve`** (опционально **`title`**, **`description`**, **`metadata`**: мердж в **`listings.metadata`** + **`normalizePartnerListingMetadata`** по slug категории из join **`categories`** или fallback **`metadata.category_slug`**), **`reject`** (**`rejectReason`**), **`set_featured`** (**`isFeatured`**: boolean → **`listings.is_featured`**, не профиль пользователя). **`GET /api/admin/moderation`** — PENDING без черновиков (**`metadata.is_draft`**). UI **`/admin/moderation`**: «Править текст» → инлайн-редактирование заголовка/описания; одобрение отправляет правки в том же **`approve`**. **Stage 65.0 (Services marketplace — Smart Wizard):** вертикаль услуг в SSOT **`lib/config/category-form-schema.js`**: профили **`service_generic`** (база: **`languages`**, **`experience_years`**, **`certifications`**), **`chef`** (+ **`cuisine_types`**, **`min_persons`**), **`massage`** (+ **`massage_types`**, **`home_visit`**), расширенная **`nanny`** (+ **`age_groups`**, **`live_in_option`**, **`specialization`**). Тип поля **`languages_multi`** в **`components/partner/WizardSchemaFields.jsx`** (чипы RU/EN/TH/ZH как в поиске нянь). Реестр **`lib/config/category-behavior.js`** — **`CATEGORY_SLUG_BEHAVIOR_OVERRIDES`** для **`chef`/`chefs`/`massage`/`massages`** → **`listingServiceType: service`**. Нормализация услуг в **`normalizePartnerListingMetadata`**: без «жилья» и транспортных полей; **`housingLike`** исключает все **`inferListingServiceTypeFromRegistry === 'service'`**. **Stage 64.0 (Smart partner wizard — category form schema SSOT):** поля **`listings.metadata`** для шагов партнёрского визарда описаны в **`lib/config/category-form-schema.js`** (**`getWizardStep1TransportFields`**, **`getWizardSpecsSectionFields`**, **`getAllowedWizardMetadataKeys`**); рендер — **`WizardSchemaFields`**. Премиум для **вертолёта** и **яхты**: **`crew_included`**, **`catering_available`**, **`flight_rules`**. **`normalizePartnerListingMetadata`** чистит ключи вне allow-list (имя категории для legacy transport — третий аргумент); **`isPartnerListingHousingCategory`** — **`lib/partner/partner-listing-housing-category.js`**. **Stage 63.0 (SEO + category SSOT cleanup):** JSON-LD карточки листинга — **`lib/seo/listing-schema-org.js`**: **`resolveListingSchemaOrgShape(slug)`** → **`LodgingBusiness`** | **`Product`** + **`https://schema.org/{Vehicle|Motorcycle|Boat|TouristTrip}`** | **`Service`** (вертолёт: charter) + **`additionalProperty`** из **`listings.metadata`** (cc, год, flight_hours, aircraft_type, каюты). Вместо **`=== 'vehicles'`** — **`isTransportListingCategory`** (slug **`helicopter`/`helicopters`** включены) в **`BookingWidget`**, **`inquiry.service`**, **`manual-booking`**, **`calendar.service`**; эксклюзивный календарный режим транспорта — **`lib/listing-booking-ui.js`**. PDP: авто-чипы scalar metadata — **`lib/listing-public-metadata-specs.js`** + i18n **`listingInfo_meta_*`** в **`lib/translations/listings-public.js`**. **Stage 62.0 (Vertical activation + build repair):** первая не-жилая вертикаль **helicopter** — слой **`lib/translations/verticals/helicopters.js`** (`verticalHelicopters_*`) в merge **`translation-state.js`**; **`getUIText(key, lang, { listingCategorySlug })`** подменяет базовый ключ на **`verticalHelicopters_${key}`** при slug **`helicopter`/`helicopters`** (**`lib/translations/vertical-context.js`**). PDP: **`BookingWidget`** (`tx`), заголовок карты **`whereYoullBe`** на **`app/listings/[id]/page.js`**. Демо **`app/demo/price-breakdown`** без **`useCommission`** (статичная ставка). **Клиент PDP не импортирует** **`lib/services/pricing.service.js`**: синхронная математика вынесена в **`lib/listing/duration-discount-tiers.js`** + **`lib/listing/listing-price-sync.js`** (**`calculatePrice`** для **`useListingPricing`**); в **`pricing.service`** — **`PLATFORM_SPLIT_FEE_DEFAULTS`** из **`lib/config/platform-split-fee-defaults.js`**, **`resolveChatInvoiceRateMultiplier`** только через **`import()`** из **`currency.service`**, чтобы **`next build`** не тянул **`node:crypto`/`node:async_hooks`** в клиентский бандл. **Stage 61.0 (i18n slices + verticals scaffold):** UI-строки вынесены из монолита **`lib/translations/ui.js`** в слайсы **`lib/translations/slices/{partner-finances,partner-shell,order-flow,reviews-ui,profile-app}.js`**; в **`ui.js`** остаётся **`coreUi`** (каталог/футер: **`allCategories`**, **`listings`**, …). **`lib/translations/translation-state.js`** — **`mergeSlices(lang)`**: **`common`** → **`listings-public`** → **`listings-partner`** → **`verticals/base-vertical`** → финансы/шелл/заказы/отзывы/профиль → **`coreUi`** → **`errors`** → **`checkout`** → **`partner-calendar-modals`** → **`renter-reviews-flow`** (поздний spread перекрывает ранний). Заготовка вертикалей: **`lib/translations/verticals/base-vertical.js`**, **`verticals/helicopters.js`** (пустой шаблон). Проверка дубликатов ключей: **`node scripts/check-i18n-duplicates.mjs`**. **Stage 60.0 (Outbox reclaim + мониторинг):** перед выборкой партии воркер возвращает **`pending`** записи в **`processing`**, у которых **`updated_at` < now − 30 мин**; **`attempts`**, **`last_error`**, **`next_attempt_at`** не меняются. **`updated_at`** + триггер **`update_updated_at()`** — **`018_stage60_notification_outbox_reclaim.sql`**, индекс **`idx_notification_outbox_processing_updated`**. **`GET /api/admin/notification-outbox/stats`** (`lib/services/notifications/notification-outbox-stats.js`); счётчики на **`/admin/system`**. **Stage 59.0 (Notification outbox worker):** воркер **`runNotificationOutboxWorker`** (`lib/services/notifications/process-notification-outbox.js`) — до **20** строк **`pending`/`failed`**, **`attempts < 5`**, **`next_attempt_at`** null или ≤ now; claim **`processing`** → **`resolveNotificationHandler`** + **`wireNotificationHandlerDeps`** (как **`NotificationService.dispatch`**); успех → **`sent`** и **`attempts+1`**; ошибка → **`failed`**, **`last_error`**, backoff **`+5 мин × attempts`**; при **`attempts ≥ 5`** → **`permanent_failure`**, **`notifySystemAlert`** + **`recordCriticalSignal('NOTIFICATION_OUTBOX_PERMANENT_FAILURE')`**. Маршруты: **`POST/GET /api/v2/system/notifications/process-outbox`** и **`POST/GET /api/cron/notification-outbox`** — **`assertCronAuthorized`**; **`POST /api/admin/notification-outbox/process`** — только **ADMIN** (кнопка на **`/admin/system`**). Cron Vercel: **`vercel.json`** → **`/api/cron/notification-outbox`** каждые **5** мин. Миграция **`017_stage59_notification_outbox_worker.sql`**: **`next_attempt_at`**, статус **`permanent_failure`**. **Stage 58.0 (Tax API sync + admin control):** **`GET /api/v2/listings/[id]/availability`** при диапазоне дат отдаёт **`pricing.taxRatePercent`** и **`pricing.taxAmountThb`** (тот же **`PricingService.calculateBookingPrice`**, что PDP через **`useListingPricing.syncPricing`**). Админка **`/admin/settings`** — поле **Tax Rate (%)** → **`system_settings.general.taxRatePercent`** (0 = без строк налога в UI). **Stage 57.0 (Tax opt-in + outbox retries + PDP parity):** Налоги **деактивированы по умолчанию** (глобальная ставка **0** — нет отдельной строки налога в **`OrderPriceBreakdown`** / **`BookingWidget`**; PDP: **`useListingPricing`** + **`taxRatePercent`** из **`GET /api/v2/commission`** → **`PricingService.calculatePrice`**). Таблица **`notification_outbox`**: миграция **`016_stage57_notification_outbox_retry.sql`** — **`attempts`**, **`last_error`**. Ручная бронь партнёра — **`POST /api/v2/partner/calendar/manual-booking`** через **`PricingService.calculateFeeSplit`** + **`pricing_snapshot.fee_split_v2`**. **Stage 56.0 (Reliability + tax + async notification outbox):** Correlation ID — **`middleware`** (matcher **`/api/:path*`**), заголовок **`x-correlation-id`**, **`lib/request-correlation.js`**, структурированные логи **`logStructured`** / **`recordCriticalSignal`** (**`lib/critical-telemetry.js`**). Налоги — **`system_settings.general.taxRatePercent`**, **`PricingService.calculateFeeSplitWithPolicy`** → **`taxAmountThb`/`taxRatePercent`**, **`pricing_snapshot.tax`**, **`fee_split_v2.tax_*`**; UI чекаута/карточки заказа — строка НДС в **`OrderPriceBreakdown`**, итог гостя — **`getGuestPayableRoundedThb`**. Outbox — **`NOTIFICATION_OUTBOX=1`**, таблица **`notification_outbox`** (миграция **`015_stage56_notification_outbox.sql`**), в реестре уведомлений флаг **`isAsync`** для тяжёлых каналов. **Stage 55.0:** единый реестр уведомлений **`lib/services/notifications/notification-registry.js`** (**`NOTIFICATION_REGISTRY`**: ключ события → хендлер; **`NotificationEvents`** и **`resolveNotificationHandler`** производны от него — одна точка правки). Клиент партнёрских финансов: **`lib/api/partner-finances-client.js`** (fetch/ошибки); хук **`hooks/usePartnerFinances.js`** только состояние + TanStack. Сессия: удалён **`getUserIdFromRequest`**; **`verifyPartnerAccess`** без Supabase — **только** **`NODE_ENV === 'development'`**, иначе **`null`**. **Stage 54.0 (Arterial cleanup):** декомпозиция **`lib/services/notification.service.js`** в кластеры **`lib/services/notifications/{booking-events,payment-events,marketing-events}.js`** + **`notify-deps.js`** / **`notify-shared.js`** (хаб остаётся **`NotificationService.dispatch`** и каналы без смены импортов). Партнёрские финансы: **`hooks/usePartnerFinances.js`** + **`lib/api/partner-finances-client.js`**, UI — **`components/partner/finances/*`**, страница **`app/partner/finances/page.js`** — композиция. Поиск листингов: **`lib/api/run-listings-search-get.js`** — явный **`LISTINGS_SELECT`** (без `*`, без тяжёлых колонок вроде `embedding`). **Stage 53.0 (Registry-driven model closed + split-fee SSOT):** миграция на реестр **`lib/config/category-behavior.js`** завершена для thaw-bucket, карты, календаря партнёра и копирайта уведомлений (**`notification-category-terminology.js`** → **`getEscrowThawBucketFromRegistry`**; **`partner-calendar-filters.js`** / **`listing-location-privacy.js`** — хелперы реестра). Числовые фолбэки split-fee — единый файл **`lib/config/platform-split-fee-defaults.js`** (**`PLATFORM_SPLIT_FEE_DEFAULTS`**), реэкспорт в **`currency.service.js`**; хуки и серверные хелперы без литералов **5**/**0.5**. В **`PricingService`** / **`pricing_snapshot`** резерв явно отделён от комиссии хоста (комментарии + settlement **`insurance_reserve_amount`**). **Stage 52.0:** **`GET /api/v2/commission`** + сессия; PDP **`listing.commissionRate`**; FCM подмодули **`lib/services/push/*`**. **Stage 51.0:** Tron **`getGuestPayableRoundedThb`**. **Stage 50.2:** **`lib/http-client-identity.js`**. **Stage 50.1:** brand SSOT.
> 
> Архитектура, маршруты, схемы и стандарты. **Порядок для агентов:** сначала **`ARCHITECTURAL_DECISIONS.md`** (SSOT), затем **`docs/TECHNICAL_MANIFESTO.md`** (code-truth), затем этот паспорт. Синхронизация с кодом — **`AGENTS.md`** и **`.cursor/rules/gostaylo-docs-constitution.mdc`**.

---

## 0. Critical Routes & Services

### 0.0b Booking service layout (Stage 2.1 modular split)
- **Публичная точка входа (без изменений для API):** `lib/services/booking.service.js` — класс **`BookingService`**, реэкспорт **`resolveListingCategorySlug`**, **`ensureBookingConversation`**.
- **`lib/services/booking/query.service.js`**: **`getBookings`**, **`getBookingById`**, **`mapBookingListingsJoin`**, **`attachConversationIdsToBookings`**, **`resolveListingCategorySlug`**.
- **`lib/services/booking/pricing.service.js`**: settlement в **`pricing_snapshot`** — **`attachSettlementSnapshotForBooking`**, хелперы снимка (не путать с **`lib/services/pricing.service.js`** — канон цен/FX).
- **`lib/services/booking/inquiry.service.js`**: чат (**`ensureBookingConversation`**), inquiry-тред и **`createInquiryBooking`**, **`checkAvailability`**, **`verifyInventoryBeforePartnerConfirm`**.
- **`lib/services/booking/creation.js`**: стандартный **`createBooking`** (PENDING, календарь, чат).
- **Статусы / чат:** **`BookingService.updateStatus`** остаётся в оркестраторе; после UPDATE по-прежнему вызывается **`syncBookingStatusToConversationChat`**.

### 0.0c Notification service layout (Stage 2.2 modular split + Stage 54.0 clusters + Stage 55.0 registry)
- **Публичная точка входа (без смены импортов):** `lib/services/notification.service.js` — тонкий хаб: **`NotificationService.dispatch`** (резолв хендлера через **`resolveNotificationHandler`** из реестра), каналы (**`sendEmail`**, **`sendTelegram`**, **`sendToAdminTopic`**, …), **`runDailyDraftDigestReminders`**. **`NotificationEvents`** реэкспортируется из хаба и совпадает с ключами **`NOTIFICATION_REGISTRY`** в **`lib/services/notifications/notification-registry.js`** (добавление события — одна строка в реестре).
- **Кластеры обработчиков (Stage 54.0):** `lib/services/notifications/booking-events.js`, `payment-events.js`, `marketing-events.js` — бизнес-логика уведомлений; зависимости каналов пробрасываются через **`notify-deps.js`** (`setNotificationHandlerDeps` / `getNotifyDeps`), общие хелперы — **`notify-shared.js`** (**`safeNotifyChannel`**, ночи, ссылки в чат, язык писем и т.д.).
- Ранее: **`safeNotifyChannel`** изолирует сбой одного канала (email / Telegram / топик) от остальных (например, **`NEW_BOOKING_REQUEST`**).
- **`lib/services/notifications/telegram.service.js`:** Bot API (`sendMessage`), топики (`TELEGRAM_TOPIC_IDS`), DM, **`sendTelegramBookingRequest`** (inline + URL **`/partner/bookings?booking={id}`**).
- **`lib/services/notifications/email.service.js`:** Resend для простых писем/фолбэков (`sendResendEmail`, text→HTML). Брендированные React-шаблоны остаются в **`lib/services/email.service.js`** (**`EmailService`**).
- **`lib/services/notifications/push.service.js`:** реэкспорт **`PushService`** из **`lib/services/push.service.js`** (единая точка импорта из слоя уведомлений). **Stage 51.0–52.0:** шаблоны — **`lib/services/push/notification-templates.js`**, OAuth/JWT — **`lib/services/push/firebase-oauth.js`**, HTTP v1 в FCM — **`lib/services/push/fcm-http-delivery.js`**, тихие часы / задержка веб-поверхности — **`lib/services/push/push-quiet-policy.js`**, интерполяция — **`lib/services/push/push-interpolate.js`**. Check-in push по-прежнему инициируется кроном **`/api/cron/checkin-reminder`** до **`NotificationService.dispatch('CHECKIN_REMINDER', …)`**.
- **`lib/services/notifications/formatting.js`:** общие сниппеты для TG/HTML уведомлений (сумма, special_requests, escape).

### 0.0d Email + Escrow layout (Stage 2.3)
- **Канон ссылок «к брони» в списках (гость):** `lib/email/booking-routes.js` — **`renterBookingsListPath(id)`** → **`/renter/bookings?booking=…`**. Активные premium-шаблоны в **`lib/services/email.service.js`**: `bookingRequested`, `newLeadAlert` (для партнёра — **`partnerBookingsListPath`**), `paymentSuccessGuest` (как и ранее, **`bookingsUrl`** строится в хабе уведомлений). Мёртвый шаблон/метод **`sendBookingStatusChange` / `bookingStatusChange`** удалён (не использовался).
- **`lib/services/escrow.service.js`:** оркестратор: **`moveToEscrow`**, баланс (**`getPartnerBalance`**, **`getPartnerBalanceByCategory`**, **`syncPartnerBalanceColumns`**, cron **`processDueEscrowThaws`**, политика/комиссия), реэкспорт **`BookingStatus`**, **`PayoutStatus`**.
- **`lib/services/escrow/thaw.service.js`:** `PAID_ESCROW` → **`THAWED`**, превью/бэкфилл `escrow_thaw_at`, **`notifyUpcomingThaw`**, **`thawBookingToThawed`** (уведомление о средствах сразу; отзыв о клиенте — крон **47.2**).
- **`lib/services/escrow/payout.service.js`:** авто-выплаты по крон-правилам, ручной **`requestPayout`**, **`processPayout`** / **`processAllPayoutsForToday`**.
- **`lib/services/escrow/commission.js`**, **`utils.js`**, **`balance.service.js`**, **`ledger-capture.js`:** комиссия/settlement, утилиты, баланс партнёра, **отложенная** запись в ledger после перехода в эскроу (не блокирует успех оплаты).
- **Tron verify API:** `POST /api/v2/payments/verify-tron` при **`bookingId` + успешной верификации** вызывает **`PaymentsV3Service.confirmPayment`** (а не «тихий» UPDATE `payments`), чтобы сработали **эскроу + фоновый ledger**, как у админского confirm.

### 0.0d-cat Listing categories — universal rental (SSOT map, Stage 47.3)

Документирует **существующую** логику; новые фичи по брони/эскрою/копирайту должны опираться на эти точки, а не на параллельные списки slug’ов.

- **Канон в БД:** таблица **`categories`**, поле **`slug`**, связь **`listings.category_id`**. Нормативно: **`ARCHITECTURAL_DECISIONS.md`** §**10**.
- **Резолв id → slug (сервер):** **`resolveListingCategorySlug`** — **`lib/services/booking/query.service.js`**. Использовать для правил, завязанных на категорию, когда есть только **`category_id`**.
- **Снимок на брони:** **`bookings.metadata.listing_category_slug`** пишется при **`EscrowService.moveToEscrow`** вместе с **`escrow_thaw_at`** (**`computeEscrowThawAt`**). Читать в thaw, уведомлениях и отчётах, когда нужен стабильный slug без джойна.
- **Хелперы slug без БД:** **`lib/listing-category-slug.js`** — нормализация поиска (**`normalizeListingCategorySlugForSearch`**: `transport`/`vehicle` → **`vehicles`**), **`isTransportListingCategory`**, **`isTourListingCategory`**, **`isYachtLikeCategory`**, **`showsPropertyInteriorSpecs`**.
- **Реестр поведения категории (Stage 52.0):** **`lib/config/category-behavior.js`** — **`resolveCategoryBehavior`**, **`CATEGORY_SLUG_BEHAVIOR_OVERRIDES`**; агрегирует правила thaw-bucket, тип услуги визарда, режим маркера карты. Новая категория: по возможности одна запись/оверрайд здесь + при необходимости хелперы **`lib/listing-category-slug.js`**.
- **Время разморозки эскроу (финансовое «ведро»):** **`lib/escrow-thaw-rules.js`** — **`getEscrowThawBucketFromCategorySlug`** (читает реестр) → **`housing` \| `transport` \| `service`**, затем **`computeEscrowThawAt`**. Туры (**`tours`**, подстрока **`tour`**) попадают в ведро **`service`** (+2 ч от старта), **не** в отдельный thaw-тип.
- **Тип услуги для визарда / отзывов (четыре логических типа):** **`lib/partner/listing-service-type.js`** — **`inferListingServiceTypeFromCategorySlug`** (реестр): **`stay` \| `transport` \| `service` \| `tour`**. Для туров здесь **`tour`** отделён от **`service`** (дефолты metadata, UX). **Не смешивать** с ведром thaw без явного ADR: для денег по-прежнему **`escrow-thaw-rules`** / реестр.
- **Копирайт уведомлений по ведру thaw:** **`lib/notification-category-terminology.js`** — те же **buckets**, что **`getEscrowThawBucketFromCategorySlug`** (через реестр).
- **Карта / приватность координат:** **`lib/listing-location-privacy.js`** — для **`categorySlug`** режим из реестра; legacy по **`categoryId`** без изменений.
- **Чипы мастер-календаря партнёра:** **`lib/partner-calendar-filters.js`** — явные **`Set`** slug’ов (**`property`**, **`vehicles`**, **`tours`/`yachts`**); новая категория не попадёт в фильтр, пока не расширят набор.
- **Подписи критериев отзыва:** **`lib/config/review-criteria-labels.js`** — через **`inferListingServiceTypeFromCategorySlug`**.
- **Поиск и транспортный интервал:** **`lib/hooks/useListingsSearch.js`**, **`lib/api/run-listings-search-get.js`**, **`lib/search/search-filter-panel-kind.js`** — режим **`vehicles`**, batch availability и т.д. (см. также манифесто §PR-#2/#3).
- **Чеклист при новой строке в `categories`:** (0) **`lib/config/category-behavior.js`** (`CATEGORY_SLUG_BEHAVIOR_OVERRIDES` / хелперы **`listing-category-slug.js`**); (1) thaw — **`getEscrowThawBucketFromCategorySlug`** / **`computeEscrowThawAt`**; (2) **`inferListingServiceTypeFromCategorySlug`** и **`defaultMetadataForListingServiceType`**; (3) legacy **`listing-location-privacy`** по **`categoryId`** при необходимости; (4) **`partner-calendar-filters.js`**; (5) копирайт в **`notification-category-terminology`** / **`review-criteria-labels`**; (6) поиск/календарь для интервальных категорий.

### Category SSOT & Business Logic Mapping (Stage 49.0)

Сводная карта: **один канонический `categories.slug`**, две производные модели (**3 thaw-buckets для денег** vs **4 UI-типа**). Нормативно дублирует и расширяет **`ARCHITECTURAL_DECISIONS.md`** §**10** и §**0.0d-cat** выше.

| Слой | Кардинальность | Правило | Файлы-источники (SSOT) |
|------|------------------|---------|-------------------------|
| **Split-fee фолбэки (числа)** | один объект | **`PLATFORM_SPLIT_FEE_DEFAULTS`** | **`lib/config/platform-split-fee-defaults.js`** (реэкспорт **`currency.service.js`**) |
| **Канон в БД** | 1 slug на листинг | **`listings.category_id` → `categories.slug`** | SQL / Prisma; **`resolveListingCategorySlug`** — **`lib/services/booking/query.service.js`** |
| **Снимок на брони** | фиксируется при эскроу | **`bookings.metadata.listing_category_slug`** + **`escrow_thaw_at`** при **`EscrowService.moveToEscrow`** | **`lib/services/escrow.service.js`**, расчёт thaw — ниже |
| **Реестр категории (52.0)** | одна строка slug | **`resolveCategoryBehavior`** + overrides | **`lib/config/category-behavior.js`** |
| **Escrow thaw (время разморозки)** | **3 ведра** | **`getEscrowThawBucketFromCategorySlug`** → **`housing` \| `transport` \| `service`**, затем **`computeEscrowThawAt`**. Подстрока **`tour`** в slug → ведро **`service`** (не отдельный thaw-тип). | **`lib/escrow-thaw-rules.js`** (bucket из реестра) |
| **Копирайт уведомлений по ведру** | те же 3 ведра | Согласован с **`getEscrowThawBucketFromCategorySlug`** | **`lib/notification-category-terminology.js`** |
| **UI / визард / отзывы** | **4 типа** | **`inferListingServiceTypeFromCategorySlug`** → **`stay` \| `transport` \| `service` \| `tour`** | **`lib/partner/listing-service-type.js`**, **`defaultMetadataForListingServiceType`** (тип из реестра) |
| **Партнёр: список доходов** | **4 бейджа** (в т.ч. **Тур**) | Те же 4 типа, что визард; **деньги/thaw для тура остаются в ведре `service`** — партнёр видит разницу только в UI. | **`app/partner/finances/page.js`** + **`components/partner/finances/PartnerBookingIncomeKindBadge.jsx`**, строки **`lib/translations/ui.js`** |
| **Финансовый read-model** | поле **`category_slug`** в **`financial_snapshot`** | **`categorySlugFromBookingFinancialRow`**: metadata snapshot → join **`listing.categories.slug`** | **`lib/services/booking-financial-read-model.service.js`**, выборки partner bookings / summary / PDF |
| **Имя платформы (white-label)** | одна строка | **`getSiteDisplayName()`**: **`NEXT_PUBLIC_SITE_NAME`** / **`SITE_DISPLAY_NAME`** (trim), иначе **`Platform`** (без hostname из **`getPublicSiteUrl`**). | **`lib/site-url.js`**; PDF — **`partner-finances-pdf.service.js`**; **`premium-email-html.js`** (шапка/футер/alt карточки); **`email.service.js`** (welcome, bookingRequested, partnerApproved, имя **`.ics`**); **`booking-email-i18n.js`** (**`{brand}`**); **`calendar-links.js`**; **`stay-ics.js`** (**`PRODID`**, host **`UID`**); пуши — **`{siteName}`** в **`sendPush`** + fallback **`sender`** чата; **`partnerFundsThawed`** |
| **Кроны** | все **`/api/cron/*`** | **`assertCronAuthorized`**: trim **`CRON_SECRET`**, **`Authorization: Bearer …`** или **`x-cron-secret`**, **503** если секрет не задан, **401** если неверный | **`lib/cron/verify-cron-secret.js`**, каждый **`app/api/cron/*/route.js`** |

**Готовность финансового модуля к любым категориям:** суммы **`gross` / `fee` / `net`** и **`category_slug`** приходят с сервера в **`financial_snapshot`**; партнёрский UI (**`/partner/finances`**, CSV, PDF, drill-down) не пересчитывает комиссии локально. **Stage 50.0 — финальный цикл отчётности:** CSV на **`/partner/finances`** включает колонку **`category_slug`** (заголовок i18n **`partnerFinances_csvCategory`**) для фильтра в Excel; PDF-выписка без лишнего вертикального зазора под заголовком. **Календарный цикл писем:** ссылки Google/Outlook, описание **`.ics`** и транзакционные тексты брони используют то же имя сайта, что шапка письма. Новая строка в **`categories`** по-прежнему требует чеклиста §**0.0d-cat** (thaw-bucket, UI-тип, privacy, календарь, копирайт).

### 0.0e Checkout page hooks (Stage 2.4 + 7.1 components)
- **UI:** `app/checkout/[bookingId]/page.js` — **тонкий shell** (хуки, ветвления по состоянию, `Suspense`); вся разметка в **`app/checkout/[bookingId]/components/`** — **`CheckoutSummary`**, **`PaymentMethods`** (включая крипто-диалог), **`CheckoutStateViews`**. Логика по-прежнему в хуках, без дублирования бизнес-правил.
- **`hooks/useCheckoutPayment.js`:** загрузка брони/инвойса, `GET` payment-intent, `allowedMethods`, проверка доступа, `language`, **`chatConversationId`**: сначала **`b.conversation_id`** из ответа **`GET /api/v2/bookings/[id]`** (см. **`getBookingById` + `attachConversationIdsToBookings`**), иначе fallback на **`GET /api/v2/chat/conversations`**. Initiate, **`POST .../payment/confirm`**, крипта: `POST /api/v2/payments/verify-tron` с **`{ txid, bookingId }`**, обработка **`paymentSettled`** (toast, **`loadPaymentStatus`**, success UI). Ошибки оплаты/верификации — через **toast** (не молчать).
- **`hooks/useCheckoutPricing.js`:** курсы, комиссия (**`useCommission`**), промокод, итоги, формат цены, локаль дат; делит с платежным хуком только то, что нужно отображению.
- **Stage 29.0 — SSOT детализации цены:** строки чекаута (без invoice-path) строятся через **`buildGuestPriceBreakdownFromCheckoutTotals`** (`lib/booking/guest-price-breakdown.js`) и рендерятся тем же **`OrderPriceBreakdown`**, что и карточка заказа после создания брони (одна визуальная/числовая модель: тариф после скидки, сервисный сбор, округление, резерв страховки из **`pricing_snapshot`**, итог). Клиентский **`useCheckoutPayment`** прокидывает **`pricing_snapshot`** с **`GET /api/v2/bookings/[id]`** для страховой строки.
- **Stage 29.0 — бейджи доверия (рентер):** публичный DTO **`trustPublicFromSnapshot`** дополняется **`completionCleanPercent`** (доля «чистых» завершений среди завершённых в снимке репутации). UI-чипы: **`getRenterTrustBadgeKinds`** + **`PartnerRenterTrustBadges`** — **«Молниеносный ответ»** при среднем первом ответе **&lt;15 мин** за 30d и **≥`REPUTATION_SLA_MIN_SAMPLES_SCORE`** сэмплов; **«Сверхнадежный»** при **&gt;98%** чистых завершений и **≥3** завершённых кейсов (**`cleanStays` / `completedStays`**). Карточка поиска (**`GostayloListingCard`**), блок хоста на **`/listings/[id]`**, **`UnifiedOrderCard`** (после **`GET /api/v2/bookings`** с **`partner_trust`** на элемент).
- **Stage 29.0 — pickup alpha:** при создании брони (**`creation.js`**, **`createInquiryBooking`**) в **`bookings.metadata`** копируется строка **`check_in_instructions`** из **`listings.metadata`**, если задана; **`UnifiedOrderCard`** показывает блок с иконкой по **`inferListingServiceTypeFromCategorySlug`** (ключ vs авто для transport).
- **Stage 30.0 — промо в финансовом SSOT:** **`buildGuestPriceBreakdownFromBooking`** читает **`pricing_snapshot.duration_discount`** и **`pricing_snapshot.promo`** + **`promo_code_used`** / **`discount_amount`**; **`OrderPriceBreakdown`** показывает строку промо с кодом (**`orderPrice_promoDiscountWithCode`**) и подсказки **«Не включено»** через **`buildGuestPriceExclusionHints`** (transport + **`metadata.fuel_policy !== full_to_full`** → топливо; stay + **`cleaning_fee_*` / `security_deposit_*`** в metadata). **`POST /api/v2/promo-codes/validate`** принимает **`amount`** или **`bookingAmount`** (checkout).
- **Stage 30.0 — партнёрский UI:** визард шаг 1 (**`StepGeneralInfo.jsx`**) — **`check_in_instructions`** (textarea, плейсхолдеры по **`listingServiceType`**); транспорт — **`WizardSchemaFields`** + **`getWizardStep1TransportFields`** (в т.ч. **`fuel_policy`** `full_to_full` \| `other`). Snapshot брони по-прежнему только при insert.
- **Stage 31.0 — промо-владелец + usage + визуальный check-in:** таблица **`promo_codes`**: **`created_by_type`** (`PLATFORM` \| `PARTNER`), опциональный **`partner_id`**. **`PricingService.validatePromoCode(code, amount, { listingOwnerId })`**: для **`PARTNER`** код валиден только если **`partner_id === listing.owner_id`**; для **`PLATFORM`** — без привязки к листингу. **`POST /api/v2/promo-codes/validate`** принимает **`listingId`** (сервер резолвит **`owner_id`**). После перехода в **`PAID_ESCROW`** (**`EscrowService.moveToEscrow`**) — **`recordPromoUsageAfterEscrowPaid`**: атомарный инкремент **`current_uses`**, идемпотентность **`bookings.metadata.promo_usage_counted_at`**. Визард шаг 1: до **3** фото в **`listings.metadata.check_in_photos`** → при insert брони копируются в **`bookings.metadata.check_in_photos`** (**`pickCheckInInstructionsForBookingMetadata`**); **`UnifiedOrderCard`** (рентер) показывает сетку ссылок. Чекаут: **`useCheckoutPayment`** кладёт в объект брони **`listings`** с **`category_slug`** и **`metadata`**, чтобы **`OrderPriceBreakdown`** всегда мог построить **«Не включено»** до/после любых доп. полей.
- **Stage 32.0 — маркетинг + партнёрские промо + откат usage:** **`POST /api/v2/partner/promo-codes`** — только **`PARTNER`**, **`partner_id`** из сессии; тело как в админке; опционально **`listingIds[]`** — **`verifyListingIdsOwnedByPartner`** (владение листингами). UI партнёра: **`/partner/promo`**, пункт меню и быстрый линк с дашборда. Админ **`/admin/marketing`**: блок **Critical Promo Alerts** для **`PLATFORM`** при **`current_uses / max_uses ≥ 0.9`** (конечный **`max_uses`**), подсветка + **`PATCH /api/admin/promo-codes/[id]`** с **`{ action: 'extend_uses', add: 100 }`** (только PLATFORM). Справедливость SSOT: при полном возврате гостю до ухода из эскроу — **`revertPromoUsageAfterFullRefundCancel`** (`lib/promo/revert-promo-usage-on-cancel.js`) уменьшает **`current_uses`**, если usage был засчитан в **`PAID_ESCROW`** (см. вызов из **`POST /api/v2/bookings/[id]/cancel`**). Кабинет: **`ReputationService.getPartnerReputationHealth`** включает **`instructionPhotos`** (**`fetchPartnerInstructionPhotoStats`**); **`PartnerHealthWidget`** — мягкий nudge при **`listingsBelow3 > 0`**.
- **Stage 33.0 — scoped promo + каталог + lightbox:** колонка **`promo_codes.allowed_listing_ids`** (**`uuid[]`**, NULL/пусто = без allowlist). **`PricingService.validatePromoCode(..., { listingOwnerId, listingId })`**: при непустом массиве **`listingId`** обязателен и должен входить в список (PARTNER по-прежнему требует **`partner_id === owner_id`**). Запись: **`buildPromoInsertFromAdminBody`** (**`allowedListingIds`**), **`buildPartnerPromoInsert`** (**`listingIds`** → **`allowed_listing_ids`**). Поиск: **`lib/api/run-listings-search-get.js`** обогащает карточку полем **`catalog_promo_badge`** (**`lib/promo/catalog-promo-badges.js`**: активные промо + **`metadata.discounts`** / ночи из **`checkIn`/`checkOut`**); **`GostayloListingCard`** + **`CardImageCarousel`** — бейдж **SALE** / **-X%**. Админ: **`GET /api/admin/promo-codes/analytics/top-partners`**, таблица на **`/admin/marketing`**. **`UnifiedOrderCard`**: полноэкранный просмотр **`check_in_photos`** (портал + клавиатура).
- **Stage 34.0 — Flash Sale + FOMO UI:** колонка **`promo_codes.is_flash_sale`** (boolean). **Единый дедлайн акции** — по-прежнему **`valid_until`** (отдельного `expires_at` нет). **`PricingService.validatePromoCode`**: для flash-промо в успешном ответе **`flashSale`**, **`promoEndsAt`** (ISO), **`secondsRemaining`** до **`valid_until`**. Каталог и **`GET /api/v2/listings/[id]`**: **`catalog_flash_urgency: { ends_at }`** из **`computeCatalogFlashUrgencyForListing`** (ранний дедлайн среди применимых flash-промо к листингу). UI: **`components/UrgencyTimer.jsx`** на **`GostayloListingCard`** и **`/listings/[id]`**; чекаут — блок с копирайтом «15 минут» + таймер (**`PaymentMethods`**, ответ validate). Партнёр: **`/partner/promo`** — чекбокс Flash Sale + пресеты **3 / 6 / 12 / 24 ч** → **`buildPartnerPromoInsert`** выставляет **`validUntilIso`**. Админ **`/admin/marketing`**: фильтр **Flash Sales** (активные flash с **`valid_until` > now**). Миграция: **`006_stage34_promo_flash_sale.sql`**.
- **Stage 35.0 — SSOT alignment + marketing transparency:** **`PricingService.calculateDailyPrice`** закреплён как единый источник расчёта цены дня для бронирования и партнёрского Master Calendar. В **`GET /api/v2/partner/calendar`** удалён локальный seasonal-calculator; цена дня считается через **`PricingService`** (общий приоритет DB `seasonal_prices` → `metadata.seasonal_pricing` с поддержкой `priceDaily`/`price_daily` и `priceMultiplier`). В **`CalendarService`** дневная цена также делегируется в **`PricingService`**, чтобы fallback-правила совпадали 1:1 во всех слоях. UI календаря партнёра (**`CalendarGrid`**) получил отдельный маркетинговый слой без изменения базовой цены ячейки: индикатор активного промо по дню + tooltip формулы **`[цена сезона] - [скидка промо] = [итог для гостя]`**. Маркетинг-админка: create modal поддерживает Flash Sale (`isFlashSale` + пресеты 3/6/12/24h → `validUntilIso`). KPI по промо-кодам разделён на воронку: **`bookingsCreatedCount`** (создано броней) и **`usedCount`** (оплачено/завершено).
- **Stage 36.0 — Marketing Reach & Automation:** введён единый движок применимости промо **`lib/promo/promo-engine.js`** (`isCodeApplicable`, `promoIsActiveAt`, `calculatePromoDiscountAmount`) и подключён в **`PricingService`**, **`CalendarService`**, **`catalog-promo-badges`** и partner calendar API. Это убирает дрейф правил между checkout/search/calendar. Для alpha-автоматизации добавлен `MarketingNotificationsService`: триггер логирует создание partner Flash Sale; крон **`/api/cron/flash-sale-reminder`** (в `vercel.json` каждые 15 минут) готовит уведомление партнёру за 1 час до дедлайна с KPI **`N`** созданных броней по `promo_code_used`. В админке `app/admin/marketing/page.js` добавлен блок **Global Campaign Landing** + API **`GET/POST /api/admin/marketing/campaigns`** (хранение в `system_settings.key=marketing_campaigns`, объединение нескольких PLATFORM-кодов под одной кампанией). Мобильный календарь (`CalendarMobileAgenda`) получил маркетинговый индикатор и формулу promo-impact в строке дня, чтобы визуализация совпадала с desktop.
- **Stage 37.0 — Telegram delivery + reminder dedup:** `MarketingNotificationsService` подключён к реальному Telegram-боту через существующий adapter (`sendTelegramMessagePayload`) и отправляет партнёру reminder Flash Sale с inline-кнопкой быстрого действия. Кнопка ведёт в интерфейс партнёра (`/partner/promo?flashCode=...&extendHours=6`), где доступно one-click продление через **`POST /api/v2/partner/promo-codes/[code]/extend-flash-sale`**. Крон **`/api/cron/flash-sale-reminder`** остаётся защищён `CRON_SECRET` (`x-cron-secret` или `Authorization: Bearer ...`) и возвращает telemetry (`notified`, `deduped`, `candidates`).
- **Stage 38.0 — Idempotent reminder lock + social proof + `/promo` + request memo:** дедуп Flash reminder переведён на **атомарный** слой: ключ вида **`flash_1h_reminder_[YYYY-MM-DD-HH]`** (календарный час **Asia/Bangkok**) записывается в **`promo_codes.metadata.reminder_locks`** через RPC **`promo_try_acquire_reminder_lock`** (миграция **`008_stage38_promo_reminder_lock_rpc.sql`**); параллельные HTTP-вызовы кронов не создают дублей. **`last_reminder_sent_at`** по-прежнему обновляется после успешной отправки (аудит). **Social proof (данные):** поиск и **`GET /api/v2/listings/[id]`** обогащают карточку **`catalog_flash_social_proof: { bookingsCreatedCount }`** (Bangkok «сегодня») в связке с **`catalog_flash_urgency`**. **Telegram:** **`/promo`** — список активных Flash + KPI. **Performance:** горячие циклы используют **`checkApplicabilityCached`** (in-memory TTL в `promo-engine`, без `react.cache` — модуль тянется в клиент через **`PricingService`**). См. **Stage 39.0** для динамического UI и аудита продлений.
- **Stage 39.0 — «Горячий» Flash UI + аналитика продлений + coach в `/promo`:** канон фаз плашки — **`lib/listing/flash-hot-strip.js`** (`resolveFlashHotStripState`, порог **6 ч** до **`catalog_flash_urgency.ends_at`**): **>6 ч** и **`bookingsCreatedCount > 0`** → текст «сегодня забронировали» + пастельный оранжевый блок; **≤6 ч** → «истекает через ЧЧ:ММ» (без дубля **`UrgencyTimer`** в этой фазе). Компонент **`components/listing/ListingFlashHotStrip.jsx`** на **`GostayloListingCard`** и **`/listings/[id]`**; i18n **`listingFlashHot_*`**. **`POST .../extend-flash-sale`** после успеха пишет **`audit_logs`** (`action: PARTNER_FLASH_SALE_EXTENDED`, payload с **`promo_id`**, **`partner_id`**, **`extension_source`**: `telegram_deeplink` из тела запроса при продлении с лендинга **`/partner/promo?flashCode=...`**). **`/promo`**: подсказки при **max(bookings) > 3** и при **все нули**. **`CalendarMobileAgenda`**: блок **FLASH**/формула не перекрывает цену (колонка **`flex-col`**, чип, перенос строк).
- **Stage 40.0 — маркетинговый SSOT + hardening (финал блока):** дефолтные строки Flash social proof — **`lib/constants/marketing.js`** (`flashHotBookingsToday`, `flashHotExpiresIn` по языкам); переопределения без деплоя — **`system_settings.key = marketing_ui_strings`**, `value` = `{ ru: { … }, en: { … } }` (мердж в **`lib/marketing/marketing-ui-strings.js`** → **`resolveMarketingUiStrings`**). Публичный **`GET /api/v2/marketing/ui-strings?lang=`**; UI **`ListingFlashHotStrip`** подгружает merged copy, fallback на **`listingFlashHot_*`** в переводах. **Rate limit:** **`POST /api/v2/promo-codes/validate`** — **`promo_validate`** (по IP); **`POST /api/v2/partner/promo-codes/[code]/extend-flash-sale`** — **`promo_extend`** (сессия + **`userId`** в ключе лимита, см. **`lib/rate-limit.js`**). **Гость + Flash:** при **`createBooking`** с валидным flash-промо — в **`pricing_snapshot.promo`** пишется **`is_flash_sale: true`**; если у рентера **`profiles.telegram_id`** — **`MarketingNotificationsService.notifyGuestFlashSaleBookingCongrats`** (DM). Тот же флаг в snapshot для **`createInquiryBooking`** (без TG на inquiry — только SSOT данных). Подробности операций — **`docs/MARKETING_HANDBOOK.md`**.
- **Stage 41.0 — админ-пульт + i18n гостя + календарь:** **`/admin/marketing`** — секция **UI Copywriting** → **`GET/PUT /api/admin/marketing/ui-strings`**; валидация плейсхолдеров **`{{count}}` / `{{hm}}`** — **`lib/marketing/validate-marketing-ui-strings.js`**. Поздравление гостя в TG: **`lib/translations/marketing-guest-notifications.js`**, язык **`preferred_language` → `language` → en**; миграция **`009_stage41_profile_preferred_language.sql`**. Партнёрский **`CalendarGrid`**: точка + inset-shadow для дней с активным Flash по **`promo-engine`** (данные из **`GET /api/v2/partner/calendar`**).
- **Stage 42.1 — Locale SSOT + надёжность поиска:** единый модуль **`lib/i18n/locale-resolver.js`**: список языков **`SUPPORTED_UI_LANGUAGES`**, **`resolveUserLocale(profile)`** (приоритет **`profiles.preferred_language`**, затем **`language`**), **`telegramMenuButtonLocale`** / **`resolveUiLocaleFromTelegramClientCode`** для бота. Веб: **`supportedLanguages`** в **`lib/translations/index.js`** реэкспорт из resolver; **`UniversalHeader`** импортирует тот же список. **`I18nProvider`**: после **`detectLanguage`** при активной сессии подмешивает **`GET /api/v2/auth/me`** → **`preferred_language`** в cookie/state; при **`setLanguage`** — debounced **`PATCH /api/v2/profile/me`** с **`{ preferred_language }`** (и **`PATCH /api/v2/auth/me`** принимает то же поле). Telegram: **`resolveTelegramLanguageForChat`** читает обе колонки; тексты диалогов **zh/th** пока из **en**-пакета; inline-меню — подписи **zh/th** как **en** до полной локализации (**`telegramMenuButtonLocale`**). Маркетинг: **`MarketingNotificationsService`** использует **`resolveUserLocale`**. Крон SLA: **`lib/services/partner-sla-telegram-nudge.js`** — текст по локали партнёра, **`notifySystemAlert`** при падении выборки **`conversations`** / отсутствии таблицы дедупа. Поиск: **`lib/api/run-listings-search-get.js`** — при ошибке **`CalendarService.checkAvailability`** листинг **исключаётся** из выдачи (**`continue`** + **`console.error`**), мета **`filteredOutByAvailabilityErrors`**; шумные **`console.log`** убраны.
- **Stage 42.2 — Batch Availability + API hygiene:** добавлена миграция **`prisma/migrations/010_stage42_batch_availability_check.sql`** с RPC **`public.batch_check_listing_availability(...)`** (один вызов для массива `listing_ids`, возвращает `available`, `conflicts_count`, `min_remaining_spots`, `nights`, `total_price`, `average_per_night`). **`CalendarService.checkBatchAvailability`** оборачивает RPC и отдаёт `Map` по `listingId`; **`run-listings-search-get.js`** заменил N+1 цикл `checkAvailability` на batch-проверку (датовый фильтр по 50+ листингам выполняется одним roundtrip к БД). SSOT валидации профиля: **`lib/validation/profile-schema.js`** (`normalizePreferredLanguageInput`, `buildCommonProfileUpdates`) используется в **`PATCH /api/v2/auth/me`** и **`PATCH /api/v2/profile/me`**. `I18nProvider` вводит `authStatus` и не шлёт PATCH локали после подтверждённого `401` (без лишнего сетевого шума для гостя).
- **Stage 42.3 — Pricing precision for batch search:** RPC **`batch_check_listing_availability`** расширен сезонной сеткой **`price_grid`** (DB **`seasonal_prices`** первым, затем fallback **`listings.metadata.seasonal_pricing`**) и полем **`is_promo_applied`** для контракта. Чтобы не создавать второй финансовый калькулятор в SQL, точный итог поиска считается в **`CalendarService.checkBatchAvailability`** через существующий SSOT: **`PricingService.calculateBookingPriceSync`** (сезонность + duration discount), **`promo-engine`** (лучший catalog/Flash promo), **`PricingService.getFeePolicyBatch`** + **`calculateFeeSplitWithPolicy`** (guest service fee / partner custom commission) и **`computeRoundedGuestTotalPot`**. В выдаче поиска **`pricing.totalPrice`** теперь означает guest-payable rounded total за выбранный диапазон; дополнительно отдаются **`subtotalBeforePromoThb`**, **`subtotalThb`**, **`guestServiceFeeThb`**, **`promoCode`**, **`promoDiscountAmountThb`**, **`promoFlashSale`**, **`is_promo_applied`**. **`run-listings-search-get.js`** прокидывает top-level **`is_promo_applied`** в карточку; Flash/listing cards получают цену уже с промо и сборами при датовом поиске.
- **Stage 43.0 — Search SQL-first filters + instant-booking SSOT:** миграция **`prisma/migrations/011_stage43_search_sql_filters.sql`** добавляет `listings.instant_booking` и GIN индекс **`idx_listings_metadata_amenities_gin`** по `metadata->'amenities'`. В **`run-listings-search-get.js`** фильтры `amenities`, `bedrooms`, `bathrooms`, `instant_booking` перенесены в SQL (без JS-дублирования), координаты в поиске нормализованы только по колонкам `latitude/longitude`, а контракт карточки включает `instantBooking`. SSOT словарь удобств — **`lib/constants/amenities-dictionary.js`** (wizard + search + URL filters). Синхронизация профиля и листингов: обновление профиля массово обновляет листинги, которые следовали старому значению, а явное сохранение листинга приоритизирует его значение и синхронизирует `profiles.instant_booking`.
- **Stage 44.0 — Trust layer + guest review aggregates + visual amenities:** миграция **`prisma/migrations/012_stage44_listing_review_aggregates.sql`** — колонка **`listings.avg_rating`**, функция **`refresh_listing_review_stats`**, триггер **`trg_reviews_refresh_listing_stats`** на **`public.reviews`** (пересчёт **`reviews_count`**, **`avg_rating`**, **`rating`**; DDL самой **`reviews`** остаётся в **`database/reviews_table.sql`** и связанных миграциях). **`run-listings-search-get.js`** и **`GET /api/v2/listings/[id]`**: в DTO — **`ownerVerified`** (из **`profiles.is_verified`**), **`avgRating`** / **`average_rating`**, **`reviewsCount`** / **`reviews_count`**. Семантика поиска: **`match_listings`** по-прежнему только по эмбеддингу + `status`; порядок в приложении — **`mergeSemanticHitsIntoListingOrder`** после SQL-выборки (см. манифесто § Stage 44.0 — roadmap расширения RPC). Визуальные удобства: **`amenities-dictionary.js`** дополняется **`iconName`** (имена экспортов **lucide-react**), рендер — **`lib/listing/amenity-lucide-icon.jsx`** (**`AmenityLucideIcon`**), использование в **`SearchFiltersDialog`**. Карточка каталога: **`GostayloListingCard`** — бейдж **`listingCard_verifiedPartner`** при **`ownerVerified`** / **`owner.is_verified`**.
- **Stage 45.1 — Stability & safety overhaul (P0):** миграция **`prisma/migrations/013_stage45_atomic_booking_numeric_filters.sql`** вводит **`create_booking_atomic_v1`** (lock `listings` row `FOR UPDATE` + проверка занятости по `bookings`/`calendar_blocks` + insert в одной транзакции) и возвращает **`DATES_CONFLICT`** без race-window между check и insert. `createBooking` использует RPC вместо финального `checkAvailability`+`insert`; конфликт дат нормализуется в **HTTP 409**. Для поиска добавлены числовые поля **`listings.bedrooms_count`**, **`listings.bathrooms_count`** (backfill из `metadata`, триггер синхронизации, индексы `ACTIVE`) и фильтрация в **`run-listings-search-get.js`** переведена на эти integer-колонки (без лексикографического риска `metadata->>...` строк). `POST /api/v2/bookings`: при **`listings.instant_booking = true`** (и без private/negotiation запроса) стандартная ветка создаёт бронь сразу в **`CONFIRMED`**, минуя inquiry/pending.
- **Stage 45.2 — Global scalability + wallet foundation:** миграция **`prisma/migrations/014_stage45_timezone_ssot.sql`** добавляет SQL-резолвер **`resolve_listing_timezone_v1(metadata)`** и переводит **`create_booking_atomic_v1`** на динамический TZ (`p_listing_tz` + fallback по metadata/country), убирая жёсткий `Asia/Bangkok` из расчёта ночей в атомарном insert. JS-слой использует тот же SSOT-резолвер **`lib/geo/listing-timezone-ssot.js`**; `CalendarService.getCalendar/buildCalendar` и `checkAvailability` считают даты в timezone листинга (metadata.timezone → country fallback → env default). Для финмодели чтения введён единый сервис **`readBookingFinancialSnapshot(bookingId)`** (`lib/services/booking-financial-read-model.service.js`) и поле **`financial_snapshot_read_model`** в **`GET /api/v2/bookings/[id]`** (единый источник subtotal/fee/taxable margin/payout для UI, админки и будущего Wallet). PDP: в блоке владельца (`ListingInfo`) бейдж верификации выровнен с каталогом — **`listingCard_verifiedPartner`** при `ownerVerified`/`owner.is_verified`.
- **Stage 45.3 — Financial single truth + map abstraction:** **`buildBookingFinancialSnapshotFromRow`** дополняет партнёрские поля **`gross` / `fee` / `net`** (THB, из снимка/settlement). **`GET /api/v2/partner/bookings`** вшивает **`financial_snapshot`** в каждую бронь; **`/partner/finances`** не пересчитывает комиссии в браузере (отображение и CSV из снимка). **`GET /api/v2/partner/finances-summary`** (`lib/services/partner-finances-summary.service.js`): корзины **Pending** (PENDING+CONFIRMED), **Escrow**, **Available** (как **`EscrowService.getPartnerBalance`**), **Total paid** (сумма DEBIT партнёра по журналам **`PARTNER_PAYOUT_OBLIGATION_SETTLED`**), плюс **`portfolio`** и **`reconciliation`** (escrow+available vs **`LedgerService.sumNetBalancesByAccountIds`**). **`LedgerService.sumPartnerPayoutDebitsThb`**. Строки UI — **`lib/translations/ui.js`** (`partnerFinances_*`). Карты: **`lib/maps/map-provider-adapter.js`** + **`InteractiveSearchMap`**.
- **Stage 46.0 — Partner financial transparency (standard):** один и тот же read-model на списке и в деталях: **`GET /api/v2/partner/bookings/[id]`** отдаёт **`financial_snapshot`** через **`buildBookingFinancialSnapshotFromRow`** (как list route). **Drill-down:** **`components/partner/PartnerFinancialSnapshotDialog.jsx`** + кнопка в **`UnifiedOrderCard`** (partner) — субтотал, сервисный сбор гостя, комиссия хоста, маржа платформы, net payout, блок «гость платит» (как на чекауте по смыслу прозрачности). **PDF-выписка за период:** **`GET /api/v2/partner/finances-statement-pdf?from=&to=`** (UTC bounds по **`bookings.created_at`**, partner-only, **`lib/services/partner-finances-pdf.service.js`** / pdfkit); UX на **`/partner/finances`**. **Дашборд:** **`GET /api/v2/partner/stats`** для трендов/корзин/pending/upcoming использует net из read-model (**`partnerNetThb`** на элементах списка); UI дашборда показывает те же net-THB с подсказкой. *Идея на будущее:* встроенный шрифт с кириллой/тайским в PDF для полностью локализованных выписок налоговой.
- **Stage 46.1 — Partner Master Calendar SSOT + i18n:** **`GET /api/v2/partner/calendar`** больше не содержит локального `processCalendarData`: для каждого листинга вызывается **`CalendarService.getCalendarForDateRange(listingId, startDate, endDate, { marketingPromoRows })`**, затем **`CalendarService.mapPartnerCalendarGridRow`** → тот же **`buildCalendar`** (ночи **`[check_in, check_out)`**, checkout-morning **`is_transition`**, **`resolveListingTimeZoneFromMetadata`** на ночах, промо **`promo-engine`**). **`OCCUPYING_BOOKING_STATUSES`** включает **`THAWED`** — ночь остаётся занятой до выезда после разморозки эскроу. UI: **`CalendarGrid`** / **`CalendarMobileAgenda`** — строки через **`getUIText`** (`partner-calendar-modals.js`). **`/partner/finances`**: кнопка разбора по строке брони + пресеты PDF «этот / прошлый месяц»; диалог — расширенная «цепочка прозрачности» (гость → сборы → страховка → комиссия платформы → net).
- **Stage 47.0 — Ecosystem notifications + chat→finance + PDF Unicode:** **`NEW_BOOKING_REQUEST`**: FCM партнёру (**`BOOKING_REQUEST`** / **`BOOKING_INSTANT_PARTNER`** при **`CONFIRMED`**, ссылка **`/partner/bookings?booking=`**), письма гостю/партнёру с ветвлением **instant vs request** (**`EmailService.sendBookingRequested`** / **`sendNewLeadAlert`**, опции **`instantConfirmed`**). **`PARTNER_FUNDS_THAWED_AVAILABLE`** при **`PAID_ESCROW` → `THAWED`**: read-model, письмо (**`sendPartnerFundsThawedEmail`**); приглашение к отзыву — см. **47.2** (не в момент разморозки). **`PartnerChatCalendarPeek`**: **`getUIText`**, «Финансы брони» при **`financial_snapshot`** → **`PartnerFinancialSnapshotDialog`**. PDF: **`partner-pdf-fonts.js`** + Noto. PDP: **`listingCard_verifiedPartner`**. Календарь: **`NEXT_PUBLIC_PARTNER_CALENDAR_DEMO_FALLBACK`** не в **`production`**.
- **Stage 47.1 — Multilingual push + payout gate (stub):** **`PushService`**: **`normalizePushUiLang`**, **`pickLocalizedTemplateStrings`**; zh/th на **`BOOKING_INSTANT_PARTNER`**, **`FUNDS_THAWED_PARTNER`**; дефолты **`NEW_MESSAGE`** для zh/th. **`POST /api/v2/partner/payouts/request`** — заглушка без записи выплаты (см. **48.0** — KYC на API). **`/partner/finances`**: модалка «Вывести средства». PDF: опциональное лого **`public/images/logo-black.png`**.
- **Stage 47.2 — Thaw vs review decouple + neutral copy:** при **`THAWED`** только **`PARTNER_FUNDS_THAWED_AVAILABLE`** (FCM **`FUNDS_THAWED_PARTNER`** + email); **`PARTNER_GUEST_REVIEW_INVITE`** — через крон **`POST /api/cron/partner-client-review-invite`** (**`processPartnerClientReviewInvitesDue`** в **`lib/services/partner-client-review-invite-cron.service.js`**) для **`THAWED`/`COMPLETED`**, когда **`listingDateToday() > toListingDate(check_out)`**, нет **`guest_reviews`** от партнёра по этой брони, и в **`metadata`** не зафиксирован **`partner_client_review_invite_at`**. Кроны — см. **49.0** (**`lib/cron/verify-cron-secret.js`**). Терминология: «клиент» в пуше **`PARTNER_GUEST_REVIEW`**, Telegram и **`getPartnerGuestReviewPromptCopy`** (по категории: housing / transport / service). Заголовок PDF и бренд в письмах/пушах: **`getSiteDisplayName()`** (**`lib/site-url.js`**; без **`NEXT_PUBLIC_SITE_NAME`** → **`Platform`**).
- **Stage 48.0 — Payout KYC + financial category field + production hygiene:** вывод средств (**`POST /api/v2/partner/payouts/request`** stub и **`POST /api/v2/partner/payouts`** реальная заявка) требует **`profiles.is_verified === true`** (админская верификация личности; не путать с **`partner_payout_profiles.is_verified`** — верификация реквизитов). Проверка: **`isPartnerProfileAdminVerified`** (**`lib/partner/partner-payout-kyc.js`**). UI **`/partner/finances`**: кнопка «Вывести средства» и submit в модалке disabled + поясняющий текст и ссылка **`/partner/settings`**. Read-model: **`buildBookingFinancialSnapshotFromRow`** добавляет **`category_slug`** (**`categorySlugFromBookingFinancialRow`**: **`bookings.metadata.listing_category_slug`** приоритетно, иначе **`listing.categories.slug`**); выборки в **`partner-finances-summary`**, **`finances-statement-pdf`**, **`readBookingFinancialSnapshot`** расширены **`metadata` + join** для slug. На странице финансов — бейджи потока (см. **49.0**, четыре типа включая **Тур**). **`lib/services/escrow/thaw.service.js`**: удалён **`console.log`** из preview (остаются **`console.error`/`warn`** для сбоев).
- **Stage 49.0 — Taxonomy doc + tour badge + brand SSOT + cron module:** раздел паспорта **«Category SSOT & Business Logic Mapping»** (таблица slug → thaw vs UI). **`PartnerBookingIncomeKindBadge`**: отдельный четвёртый тип **Тур** (иконка **`MapPin`**). **`getSiteDisplayName`**: только env или **`Platform`**; premium-email шапка/футер и пуши **`BOOKING_INSTANT_PARTNER`**, **`FUNDS_THAWED_PARTNER`**, **`PARTNER_GUEST_REVIEW`** с **`{siteName}`**; subject письма о разморозке — с суффиксом бренда. Все **`app/api/cron/*/route.js`** → **`assertCronAuthorized`** (**`lib/cron/verify-cron-secret.js`**). Удалён устаревший **`docs/CALENDAR_AUDIT_REPORT.md`** (рекомендации внедрены в Stages 46–47).
- **Stage 30.0 — `partner_trust` везде:** **`attachPartnerTrustToBookings`** (`lib/booking/attach-partner-trust-to-bookings.js`) вызывается из **`getBookings`** / **`getBookingById`** (**`query.service.js`**), **`GET /api/v2/partner/bookings`**, **`GET /api/v2/partner/bookings/[id]`**, **`GET /api/v2/admin/bookings/[id]`**, обогащения брони в **`GET /api/v2/chat/conversations`**.
- **Вспомогательно:** `hooks/checkout-constants.js` реэкспорт из **`lib/config/app-constants.js`** (**`GOSTAYLO_WALLET`**, **default methods**), `hooks/interpolate.js` (шаблоны строк).

### 0.0g Partner listing creation & edit wizard (Stage 4.1 + 4.2)
- **Создание — маршрут:** `app/partner/listings/new/page.js` — оболочка: **`Suspense`** + **`ListingWizardProvider`** (по умолчанию `mode="create"`) + **`ListingWizardPageInner`**.
- **Редактирование — маршрут:** `app/partner/listings/[id]/page.js` — оболочка: **`Suspense`** + **`ListingWizardProvider` с `mode="edit"`** и **`initialListingId` из `params.id`** + **`EditPartnerListingView`**, который рендерит тот же **`ListingWizardPageInner`**, а под визардом (после общих шагов) — **`CalendarSyncManager`**, **`AvailabilityCalendar`**, **`SeasonalPriceManager`** (только не для transport-категории: `isTransportListingCategory` скрывает внешний iCal sync).
- **SSoT состояния (единая база):** `app/partner/listings/new/context/ListingWizardContext.js` — `formData` (в т.ч. `cancellationPolicy`, `status`, `available` с сервера), `serverListing` и `listingNotFound`, шаг `currentStep` (1–5), `wizardMode` (`create` | `edit`), `tr` / `numberLocale` для шаблонов и форматов чисел, `loadExistingListing` по `?edit=` **или** по `initialListingId` (только при авторизованной сессии), обложка: первый снимок в `images` после выравнивания по `coverImage`.
- **Сохранение:** `app/partner/listings/new/hooks/useListingSave.js` — для **`mode="create"`** по-прежнему черновик (POST/PUT) и публикация; для **`mode="edit"`** — **`PATCH`** списка полей (сохранение без смены `status`/`available` у активного листинга) и отдельный сценарий **публикации черновика** (как в старом flow: `PENDING`, нормализованный `metadata`); миграция внешних фото — после успешного сохранения; сезонные периоды в визарде — POST после публикации **create**-потока, как раньше.
- **Константы по умолчанию:** `app/partner/listings/new/wizard-constants.js` — `WIZARD_DISTRICTS`, `getDefaultWizardFormData()`.
- **Шаги (UI, `React.memo` на тяжёлых):** `app/partner/listings/new/components/`
  - **`StepGeneralInfo.jsx`** — категория, импорт Airbnb (если не transport/tour), заголовок, описание, AI; **`WizardSpecsSection.jsx`** (спеки + удобства).
  - **`StepLocation.jsx`** — район, геокод, `MapPicker`, координаты.
  - **`StepPhotos.jsx`** — загрузка, сетка, `PartnerCalendarEducationCard`.
  - **`StepPricing.jsx`** — база, валюта, **политика отмены**, превью «цена на сайте», min/max (или тур-группы), duration discount, сезонные периоды, `react-day-picker`.
  - **`StepPreview.jsx`** — чек-лист и предпросмотр.
- **Порядок шагов:** **basics+specs** → **location** → **gallery** → **pricing** → **live preview**; данные не сбрасываются при переходах.
- **Тексты (Stage 4.2):** строки партнёрского визарда/редактора в **`lib/translations/listings-partner.js`** (включая `wizard*`, `draftDefaultTitle`, `defaultListingSeasonLabel`, `improveDescription*`);

### 0.0h Guest listing page — modular shell (Stage 5.1)
- **Маршрут:** `app/listings/[id]/page.js` — клиентская оболочка: загрузка листинга/курсов/календаря, **`Suspense`** с **`ListingPageSkeleton`**, без дублирования расчёта цены (хук **`useListingPricing`**).
- **SSoT URL картинок для гостя:** `getListingDisplayImageUrls(listing)` в **`lib/listing-display-images.js`** — cover первым, дедуп, нормализация через **`toPublicImageUrl`** (same-origin **`/_storage/...`**) → **`next/image`** (WebP/AVIF) в **`BentoGallery`**.
- **Компоненты страницы** (`app/listings/[id]/components/`):
  - **`ListingGallery.jsx`** — обёртка над **`BentoGallery`**, тот же список URL, что и для **`GalleryModal`**.
  - **`ListingPageNav.jsx`** — липкий верх: назад, избранное (i18n **`listingDetail_*`**).
  - **`ListingHeader.jsx`** / **`ListingDescription.jsx`** — тонкие оболочки над **`GuestListingTitleBlock`** / **`GuestListingBodyBlock`** из **`components/listing/ListingInfo.jsx`**.
  - **`ListingPageSkeleton.jsx`** — скелетон при **`loading`** и в **`Suspense`**.
  - **`BookingWidget.jsx`** — реэкспорт **`DesktopBookingWidget`**, **`MobileBookingBar`**, **`PriceBreakdownBlock`** из **`components/listing/BookingWidget.jsx`**.
- **Хуки:** `app/listings/[id]/hooks/useListingPricing.js` — субхук цены (итог, налоги/комиссия гостя, скидки по длительности), вместо inline-эффекта в `page.js`.
- **i18n:** публичные строки гостевой карточки в **`lib/translations/listings-public.js`** (ключи **`listingDetail_*`**, `listingInfo_*`, `listingGallery_*` и др.).

### 0.0i Messenger thread — modular shell (Stage 6.1)
- **Маршрут:** `app/messages/[id]/page.js` — рендер **`UnifiedMessagesClient`**.
- **SSoT треда (не путать с глобальным инбоксом):** `app/messages/[id]/context/ChatContext.js` — **`MessengerThreadProvider`**, **`useMessengerThread`**: `conversationId`, `messages` / `setMessages`, `selectedConv`, `listing`, `booking`, `isHosting`, и т.д. Глобальные бейджи/список — по-прежнему **`@/lib/context/ChatContext.jsx`**.
- **Данные и Realtime:** **`hooks/use-chat-thread-messages.js`** — загрузка треда, оптимистичная отправка; подписка INSERT/UPDATE через **`useChatRealtime`** из **`hooks/use-chat-realtime.js`** (обёртка над **`useRealtimeMessages`** в **`hooks/use-realtime-chat.js`**). Точка входа модуля: **`app/messages/[id]/hooks/useChatRealtime.js`** (реэкспорт).
- **Компоненты** (`app/messages/[id]/components/`):
  - **`ConversationSidebar.jsx`** — обёртка над **`components/chat/ConversationList.jsx`** (вкладки, архив).
  - **`MessageList.jsx`** — **`ChatMessageList`**, **`SafetyBanner`**, **`ChatMediaGallery`**, скелетон загрузки.
  - **`MessageInput.jsx`** — хост: **`PartnerChatComposer`** (`next/dynamic`); гость: вложения, голос, **`ChatGrowingTextarea`**.
  - **`BookingInfoSidebar.jsx`** — правая колонка: **`DealDetailsCard`** (`next/dynamic`).
  - **`ThreadDealDetailsSheet.jsx`**, **`DeclineBookingDialog.jsx`** — мобильный sheet «детали сделки» и отклонение брони.
- **Архив диалога:** **`app/messages/[id]/hooks/useThreadArchive.js`** (тосты и навигация).
- **i18n треда:** ключи **`messengerThread_*`**, превью счёта в списке — **`chatListPreview_invoice`** в **`lib/translations/ui.js`**.

### 0.0f Performance + i18n (Stage 3.1)
- **Язык (единый дефолт RU):** `DEFAULT_UI_LANGUAGE` = **`ru`** в **`lib/translations/index.js`**. **`setLanguage` / I18nProvider** сохраняют выбор в **`localStorage`** и в cookie **`gostaylo_language`** (path=/, SameSite=Lax, max-age long-lived). Клиент **`detectLanguage`**: localStorage → cookie → `navigator` → **RU**. **SSR/SEO:** **`getLangFromRequest(cookies, headers)`** — **сначала cookie** `gostaylo_language`, затем **Accept-Language** (нормализация `en-US` → `en`), иначе **`ru`**. **`app/layout.js`:** `<html lang="ru">` и глобально **без** `leaflet.css` (см. ниже).
- **TTFB главной:** `app/page.js` — **статическая** оболочка (убрано **`export const dynamic = 'force-dynamic'`**); список/курсы тянет **`GostayloHomeContent`** на клиенте. **Suspense fallback** — **`HomePageSkeleton`** (`components/home-page-skeleton.jsx`), а не полноэкранный спиннер.
- **Каталог `/listings`:** Suspense оболочки в **`listings-catalog-client`** — fallback **`ListingsCatalogSkeleton`**, визуально согласован с шапкой/фильтром/сеткой+картой.
- **i18n (тяжёлые словари):** база **`translation-state` → `uiTranslations`**; слайс чата/админ-блока **`slices/chat-ui.js`** мержится в рантайме через **`lib/translations/register-chat-slice.js`**; side-effect импорт в **`app/messages/layout.js`** и **`app/admin/layout.js`**, чтобы главная/чекаут не тянули чат-объём в initial chunk маршрута, но маршруты с этими layout получали ключи.
- **Leaflet:** `leaflet/dist/leaflet.css` подключается только в компонентах с картой: **`components/listing/ListingMap.jsx`**, **`MapPicker.jsx`**, **`InteractiveSearchMap.jsx`** (уже импорт в последних двух; из корневого `layout` удалён).
- **Сборка:** `npm run analyze` — `ANALYZE=true` + `@next/bundle-analyzer` (треemap страниц/чанков).
- **Checkout vs эквайринг:** `POST /api/v2/bookings/[id]/payment/initiate` может отдавать **`checkoutUrl`**. Клиент **`useCheckoutPayment`**: при URL — `window.location.assign` (Mandarin **CARD_INTL** / YooKassa **MIR_RU** через `lib/services/payment-adapters`). **TODO(Production Flag):** mock-подтверждение без шлюза — **не в production** без `NEXT_PUBLIC_CHECKOUT_MOCK_ACQUIRING=1`; иначе toast `checkout_toast_acquiringNotConfigured`.
- **Мёртвый слой:** **`lib/db-service.js`** удалён; списки/поиск — `run-listings-search`, API-роуты, **`BookingService`**.

### 0.0j Global constants SSOT (Stage 7.1)
- **Файл:** `lib/config/app-constants.js` — **`GOSTAYLO_WALLET`**, **`DEFAULT_CHECKOUT_ALLOWED_METHODS`**, **`TRANSPORT_CATEGORY_DB_SLUG`**, перечисление **`BOOKING_STATUS`**, наборы **`NO_PAY_TRAVEL_STATUSES`**, **`RENTER_CHECKOUT_NO_CANCEL_STATUSES`**.
- **Потребители (не дублировать литералы):** `lib/listing-category-slug.js` (реэкспорт transport slug), `app/checkout/.../hooks/checkout-constants.js`, `lib/services/tron.service.js`, `components/chat-action-bar.jsx`, `app/checkout/.../components/CheckoutSummary.jsx` (порог отмены).

### 0.0k Modular public UI (Stage 8.1)
- **Главная — `components/GostayloHomeContent.jsx`:** тонкий оркестратор; **`components/home/`** — **`HomeHero`**, **`CategoryBar`**, **`TopListingsGrid`**, shared **`home-constants.js`**, **`useHomeFilters.js`** (What/Where/When/Who, дебаунс, сид из URL, semantic flag с сайта).
- **Поиск (без дублирования ядра):** **`lib/api/run-listings-search-get.js`** — **единая** реализация **`runListingsSearchGet`**; её вызывают **`GET /api/v2/search`**, **`GET /api/v2/listings/search`** (прокси/сигнатуры) и **SSR ItemList** (`lib/seo/listings-catalog-itemlist.js`). API **v1** отдельного движка поиска **нет** в `app/api/v1/`.
- **Профиль — `app/profile/page.js`:** секции **`ProfileInfo`**, **`ProfileSecurity`**, **`ProfilePreferences`** (`app/profile/components/`), сети и PATCH заявок/дока — **`app/profile/hooks/useProfileUpdate.js`**. Модалки «заявка партнёра» + welcome остаются в `page.js`.
- **Сборка Vercel / bundle-analyzer:** `next.config.js` оборачивает движок опционально: при отсутствии `@next/bundle-analyzer` (только `dependencies` без `devDependencies` в prod install) используется identity, чтобы **`next build`** не падал. Локально **`npm run analyze`** с полным `npm install` — как раньше.
- **Skeleton главной — `components/home-page-skeleton.jsx`:** зоны **hero / категории / сетка+футер** согласованы по высотам/отступам с реальной вёрсткой, **`min-h`** у блока сетки, чтобы снизить скачок при гидрации `GostayloHomeContent`.

### 0.0a Admin Financial Health (Ledger)
- **UI:** `app/admin/financial-health/page.jsx` — маршрут **`/admin/financial-health`**, карточки остатков по счетам **PROCESSING_POT_ROUNDING** («котёл на платёжки») и **INSURANCE_FUND_RESERVE** (страховой фонд), плюс **PLATFORM_FEE** и агрегат **PARTNER_EARNINGS**; блок **сверки Cash (MVP)** при **`marginLeakage`**; кнопка **«Сформировать реестр для Т-Банка»** (скачивание CSV); таблица выплат в **`PROCESSING`** с кнопками **PAID** / **FAILED** и **AlertDialog** подтверждения перед отправкой **PATCH**.
- **API:** **`GET /api/v2/admin/ledger-balances`** — только **`profiles.role === 'ADMIN'`**; агрегация **`sum(CREDIT) − sum(DEBIT)`** по строкам **`ledger_entries`** (см. **`lib/services/ledger.service.js`**). **`GET /api/v2/admin/ledger-reconciliation`** — сверка **только Booking Capture**: **DEBIT** по **`GUEST_PAYMENT_CLEARING`** и **CREDIT** по прочим счетам **внутри журналов с clearing DEBIT**; **CREDIT** на **`PARTNER_PAYOUTS_SETTLED`** в «распределение» не входят; smoke **`payoutSelfCheck`** (открытые выплаты vs **PARTNER_EARNINGS**). Расхождение clearing↔credits или несходящиеся журналы → **Margin Leakage**.
- **T-Bank CSV:** **`POST /api/v2/admin/payouts/tbank-registry`** — см. **`lib/services/tbank-payout-registry.service.js`**: **`payouts` PENDING**, метод **`pm-bank-ru`** (или BANK+RUB), только **`partner_payout_profiles.is_verified`**, полные **`data`** (счёт, БИК, ИНН). После экспорта — **`PROCESSING`**. Формат колонок: **ФИО;Номер счета;БИК;ИНН;Назначение платежа;Сумма** (UTF-8 BOM); опционально **`encoding: windows-1251`** → **`csvBase64`**. Верификация профилей: **`/admin/payout-verification`**, API **`GET /api/v2/admin/partner-payout-profiles`**, **`PATCH .../[id]`** с **`action: verify`**.
- **Копилка / страховой фонд (ledger):** на **`/admin/financial-health`** две карточки по данным **`ledgerReporting`** из **`GET /api/v2/admin/ledger-balances`**: **Rounding Pot** = счёт **`PROCESSING_POT_ROUNDING`** (алиас **FEE_CLEARING**), **Insurance Fund** = **`INSURANCE_FUND_RESERVE`** (алиас **RESERVES**); соглашение по балансу — как в **`ledger-balances`**.
- **Проводки:** при успешном **`EscrowService.moveToEscrow`** (бронь → **`PAID_ESCROW`**, подтверждённая оплата через **`PaymentsV3Service.confirmPayment`**) создаётся журнал **`BOOKING_PAYMENT_CAPTURED`** с пятью ногами: **DEBIT** `GUEST_PAYMENT_CLEARING`; **CREDIT** партнёрский счёт, **PLATFORM_FEE**, **INSURANCE_FUND_RESERVE**, **PROCESSING_POT_ROUNDING**. Суммы берутся из **`pricing_snapshot.fee_split_v2`** / колонок брони (идемпотентность: **`ledger_journals.idempotency_key`**). Журналы без брони: **`ledger_journals.booking_id`** может быть **NULL** (миграция **`032_ledger_payout_settlement.sql`**) — проводка **`PARTNER_PAYOUT_OBLIGATION_SETTLED`** при ручном **PAID**: **DEBIT** `PARTNER_EARNINGS` (партнёр), **CREDIT** **`PARTNER_PAYOUTS_SETTLED`** (`la-sys-partner-payouts-settled`), сумма **THB** = **`payouts.gross_amount`** (база до комиссии метода).

### 0.0a1 Partner dashboard & payout profiles (trust / viz)
- **`GET /api/v2/partner/stats`** — блок **`financialV2`**: «деньги в пути» по броням **`PAID_ESCROW`** (тот же расчёт дохода партнёра, что и в карточке «Доход») и помесячные суммы по **`payouts`** со статусами **`PAID`** / **`COMPLETED`** (см. **`docs/TECHNICAL_MANIFESTO.md`**). Клиент: **`app/partner/dashboard/page.js`** (график **recharts**); карточка «Будущий доход» ведёт на **`/partner/finances?status=PAID_ESCROW`** (фильтр списка броней на **`app/partner/finances/page.js`**).
- **PR-#2 баланс по эскроу:** **`GET /api/v2/partner/balance-breakdown`** — **`frozenBalanceThb`** / **`availableBalanceThb`** (агрегат из броней **`PAID_ESCROW`** / **`THAWED`**), **`byCategory`** (slug категории листинга), **`recentLedgerTransactions`** (последние строки **`ledger_entries`** партнёра). **`GET /api/v2/partner/finances-summary`** (Stage 45.3) — агрегированные корзины **Pending / Escrow / Available / Total paid** + **`portfolio`** + **`reconciliation`** с ledger. Колонки **`profiles.frozen_balance_thb`**, **`profiles.available_balance_thb`** синхронизируются в **`EscrowService`**. Разморозка: **`POST /api/cron/escrow-thaw`**. Из‑за лимитов **Vercel Hobby** (cron не чаще 1/день) критичные кроны запускаются гибридно: Vercel расписание остаётся daily для валидного деплоя, а **hourly** для **`escrow-thaw`** дублируется внешним планировщиком (cron-job.org) с заголовком `Authorization: Bearer CRON_SECRET` (или `x-cron-secret`). Роут **`/api/cron/payouts`** удалён из приложения (исторический автопул); см. архив **`legacy/unused-cron-logic/`**. Партнёрский UI: **`/partner/finances`** (карточка баланса + таблица ledger + сводка).
- **PR-#3 отзывы партнёра о клиенте (рентер):** миграция **`034_guest_reviews.sql`** — **`guest_reviews`**. **`GET /api/v2/partner/pending-reviews`**, **`POST /api/v2/partner/guest-reviews`**. UI: **`/partner/bookings/[bookingId]/guest-review`**. Уведомление-приглашение (**`PARTNER_GUEST_REVIEW_INVITE`**) рассылается **после календарного `check_out`** (крон **`partner-client-review-invite`**, Stage **47.2**), а не при разморозке эскроу.
- **PR-#4 TIMESTAMPTZ и политика отмены:** миграция **`database/migrations/035_pr4_bookings_timestamptz_cancellation_policy.sql`** — **`bookings.check_in` / `check_out`**: **TIMESTAMPTZ**; **`listings.cancellation_policy`**: enum **`flexible` / `moderate` / `strict`** (бэкфилл из **`metadata.cancellationPolicy`**). Ledger: **`BOOKING_REFUND_PARTIAL`** через **`LedgerService.postPartialRefundForBooking`** (**`lib/cancellation-refund-rules.js`** для доли гостю). Календарь партнёра / crons / stats: сравнение дней через **`toListingDate`** (**`lib/listing-date.js`**); ручное бронирование — **`normalizeBookingInstantForDb`**.
- **Vehicles interval availability (partner confirm):** для категории **`vehicles`** финальная проверка в **`BookingService.verifyInventoryBeforePartnerConfirm`** выполняется по **временным интервалам** (`check_in/check_out` TIMESTAMPTZ), а не по party-size vs `remaining_spots`: в `CalendarService.checkAvailability` передаются `guestsCount: 1`, `listingCategorySlugOverride: 'vehicles'`, `excludeBookingId`, и фильтр статусов `CONFIRMED,PAID,PAID_ESCROW,CHECKED_IN`. Пересечение: `existing.check_in < request.check_out` и `existing.check_out > request.check_in` (через `findVehicleIntervalConflicts`).
- **Vehicles interval availability (search + listing UI):** фильтр каталога и карточка листинга для `vehicles` теперь передают `checkIn/checkOut` как ISO datetime (`+07:00`) при выборе времени; `GET /api/v2/listings/[id]/availability` принимает `startDateTime/endDateTime`. Это синхронизирует поиск, pre-check в карточке и создание брони по одной интервальной модели (без возврата к отельному 14:00/12:00 шаблону).
- **Transport time UX:** в поиске, виджете и модалке бронирования для `vehicles` используется единый 24-часовой электронный `TimeSelect` (слоты 30 мин); значения `checkInTime/checkOutTime` прокидываются через home → listings → listing details deep-links, чтобы не терялись при переходах.
- **Transport binary-mode unified:** для `vehicles` гостевой и партнёрский create flow больше не сравнивают `guests_count` с `max_capacity`/`remaining_spots`; бинарная доступность проверяется как пересечение интервалов одной единицы инвентаря.
- **Day-only protection for transport:** при отсутствии времени в check-in/check-out транспортный interval normalizer принудительно строит full-day диапазон (`00:00`-`23:59:59.999`, Bangkok), чтобы исключить скрытые overlaps.
- **DB hard guard against race condition:** миграция **`037_vehicle_booking_overlap_guard.sql`** добавляет trigger-level блокировку overlapping insert/update для `vehicles` (`VEHICLE_INTERVAL_CONFLICT`), что закрывает двойное бронирование при одновременных кликах.
- **Chat confirmed copy split by role:** в milestone `booking_confirmed` для партнёра показывается отдельный CTA-текст про выставление счёта, для гостя остаётся текст про оплату счёта.
- **Invoice consistency layer:** чат-обогащение бесед включает `bookings.price_thb/currency/guests_count` (префилл счёта из заказа), `GET /api/v2/chat/invoice?id=` поддерживает адресный доступ к одному счёту с проверкой участника, checkout при `invoiceId` подтягивает invoice-метаданные и выставляет предпочтительный метод оплаты.
- **Stage 3 — Payment adapters over Intent:** добавлен adapter registry `lib/services/payment-adapters`: `CARD_INTL` (Mandarin-ready scaffold) и `MIR_RU` (YooKassa-ready scaffold). `PaymentIntentService.initiate` выбирает адаптер по методу оплаты, сохраняет `external_ref` + `provider_payload` в `payment_intents`, а checkout больше не рендерит «лишние» способы вне `allowedMethods`.
- **Checkout intent prefetch API:** `GET /api/v2/bookings/[id]/payment-intent` (session + owner check) резолвит/создаёт intent до initiate, чтобы UI методов оплаты соответствовал конкретному платежному контракту.
- **Stage 3.1 — Production hardening:** `POST /api/webhooks/payments/confirm` валидирует подпись отдельно по адаптеру (`x-mandarin-signature`/`MANDARIN_WEBHOOK_SECRET`, `x-yookassa-signature`/`YOOKASSA_WEBHOOK_SECRET`, fallback `x-webhook-signature`/`PAYMENT_ACQUIRING_WEBHOOK_SECRET`) и нормализует внешние статусы PSP в внутренний map `payment_intents` (`CREATED/INITIATED/PAID/FAILED/CANCELLED/EXPIRED`) до запуска escrow/ledger.
- **Admin adapter health:** добавлен `GET /api/v2/admin/payment-adapters/health` (ADMIN-only) — проверка готовности env для `CARD_INTL`/`MIR_RU` и глобальных секретов перед включением live processing.
- **PR-#5 отмена брони и UI политики:** партнёр задаёт **`cancellationPolicy`** в **`PATCH /api/v2/partner/listings/[id]`**; публичная выдача — **`GET /api/v2/listings/[id]`** → **`cancellationPolicy`**. Страница листинга: блок политики (**`components/listing/ListingCancellationPolicy.jsx`**, i18n **`listingCancellation_*`**). Оценка возврата: **`computeRefundEstimateForBooking(bookingId, at)`**. Превью: **`GET /api/v2/bookings/[id]/cancel-preview`**. Отмена: **`POST /api/v2/bookings/[id]/cancel`** (тело опционально **`reason`**) — арендатор / партнёр по брони / staff; при эскроу-статусах — ledger + **`syncPartnerBalanceColumns`**. Рентер: **`/renter/bookings`**, **`/checkout/[bookingId]`** (**`components/renter/cancel-booking-dialog.jsx`**).
- **PR-#7 Smart Extension Cockpit (этап 1):** chat invoice расширен без breaking changes: **`POST /api/v2/chat/invoice`** принимает **`intent=extension`** + **`new_check_out`** (optional). Оплата инвойса через checkout прокидывает **`invoiceId`** в **`POST /api/v2/bookings/[id]/payment/confirm`**. После успешного **`EscrowService.moveToEscrow`** сервер применяет post-payment effects: invoice → **paid**, extension идемпотентно меняет **`bookings.check_out`** через **`bookings.metadata.appliedExtensionInvoiceIds`**, пишет system message в чат (**`system_key=booking_extension_confirmed`**) и досрочно закрывает soft-hold блока счёта в **`calendar_blocks`** (**`source=invoice_hold`**, `expires_at=now`) для корректной доступности календаря.
- **`PUT /api/v2/partner/payout-profiles`**: при **`is_verified`** запрещено менять **`method_id`** или **`data`** (**403**, текст про новый профиль → основной → удалить старый); до верификации поля можно менять. UI **`app/partner/payout-profiles/page.js`**: **`AlertDialog`** перед **POST** и перед сохранением правок; подсказка под **основным** профилем.
- **Справочник рейлов выплат (admin):** UI **`/admin/payout-methods`**; API **`GET` / `POST` / `PUT` / `DELETE` `/api/v2/admin/payout-methods`** (только **`profiles.role === 'ADMIN'`**). **`PUT`** по несуществующему **`id`** → **404**. **`DELETE`** при ссылках из **`partner_payout_profiles`** → **409**. После мутаций — **`revalidatePath('/api/v2/payout-methods')`**.

### 0.0 Admin Health Dashboard (ops + security)
- **UI:** `app/admin/health/page.jsx` — маршрут **`/admin/health`**, карточки **`rounded-2xl`**: агрегаты **`ops_job_runs`** (7 дн.) для **`ical-sync`**, **`push-sweeper`**, **`push-token-hygiene`**, **`partner-sla-telegram-nudge`** (метрики + «покрытие» TG vs **`partner_sla_nudge_events`**), блок **`critical_signal_events`** (`PRICE_TAMPERING`).
- **Payment adapters widget:** на **`/admin/health`** добавлен mini-widget readiness по `CARD_INTL` и `MIR_RU` (светофор ready/missing + список отсутствующих env), источник данных — **`GET /api/v2/admin/payment-adapters/health`**.
- **API:** **`GET /api/v2/admin/health`** — только **`profiles.role === 'ADMIN'`** или email из **`ADMIN_HEALTH_EMAILS`** (см. **`lib/admin-health-access.js`**); данные через **`supabaseAdmin`**.
- **Chat reliability (mobile/web):** глобальный presence трекинг через **`PresenceProvider`** (`app/layout.js`, канал `gostaylo-site-presence:v1`) и устойчивый badge unread из **`ChatContext`** (`GET /api/v2/chat/conversations?archived=all&enrich=1&limit=100`; события `messages` по Realtime проходят RLS, без ложного отбрасывания до синхронизации локального списка — см. v2.1.9 в манифесте).
- **Messenger-grade v2.1.9:** как v2.1.8, плюс **единый ref-counted канал `typing:global:v1`** (`lib/chat/typing-global-channel.js`) для инбокса и треда; dev-подсказки при обрыве Realtime — **`lib/chat/realtime-dev-warn.js`** + опция **`channelLabel`** в **`subscribeRealtimeWithBackoff`**.
- **Тред сообщений (хост, мобилка):** единый клиент **`app/messages/[id]/UnifiedMessagesClient.jsx`**. Решение по заявке (**PENDING** / **INQUIRY**): на **`lg+`** — компактные кнопки в **`ChatHeaderActions`**; на узкой ширине — под **`ChatMilestoneCard`** (**`partnerInquiryActions`**, см. **`components/chat-milestone-card.jsx`**) при **`suppressMobileHostBar`** у **`ChatActionBar`**, чтобы не дублировать нижнюю полосу. Канонические детали inquiry (TZ-якорь дат, формулировка party size по категории) — в **`docs/TECHNICAL_MANIFESTO.md`** (§5).

### 0.04 Card / acquiring webhook (Mandarin, YooKassa-совместимо)
- **Route:** `POST /api/webhooks/payments/confirm` — секрет **`PAYMENT_ACQUIRING_WEBHOOK_SECRET`**; подпись **`X-Webhook-Signature`** = **hex** от **HMAC-SHA256(raw UTF-8 body, secret)**.
- **Тело:** JSON; плоский вариант `bookingId`, опционально `paymentId`/`paymentIntentId`, `amount` + `currency` (**THB** для строгой сверки), `paid`; либо структура с **`event` / `object`**.
- **Успех:** primary path — `PaymentIntentService.markPaid` (по `payment_intent_id`/`paymentIntentId` или active intent), затем **`EscrowService.moveToEscrow`** + invoice effects; legacy `payments.PENDING` и `PaymentsV3Service.confirmPayment` сохранены как fallback.
- **Security hardening:** выбор адаптера webhook по заголовкам/формату payload (`CARD_INTL` vs `MIR_RU`) и отдельная проверка подписи на каждом адаптере; только статус, нормализованный в `PAID`, может пройти в `markPaid`.

### 0.05 Crypto payment webhook (TRON USDT)
- **Route:** `POST /api/webhooks/crypto/confirm` — **не** публичный: требуется **`CRYPTO_WEBHOOK_SHARED_SECRET`** (заголовок **`x-crypto-webhook-secret`** или поле **`webhookSecret`** в JSON), иначе **401/503**.
- **Тело:** `txid`, `bookingId`; опционально `expectedAmount` (USDT), `targetWallet` (должен совпадать с платформенным кошельком из **`lib/services/tron.service.js`**).
- **Логика:** **`verifyTronTransaction`** (TronScan) → последняя **`payments`** со статусом **`PENDING`** для брони → **`PaymentsV3Service.confirmPayment`** (эскроу + ledger).

### 0.06 Security Baseline (Stage 9.0)
- **API lockdown (booking reads/writes):** `GET /api/v2/bookings`, `GET /api/v2/bookings/[id]`, `PUT /api/v2/bookings/[id]`, `POST /api/v2/bookings/[id]/check-in/confirm` требуют валидный `gostaylo_session`; доступ к данным ограничен участниками брони или staff. Generic `PUT /api/v2/bookings/[id]` разрешён только **ADMIN/MODERATOR** (операционный endpoint).
- **Seed hardening:** `POST/GET /api/db/seed` отключён по умолчанию; доступ только при заданном `DB_SEED_ROUTE_SECRET` и передаче секрета в `x-seed-secret` или `Authorization: Bearer`.
- **Checkout crypto hardening:** клиент больше не вызывает `POST /api/webhooks/crypto/confirm`; подтверждение из checkout идёт через `POST /api/v2/payments/verify-tron` (server-side verify + settlement), что исключает утечку секрета вебхука в браузерный контур.
- **Checkout success semantics:** `PAID_ESCROW` считается успешным платежным состоянием UI checkout.
- **Chat contact policy:** `areContactsRevealedForBooking` учитывает `PAID_ESCROW` и `THAWED` как статусы раскрытия контактов после защищённой оплаты/разморозки.
- **Password policy:** `POST /api/v2/auth/register` принимает пароль не короче 8 символов и требует базовую сложность (минимум одна буква и одна цифра).

### 0.07 Stage 10.0 — Test completion + Unified Order
- **API guard hardening tests:** Playwright проект `stage9-api-guard` стабилизирован до **8/8** без skip; mini-fixture `tests/e2e/paid-escrow-fixture.ts` создаёт тестовую бронь в `PAID_ESCROW` через защищённый endpoint `POST /api/v2/internal/e2e/paid-escrow-booking` (только при `E2E_FIXTURE_SECRET` + `x-e2e-fixture-secret`).
- **Unified order envelope:** добавлен `lib/models/unified-order.js` с `toUnifiedOrder(booking)` для нормализации в единый контракт (`id`, `type`, `status`, `total_price`, `currency`, `dates`, `metadata`).
- **Bookings list integration:** `GET /api/v2/bookings` сохраняет существующий payload и добавляет на каждый элемент поле `unified_order`, чтобы фронтенд мог строить общую ленту услуг независимо от категории.

### 0.08 Stage 11.0 — Unified My Bookings UI
- **Route/UI:** `app/my-bookings/page.js` отображает единый список заказов через `booking.unified_order` (тип услуги, статус, даты, сумма, валюта) и фильтры по типу (`all/home/transport/activity`).
- **Universal atoms:** `components/ui/OrderTypeIcon.jsx` (Home/Bike/Activity) и `components/ui/order-status-badge.jsx` (единая палитра статусов + i18n через `chatBookingStatus_*`, включая `PAID_ESCROW`).
- **Financial SSOT on frontend:** карточки и агрегаты на странице «Мои заказы» используют только `unified_order.total_price` и `unified_order.currency`, без ручного вычисления из legacy полей.
- **Perceived UX:** при переключении фильтров типа применяются skeleton-состояния с фиксированной высотой контейнера, чтобы исключить визуальные скачки верстки.

### 0.09 Stage 11.1 — UnifiedOrderCard across roles
- **Atom component:** `components/orders/UnifiedOrderCard.jsx` — единый role-aware атом карточки заказа (`renter`, `partner`, `admin`) с общим layout, типом услуги, статусом, ценовым блоком и action-секцией.
- **Cross-role integration:** `app/my-bookings/page.js` и `app/partner/bookings/page.js` используют один и тот же компонент; изменения дизайна карточки теперь автоматически распространяются на обе роли.
- **Action policy by unified status:** доступность действий вычисляется внутри атома по `unified_order.status` (renter: cancel/check-in/review; partner: confirm/decline/complete), что снижает дублирование и расхождения между кабинетами.
- **i18n sync:** новые action-label ключи (`orderAction_*`) добавлены в `lib/translations/ui.js` для RU/EN/ZH/TH и используются в карточке для всех ролей.

### 0.10 Stage 12.0 — Stability, Revenue Protection & UI Cleanup
- **Escrow SQL hardening (P0):** в `lib/services/escrow.service.js` удалены обращения к колонкам, отсутствующим в рабочей схеме (`profiles.name`, `bookings.escrow_at`, `bookings.net_amount_thb`). Поток `moveToEscrow` использует `profiles.first_name/last_name`, `metadata.escrow_started` и `partner_earnings_thb`.
- **Escrow module schema alignment:** сопутствующие сервисы (`escrow/payout.service.js`, `escrow/thaw.service.js`, `escrow/balance.service.js`, partner pending-reviews API) переведены на `partner_earnings_thb`, чтобы исключить повторные runtime-падения из-за старого поля `net_amount_thb`.
- **Regression E2E:** добавлен сценарий `tests/e2e/stage12-escrow-regression.spec.ts` + проект `stage12-escrow-regression` в Playwright: `pending -> confirmed -> payment/confirm -> PAID_ESCROW`.
- **UI shared blocks (Stage 11.2):** `components/orders/OrderTypeFilter.jsx`, `components/orders/OrdersSummary.jsx`, `components/orders/OrdersSkeleton.jsx` используются в renter и partner кабинетах, устраняя дублирование type-filter/summary/skeleton.
- **Review sync:** правило review в UI и API унифицировано: доступ после `check_out` (calendar reached) или при статусах `COMPLETED`/`FINISHED`.
- **Legacy cleanup:** удалён `app/api/v2/listings/route.js` (`GET` legacy list endpoint), потребители списка переведены на `GET /api/v2/search`.

### 0.11 Stage 13.0 — Order Timeline & Smart Lifecycle
- **Single source of truth for lifecycle:** добавлен `lib/orders/order-timeline.js` с общими правилами `buildOrderTimelineModel`, `shouldAllowReviewByLifecycle`, `shouldAllowCheckInToday`, `normalizeOrderType`. Этот модуль используют и чат, и карточки бронирований.
- **Order timeline component:** `components/orders/OrderTimeline.jsx` отображает этапы `Created -> Paid -> In progress -> Completed -> Reviewed` и подсвечивает активный шаг по `unified_order.status`. Для транспорта шаг in-progress отображается как pickup.
- **Chat/header sync:** `components/booking-chat-timeline.jsx` переведён на тот же lifecycle engine (`mode: 'chat'`), чтобы логика прогресса не расходилась между чатом и кабинетами.
- **Smart contextual actions in order card:** `components/orders/UnifiedOrderCard.jsx` показывает `Confirm check-in` только в день заезда (`PAID_ESCROW + check_in == today`), review — по общему lifecycle-правилу, добавлена кнопка `Repeat booking` для завершённых заказов.
- **Escrow transparency UX:** в `UnifiedOrderCard` добавлены role-aware плашки: для гостя — «оплачено и защищено эскроу», для партнёра — статус эскроу и дата выплаты (`check_out + 24h`), плюс отдельная плашка после разморозки.
- **i18n additions:** в `lib/translations/ui.js` добавлены ключи `orderTimeline_*`, `orderEscrow_*`, `orderAction_repeatBooking` для RU/EN/ZH/TH.

### 0.12 Stage 14.0 — Unified Dispute & Moderation Engine
- **Existing support flow (audit baseline):** продакшен-эскалация помощи в чате идёт через `POST /api/v2/chat/escalate` (`conversations.is_priority` + structured `messages.metadata.support_ticket`), уведомления staff: FCM (`PushService.notifyStaffSupportEscalation`) + Telegram support topic; staff-join в тред — `POST /api/v2/chat/support/join` (`system_key=support_joined`).
- **Unified dispute model:** добавлены `database/migrations/038_disputes_unified_engine.sql` и таблицы `public.disputes` (обязательная привязка `booking_id`) + `public.dispute_penalties` (подготовка для санкций). Статусы кейса: `OPEN/IN_REVIEW/RESOLVED/REJECTED/CLOSED`.
- **Unified dispute API:** `POST /api/v2/disputes/create` создаёт официальный спор по брони, ставит `freeze_payment=true`, поднимает priority в разговоре, пишет system milestone (`system_key=dispute_opened`) и возвращает созданный кейс/флаг дубликата.
- **Admin levers groundwork:** `POST /api/v2/admin/disputes/[id]/action` (ADMIN/MODERATOR) поддерживает команды `freeze_payment`, `force_refund`, `add_penalty` (запись в `dispute_penalties` + flags в `disputes.admin_action_flags`).
- **Escrow safety coupling:** `EscrowService.processDueEscrowThaws` исключает `PAID_ESCROW` брони с активным dispute-флагом `freeze_payment=true`, предотвращая авто-разморозку до решения спора.
- **Two-level anti-spam support protection:**  
  1) **Level 1 (self-help first):** в `UnifiedOrderCard` кнопка «Помощь» всегда сначала ведёт к базе знаний (`/help/escrow-protection`) и чату по заказу.  
  2) **Level 2 (official dispute gate):** кнопка «Открыть официальный спор» появляется только по lifecycle-условиям (`lib/disputes/dispute-eligibility.js`) и дублируется серверной валидацией + cooldown + ограничением `1 active dispute per booking`.

### 0.13 Stage 14.1 — Admin Dispute Center & Resolution Console
- **UI:** `app/admin/disputes/page.js` — единый стол споров с фильтрами **все / открытые (OPEN+IN_REVIEW) / заморозка (freeze_payment при активном кейсе) / закрытые (RESOLVED+CLOSED+REJECTED)**; скелетон загрузки; строка кликабельна.
- **Панель решения:** `Sheet` справа: **`UnifiedOrderCard`** с `role="admin"` (карточка + блок гость/партнёр), компактная лента чата **`components/admin/AdminDisputeChatPeek.jsx`** (чтение через **`GET /api/v2/chat/messages?conversationId=`**), поле **вердикта**, выбор **виновной стороны** (рентер / партнёр / нет) и кнопки рычагов.
- **API:** **`GET /api/v2/admin/disputes`** (список с embed `bookings` + `listing` + opener), **`GET /api/v2/admin/disputes/[id]`** (детальный кейс + `unified_order`); расширение **`POST /api/v2/admin/disputes/[id]/action`**: добавлено **`close_dispute`** (статус **CLOSED**, `freeze_payment=false`, `resolved_at`, `closed_by`, метаданные вердикта); при выбранной виновной стороне — запись в **`dispute_penalties`** (тот же контур, что **`add_penalty`**). Ответы **`freeze_payment` / `force_refund` / `add_penalty`** возвращают снимок **`dispute`** для мгновенного обновления таблицы на клиенте.
- **Навигация:** пункт **«Споры»** в **`app/admin/layout.js`** (`moderatorAccess: true`).

### 0.14 Stage 15.0 — Trust graph & public reputation
- **Движок:** `lib/services/reputation.service.js` — **`ReputationService.computePartnerReliabilitySnapshot`**: метрики по партнёру `partner_id` — завершённые брони (**`THAWED`/`COMPLETED`/`FINISHED`**), число таких броней с **любой** записью в **`disputes`**, сумма и количество **`dispute_penalties`**, отклонённые заявки (**`bookings.status = DECLINED`**), отмены инициированные партнёром (**`CANCELLED`** + **`metadata.cancelled_by_user_id` = partner**). Публичный DTO: **`getPartnerTrustPublic`** / пакетно **`getPartnersTrustPublicBatch`** (поиск).
- **Формула «надёжности» (0–100, публичный процент):** старт 100; − до **38** по доле завершённых броней с диспутом; − **`min(30, 4×sum(points)+2×count)`** по штрафам; − **`min(12, 3×declined)`**; − **`min(15, 5×partnerCancel)`**; + бонус **`min(8, floor(cleanCompleted/5))`**; кламп **48–100**. Если нет ни одного сигнала — **`reliabilityPercent: null`**, **`tier: NEW`**. **Tier:** **`TOP`** при проценте ≥96, **`cleanCompleted`≥8**, сумма штраф-баллов ≤2 и ≤1 бронь с диспутом среди завершённых; **`STRONG`** при ≥88; иначе **`STANDARD`**. С **Stage 16.0** те же вычитания применяются к **взвешенным** метрикам (recency), см. §0.15. С **Stage 17.0** — доп. бонус/штраф по SLA чата и условие TOP по среднему ответу, см. §0.16. С **Stage 18.0** — учёт **звёзд отзывов гостя** (`reviews`) и единый rollup в **`ReputationService`**, см. §0.17. С **Stage 19.0** — даже при «сыром» балле **TOP** недоступен без порога **4.2★** при **≥5** отзывах (см. §0.18).
- **UI:** **`PartnerTrustBadge`** (`components/trust/PartnerTrustBadge.jsx`) — в **`GostayloListingCard`** (результаты поиска/каталог), блок хоста **`GuestListingBodyBlock`** (карточка листинга), публичный профиль **`/u/[id]`** (партнёры). Данные: **`partnerTrust`** в ответах **`GET /api/v2/search`/`listings/search`** (обогащение в **`lib/api/run-listings-search-get.js`**), **`GET /api/v2/listings/[id]`**, **`GET /api/v2/profiles/[id]/public`** (роль PARTNER).
- **Доказательства к спору:** до **3** URL в **`POST /api/v2/disputes/create`** (`evidenceUrls`), сохраняются в **`disputes.metadata.evidence_urls`**; загрузка файлов — **`POST /api/v2/upload`** с **`bucket=dispute-evidence`** (allowlist в **`app/api/v2/upload/route.js`**). Миграция бакета: **`database/migrations/039_dispute_evidence_storage.sql`**. Админка **`/admin/disputes`** показывает превью вложений.

### 0.15 Stage 16.0 — Reputation ranking, partner health, recency
- **Поиск / каталог:** после фильтра доступности список **`availableListings`** пересортирован с учётом репутации владельца (**`sortListingsByReputationRanking`** в **`lib/api/run-listings-search-get.js`**): featured остаётся доминирующим (**`REPUTATION_SEARCH_FEATURED_WEIGHT`**), затем базовый порядок **`(n−index)×tierMultiplier` + additive `positionBoostByTier`** из **`lib/config/reputation-ranking.js`** (`TOP` / `STRONG` / …); с **Stage 17.0** добавляется **`computeSlaSearchBoost`** (см. §0.16). В **`meta`** ответа: **`reputationRankingApplied: true`**.
- **Recency (репутация):** в **`ReputationService`** события старше **~6 месяцев** (183 суток) получают **вес 0.5** при расчёте: доля споров по завершённым броням (вклад по `booking_id` = max вес по спорам на бронь), штрафы (`points×weight`), отмены/decline по timestamp. Формула процента — та же схема вычитаний, что §0.14, но на взвешенных метриках; порог **TOP** использует **`weightedDisputedUnits ≤ 1.05`** и **`penaltyPointsSumWeighted ≤ 2`**.
- **Гостевой тултип:** **`PartnerTrustBadge`** (Radix **`Tooltip`**) + агрегаты **12 мес** (`cancellations12m`, `cleanStayPercent12m`, …) через **`ReputationService.merge12mTooltipBatch`** после батча доверия в поиске и в **`getPartnerTrustPublic`**.
- **Кабинет партнёра:** **`GET /api/v2/partner/reputation-health`** — снимок, **criticalFactors**, **pathToTop**; UI **`components/partner/PartnerReputationSection.jsx`** (один fetch: **`PartnerHealthWidget`** + **`SuccessGuide`**) на **`/partner/dashboard`**.

### 0.16 Stage 17.0 — Response SLA, performance logs, search boost
- **Данные:** таблица **`partner_performance_logs`** (миграция **`database/migrations/040_partner_performance_logs.sql`**) — задержка **первого ответа партнёра** после сообщения гостя в том же треде (мс), уникальность **`(conversation_id, renter_message_id)`**. Запись сервером после успешного **`POST /api/v2/chat/messages`** и ответа из Telegram (**`lib/services/telegram/handlers/chat-inbound-reply.js`**), логика — **`tryLogPartnerInitialResponseAfterMessage`** в **`lib/services/partner-response-performance.js`**. С **Stage 20.0** в лог пишется **время без «тихих часов»** (см. §0.19).
- **Агрегат:** **`getSlaMetricsForPartners30d`** — среднее **`response_time_ms`** за **30 дней** на партнёра; в снимок репутации попадают **`avgInitialResponseMinutes30d`**, **`initialResponseSampleCount30d`**.
- **Формула процента (дополнение к §0.14):** при **`≥3`** замеров: если среднее **≤30 мин** — бонус **`+3`** п.; если **>4 ч** — штраф **`-5`** п. (константы **`lib/config/reputation-sla.js`**). **Tier TOP:** при **`≥3`** замеров среднее должно быть **<60 мин**; иначе TOP блокируется (остаётся **STRONG**/ниже при высоком «денежном» балле).
- **Поиск:** к базовому рангу добавляется **`computeSlaSearchBoost(avgMinutes, count)`** — при **`count≥3`** линейно от **`SLA_RESPONSE_BOOST`** (быстро) к **`-SLA_RESPONSE_RANKING_PENALTY`** (медленно); пороги минут и **`SLA_RESPONSE_BOOST`** — **`lib/config/reputation-ranking.js`**.
- **UI:** тултип **`PartnerTrustBadge`** — строка «обычно в течение **N** мин» при достаточной выборке; **`PartnerHealthWidget`** — блок скорости ответа и фактор **`response_speed`** при штрафе.

### 0.17 Stage 18.0 — Репутация: единый сервис + «конституция» репо
- **SSOT:** вся агрегация для **публичного балла партнёра** и кабинета — **`ReputationService`** (`computePartnerReliabilitySnapshot`, `getPartnersTrustPublicBatch`, `summarizeGuestReviewRatings`, rollup **`reviews`** по листингам **`owner_id`**, счётчик **`guest_reviews`** где **`author_id`** = партнёр — для прозрачности, без смешивания в чужой балл). Сырые списки отзывов по-прежнему **`GET/POST /api/v2/reviews`**; поле **`stats.averageRating`** считается через **`ReputationService.summarizeGuestReviewRatings`**.
- **Peer (гость→хост):** при **`completedTotal ≥ 1`** и **`≥5`** отзывов: средняя **≥4.5★** — небольшой **бонус** к сырому баллу; **≤3.0★** — **штраф** (константы **`lib/config/reputation-peer-reviews.js`**). Фактор **`guest_reviews_low`** в **`buildCriticalFactors`**; подсказка пути к TOP при слабой средней.
- **Онбординг партнёра:** **`components/partner/SuccessGuide.jsx`** (внутри **`PartnerReputationSection`**) — уровни NEW → STANDARD/STRONG → TOP, чеклист (SLA, споры, отмены, отзывы, порог **4.2★** для TOP), баннер при **`topBlockedByGuestReviews`**.
- **Правила для Cursor:** **`.cursorrules`** — запрет дублирования логики, опора на паспорт, порог **300 строк** на рефакторинг, единый контракт заказа (**`toUnifiedOrder` / `UnifiedOrderCard`**), удаление мёртвого кода.

### 0.18 Stage 19.0 — Reputation modular split, TOP guest-review floor, proactive nudges
- **Модуль репутации (лимит ~300 строк на файл):** публичный импорт без смены путей — **`lib/services/reputation.service.js`** → **`lib/services/reputation/index.js`** (**`ReputationService`**). Внутри пакета **`lib/services/reputation/`**: **`constants.js`**, **`formula.js`** (в т.ч. **`computeReliabilityFromCounts`**, **`buildPathToTop`**), **`data-provider.js`** (Supabase-агрегаты), **`snapshot.js`** (**`computePartnerReliabilitySnapshot`**), **`dto.js`** (**`trustPublicFromSnapshot`** / публичный DTO).
- **Жёсткий пол для TOP по отзывам гостя:** при **`guestReviewCount ≥ 5`** средняя по **`reviews`** (гость→хост) должна быть **≥ 4.2★**; иначе расчётный tier **TOP** принудительно понижается до **STANDARD**, флаг **`topBlockedByGuestReviews`** в снимке; пороги в **`lib/config/reputation-peer-reviews.js`** (**`REPUTATION_PEER_TOP_MIN_AVG_STARS`**, **`REPUTATION_PEER_TOP_MIN_REVIEW_COUNT`**). Фактор **`guest_reviews_top_floor`** в health; **`SuccessGuide`** показывает баннер при блокировке.
- **Telegram SLA nudge:** крон **`GET/POST /api/cron/partner-sla-telegram-nudge`** (секрет **`CRON_SECRET`**, как прочие кроны) → **`runPartnerSlaTelegramNudges`** (**`lib/services/partner-sla-telegram-nudge.js`**): если в активном диалоге последнее сообщение от гостя ждёт ответа партнёра **>30 мин**, партнёру уходит предупреждение в Telegram (дедуп — **`database/migrations/041_partner_sla_nudge_events.sql`**). Расписание в **`vercel.json`** — каждые **10** минут (на Hobby внешний планировщик может дублировать с тем же секретом).
- **Pre-dispute (гость):** в **`components/orders/UnifiedOrderCard.jsx`** перед эскалацией — шаг «связаться с партнёром»; **`POST /api/v2/bookings/[id]/guest-help-partner-nudge`** шлёт партнёру push **`PARTNER_GUEST_HELP_NUDGE`** (**`lib/services/push.service.js`**).

### 0.19 Stage 20.0 — Fair SLA quiet hours + mediation gate (disputes)
- **Археология «тихих часов»:** персональные поля **`profiles.quiet_mode_enabled`**, **`quiet_hour_start`**, **`quiet_hour_end`** + UI **`/renter/settings`** (и **`PATCH /api/v2/auth/me`**) — изначально для **отложенного FCM / Premium Quiet** (**`lib/services/push.service.js`**, **`public/push-visibility-policy.js`**). Часовой пояс push-получателя исторически брался из **`user_push_tokens.device_info.timezone`**; календарь листинга — **`LISTING_DATE_TZ`** (**`lib/listing-date.js`**). Отдельной колонки timezone у **`listings`** нет; опциональный override: **`listings.metadata.timezone`** (IANA), иначе SSOT — env **`LISTING_DATE_TZ` / `NEXT_PUBLIC_LISTING_DATE_TZ`** (по умолчанию **Asia/Bangkok**).
- **SSOT активности партнёра (fair SLA):** **`lib/services/availability.service.js`** — **`resolvePartnerQuietContext`**, **`adjustResponseDelayMsForQuietHours`**, окно по умолчанию **23:00–08:00** в TZ листинга (**`lib/config/availability-quiet-defaults.js`**); при **`quiet_mode_enabled`** используются часы профиля, интерпретируемые в том же TZ листинга.
- **Интеграция SLA:** **`tryLogPartnerInitialResponseAfterMessage`** вычитает минуты, попавшие в тихое окно, из **`response_time_ms`** перед insert в **`partner_performance_logs`**.
- **Медиация 60 мин (настраиваемо):** **`lib/config/partner-mediation.js`** — **`PARTNER_HELP_MEDIATION_MS`** (env **`PARTNER_HELP_MEDIATION_MS`**). Статус **`PENDING_MEDIATION`** в **`disputes`** (**`database/migrations/042_disputes_pending_mediation.sql`**): первый сабмит гостя из **`POST /api/v2/disputes/create`** создаёт запись **без** **`freeze_payment`**; повторный сабмит после дедлайна **апгрейдит** кейс в **`OPEN`** и включает заморозку + прежние side-effects (**`DisputeService`**). Партнёр/стаff по-прежнему открывают сразу **`OPEN`**. Репутация и merge12m **игнорируют** **`PENDING_MEDIATION`** в выборках по спорам (**`lib/services/reputation/data-provider.js`**).
- **UI:** **`UnifiedOrderCard`** — таймер и блокировка кнопки до **`unlockAt`**; коды API **`phase`**, **`MEDIATION_WINDOW_ACTIVE`**.

### 0.20 Stage 21.0 — Emergency bypass, IANA TZ on listings, push quiet SSOT, mediation cron
- **«Красная кнопка» (сервер, исторически):** **`POST /api/v2/bookings/[id]/emergency-contact`** — аудит в **`bookings.metadata.emergency_contact_events[]`**, партнёру уходит **`RENTER_EMERGENCY_CONTACT`** с **`emergencyBypass: true`** (FCM не в silent-режиме из‑за тихих часов). С **Stage 24.0** допуск по жизненному циклу см. **`canRenterUseEmergencyContactBooking`** (**`lib/emergency-contact-eligibility.js`**), а видимость красной кнопки в UI — по **`GET .../emergency-context`** и **`isPartnerInQuietHoursNow`**.
- **IANA в визарде:** шаг локации (**`StepLocation.jsx`**) — выбор TZ из списка + «по карте» (**`guessIanaTimezoneFromLatLon`**); сохранение в **`listings.metadata.timezone`** (нормализация в **`normalizePartnerListingMetadata`**).
- **Push:** **`lib/services/push.service.js`** — расчёт silent для **`NEW_MESSAGE`** через **`resolvePartnerQuietContext`** (без локальных 22:00/device-only математик); в **`POST /api/v2/chat/messages`** в payload пуша добавлены **`bookingId` / `listingId`** для привязки к TZ листинга.
- **Крон:** **`GET/POST /api/cron/dispute-mediation-monitor`** ( **`CRON_SECRET`** ) → **`DisputeService.processStaleMediationDisputes`**: **`PENDING_MEDIATION`** старше **24 ч** — если гость (**`opened_by`**) писал в **`messages`** после **`disputes.created_at`** → **`OPEN`** + прежние side-effects; иначе **`CLOSED`** с **`metadata.closed_reason = mediation_idle_no_guest_chat`**. Расписание: **`vercel.json`** (каждые **6** ч).

### 0.21 Stage 22.0 — Emergency protocol: friction, rate limit, admin audit
- **UX (гость):** перед **`POST /api/v2/bookings/[id]/emergency-contact`** — модальный чеклист в **`components/orders/UnifiedOrderCard.jsx`** (минимум один из флагов **`health_or_safety`**, **`no_property_access`**, **`disaster`**); тело запроса — **`{ checklist: { … } }`**. Парсинг и валидация — **`lib/emergency-contact-protocol.js`** (**`parseEmergencyChecklistFromBody`**).
- **Анти-абьюз:** не более **одного** успешного вызова на бронь за **24 ч** (**`EMERGENCY_CONTACT_WINDOW_MS`**, **`hasEmergencyContactWithinWindow`** по **`metadata.emergency_contact_events`**). При повторе — **HTTP 429**, **`code: EMERGENCY_RATE_LIMIT`**, **`error: RATE_LIMIT`**; клиент показывает **`orderHelp_emergencyRateLimited`**. Исключение: **`metadata.emergency_contact_rate_limit_exempt === true`** (переключатель админа).
- **Запись события:** каждый успешный вызов добавляет элемент в **`bookings.metadata.emergency_contact_events[]`**: **`at`**, **`actor_id`**, **`source`**, **`checklist`**, **`push`** ( **`success`**, **`sent`**, **`failed`**, **`skipped`**, **`error`** ), **`abuse`** (**`marked`**, **`marked_at`**, **`marked_by`** ).
- **Админка брони:** **`/admin/bookings/[id]`** — блок **Trust & Safety Audit** (логи экстренных вызовов) + **`POST /api/v2/admin/bookings/[id]/emergency-actions`** (**`mark_abuse`**, **`rate_limit_exempt`**). Из спора — ссылка «Логи экстренной связи» на **`/admin/bookings/{id}`** (**`app/admin/disputes/page.js`**).
- **Пульс платформы:** **`GET /api/v2/admin/health`** → **`trustSafety.emergencyContacts24h`** + **`trustSafety.emergencyRecentBookings`** (ссылки на **`/admin/bookings/[id]`**); UI — **`app/admin/health/page.jsx`**.

### 0.22 Stage 23.0 — Incident response: Telegram pulse, support escalation, SMS stub
- **Telegram (реальное время):** после успешного **`POST /api/v2/bookings/[id]/emergency-contact`** — **`notifyAdminEmergencyTelegram`** (**`lib/emergency-contact-admin-notify.js`**) в админскую группу (**`TELEGRAM_ADMIN_GROUP_ID`**, при **`TELEGRAM_SUPPORT_TOPIC_ID`** — в топик поддержки): бронь, объект, чеклист, ссылка на **`/admin/bookings/{id}`**.
- **Эскалация при лимите:** **`POST /api/v2/bookings/[id]/emergency-support-ticket`** (гость-владелец брони) — гарантирует **`conversations`** (**`ensureBookingConversation`**), вставляет сообщение с **`metadata.system_key = emergency_rate_limit_context`**, **`hidden_from_recipient: true`** (хост не видит в **`GET /api/v2/chat/messages`**), **`metadata.emergency_support_context`** (контекст для staff), **`is_priority`**, **`PushService.notifyStaffSupportEscalation`**, дублирующий короткий пост в Telegram support topic. Дедуп **2 ч** по последним сообщениям. UI: **`UnifiedOrderCard`** — кнопка **«Написать в поддержку»** после **`EMERGENCY_RATE_LIMIT`**.
- **SMS (заглушка):** при **`checklist.health_or_safety === true`** после успешного экстренного вызова — **`sendEmergencySMS`** (**`lib/services/emergency-contact-protocol.js`**, `console.log` с телефоном партнёра из **`profiles.phone`**).

### 0.23 Stage 24.0 — Super-App terminology + smart emergency visibility
- **Терминология:** **`.cursorrules`** — раздел **Super-App Terminology** (канон: **Listing / Partner / Renter|Client**, избегать **Host / Apartment / Room** в нейтральной логике). Первичный аудит строк заказа/помощи — **`lib/translations/ui.js`** (**`orderHelp_*`**, **`partnerTrust_reliableHost`** → партнёр).
- **Экстренный контакт до услуги:** **`AvailabilityService.isEmergencyBypassAllowed`** опирается на **`canRenterUseEmergencyContactBooking`** (статусы вроде **`CONFIRMED`**, **`AWAITING_PAYMENT`**, **`PAID`**, **`PAID_ESCROW`**, **`CHECKED_IN`**, **`THAWED`** + окно **14 дней** после **`check_out`**), а **не** на **`canOpenOfficialDispute`** (у спора остаётся своё «рано до заезда»).
- **Умная кнопка:** **`GET /api/v2/bookings/[id]/emergency-context`** (рентер) → **`bookingEligible`** + **`partnerInQuietHours`** (**`isPartnerInQuietHoursNow`**). В **`UnifiedOrderCard`** красная «Экстренная связь» по умолчанию только при **`partnerInQuietHours`**; иначе CTA **«Написать в чат»**. В модалке — **`orderHelp_emergencyNightDisclaimer`** (ночь / ЧП / лимит 24 ч). См. **Stage 25.0** — флаг **`NEXT_PUBLIC_EMERGENCY_ALWAYS_VISIBLE`** и адаптивный второй пункт чеклиста.

### 0.24 Stage 25.0 — Super-App copy + category-aware emergency checklist
- **Коммуникации:** премиум-транзакционные письма — **`lib/services/email.service.js`** (в т.ч. **`bookingRequested`**, **`newLeadAlert`**, **`partnerApproved`** с RU/EN/ZH/TH там, где добавлено); общие фразы брони — **`lib/email/booking-email-i18n.js`**. Пуш-шаблоны — **`lib/services/push.service.js`** (**`BOOKING_REQUEST`**, **`CHECKIN_REMINDER`**, **`REVIEW_REMINDER`**, **`PARTNER_GUEST_REVIEW`**, **`PARTNER_GUEST_HELP_NUDGE`**, **`RENTER_EMERGENCY_CONTACT`**, тег FCM **`emergency_partner_contact`**).
- **Категория для экстренного UI:** **`resolveEmergencyServiceKindFromCategorySlug`** / **`resolveEmergencyServiceKindFromListing`** в **`lib/emergency-contact-protocol.js`**; API контекста возвращает **`emergencyServiceKind`** (**`stay` \| `transport` \| `service` \| `tour`**) для согласованности с клиентом. Второй чекбокс модалки — ключи **`orderHelp_emergencyCheck_access`** (дефолт), **`orderHelp_emergencyCheck_access_transport`**, **`orderHelp_emergencyCheck_access_service`** в **`lib/translations/ui.js`** (RU/EN/ZH/TH).
- **Длительность в «Мои бронирования»:** карточка гостя — **`app/renter/bookings/page.js`** (**`durationPhraseForBookingEmail`** + **`category_slug`**); партнёрский дашборд «Ближайшие заезды» — **`app/api/v2/partner/stats/route.js`** (поле **`categorySlug`** в **`upcoming`**) + **`app/partner/dashboard/page.js`**.

### 0.25 Stage 26.0 — Category intelligence (wizard, SuccessGuide, reviews)
- **Визард листинга:** шаг «Основное» — обязательный **`listingServiceType`** (`stay` \| `transport` \| `service` \| `tour`) перед выбором **`categoryId`**; список категорий фильтруется (**`lib/partner/listing-service-type.js`**: **`inferListingServiceTypeFromCategorySlug`**, **`categorySlugMatchesListingServiceType`**, **`defaultMetadataForListingServiceType`** для TZ и полей metadata). UI — **`app/partner/listings/new/components/StepGeneralInfo.jsx`**, состояние — **`ListingWizardContext`** + **`wizard-constants.js`**; строки — **`lib/translations/listings-partner.js`** (`wizardServiceType*`).
- **SuccessGuide (обновлено Stage 27.0):** доминирующий slug по-прежнему из **`GET /api/v2/partner/reputation-health`**; первый пункт чеклиста — **`getSuccessGuideOpsRuleLine(inferListingServiceTypeFromCategorySlug(dominantCategorySlug), language)`** из **`lib/config/success-guide-content.js`** (редактирование копирайта без **`lib/translations/ui.js`**).
- **Форма отзыва (обновлено Stage 27.0):** см. **0.26** — динамические подписи к тем же ключам **`ratings`** в API.
- **Конституция доков:** **`.cursor/rules/gostaylo-docs-constitution.mdc`** — правило про учёт **`category_slug`** при новом функционале.

### 0.26 Stage 27.0 — Динамические критерии отзывов + SLA/календарь по доминирующей категории
- **Идея:** ключи оценки в **`POST` отзыва** остаются каноничными (**`cleanliness`**, **`accuracy`**, **`communication`**, **`location`**, **`value`**) — меняются только **подписи и иконки** в UI в зависимости от **`listing.category_slug`** (через **`inferListingServiceTypeFromCategorySlug`**). Если slug неизвестен — **`getReviewCriteriaRows`** откатывается на **`reviewForm_dim_*`** в **`lib/translations/ui.js`**.
- **Конфиг:** **`lib/config/review-criteria-labels.js`** + общий **`normalizeUiLang`** в **`lib/config/lang-normalize.js`**.
- **Гость — «Мои бронирования»:** **`app/renter/bookings/page.js`** передаёт в **`ReviewModal`** явный **`categorySlug`** (дублирует вывод из `listing`); в карточке брони — **`ListingCategoryIcon`** (**`components/booking/ListingCategoryIcon.jsx`**, иконки Home / Car / User / MapPin).
- **Партнёр — SLA:** **`components/trust/PartnerHealthWidget.jsx`** под блоком скорости ответа показывает **`getPartnerSlaResponseContextLine`** из **`lib/config/partner-category-sla-hints.js`** по **`effData.dominantCategorySlug`**.
- **Партнёр — календарь:** **`app/partner/calendar/page.js`** использует **`usePartnerReputationHealthQuery`** (**`hooks/use-partner-reputation-health.js`**, общий ключ кэша с дашбордом) и полоску **`getPartnerCalendarDominantHint`**.

### 0.27 Stage 28.0 — Унифицированные отзывы + детализация цены + кэш reputation-health
- **Отзывы гостя (единый канал):** **`lib/reviews/post-renter-review.js`** (`POST /api/v2/reviews` с **`ratings`**); **`hooks/use-review-submission.js`** (загрузка фото при необходимости + toast + **`onSuccess`** для invalidate/refetch). Поверхность UI: **`components/review-modal.jsx`** + те же хуки на **`app/renter/bookings/page.js`**, **`app/my-bookings/page.js`**, **`app/renter/reviews/new/page.js`** (категория из **`listings.category_slug`**, см. **`mapBookingListingsJoin`** в **`lib/services/booking/query.service.js`** — join **`categories (slug)`**).
- **Детализация цены (Super-App):** **`lib/booking/guest-price-breakdown.js`** (`buildGuestPriceBreakdownFromBooking`) + **`components/orders/OrderPriceBreakdown.jsx`** в **`UnifiedOrderCard`** и **`BookingCard`** на **`app/renter/bookings/page.js`**; строки **`orderPrice_*`** в **`lib/translations/ui.js`**. Итог согласован с **`getGuestPayableRoundedThb`**.
- **Reputation-health без лишних запросов:** **`PartnerReputationSection`** переведён на **`usePartnerReputationHealthQuery`** (staleTime **5 мин**); календарь партнёра использует тот же query — повторный заход не бьёт API без необходимости.
- **SLA UI:** **`PartnerHealthWidget`** — акцентный блок с **`ListingCategoryIcon`**; для **`service`** дополнительно **`partnerHealth_slaServiceEmphasis`**.

### 0.1 CRITICAL: Telegram Webhook
```
Route: /api/webhooks/telegram
Status: PUBLIC (no auth required)
Runtime: nodejs
Pattern: Immediate Response + Fire-and-Forget
```

**Inline approve/decline:** только **`lib/services/telegram/handlers/callbacks.js`** (callback_data `approve_booking_*` / `decline_booking_*`). Дубликат **`/api/telegram/booking-callback`** удалён (Stage 2.5). «Ваш доход» в ответе после approve берётся из **`bookings.partner_earnings_thb`**, с числовым фолбэком. Кнопка «Открыть в приложении» в уведомлении о новой брони ведёт на **`/partner/bookings?booking={id}`** (скролл к карточке). Списки **`/partner/bookings`** и **`/renter/bookings`** обогащаются **`conversationId` / `conversation_id`** из **`conversations.booking_id`**; кнопка **«Перейти в чат»** → **`/messages/[conversationId]`**. Гостевые TG/push (check-in, review reminder) и письма об оплате — deep link **`/renter/bookings?booking={id}`**.

**This route MUST:**
- Return 200 OK immediately (within 100ms)
- Process all logic asynchronously (fire-and-forget)
- Never await external API calls before returning
- Be excluded from any auth middleware

### 0.2 Notification Topics (Telegram)
| Topic | Thread ID | Purpose |
|-------|-----------|---------|
| BOOKINGS | 15 | New bookings, confirmations |
| FINANCE | 16 | Payments, payouts |
| NEW_PARTNERS | 17 | Partner registrations |

### 0.2a Partner onboarding & KYC (Phase 1.8)
- **Канон:** **`POST /api/v2/partner/applications`** — логика в **`lib/services/partner-application.service.js`** (`handlePartnerApplicationPost`, `submitPartnerApplicationCore`). **`PATCH /api/v2/partner/applications`** — **`handlePartnerApplicationPatchKyc`**: только **`verificationDocUrl`**, заявка **`PENDING`** (дозагрузка KYC). **`POST /api/v2/partner/apply`** вызывает тот же POST handler (обратная совместимость).
- **Тело:** **`phone`**, **`experience`**, опционально **`socialLink`**, **`portfolio`**, обязательно **`verificationDocUrl`** (строка URL после загрузки в Storage). Идентификатор пользователя — только **`getUserIdFromSession()`**; поле **`userId` в JSON** опционально и должно совпадать с сессией.
- **Загрузка файла:** **`POST /api/v2/upload`** с **`bucket: verification_documents`**; переиспользуемый UI — **`components/kyc-uploader.jsx`** (`/renter/profile`, **`/profile`**).
- **Админка:** список **`/admin/partners`** — в карточке заявки кликабельная ссылка **«Документ KYC»** по **`verification_doc_url`**; деталь **`/admin/partners/[id]`** без изменений по смыслу.
- **Доступ `/partner/*`:** без изменений — **`app/partner/layout.js`** опрашивает **`GET /api/v2/auth/me`**, роли **`PARTNER` / `ADMIN` / `MODERATOR`**; одобрение заявки — **`POST /api/v2/admin/partners`** с **`action: approve`** → **`profiles.role = PARTNER`**, **`verification_status = VERIFIED`**.
- **KYC Storage (Phase 1.9):** `/_storage/verification_documents/...` в **`next.config.js`** проксирует на **public** object URL; внешняя секретность — через неугадываемые пути + **ADMIN-only** **`GET /api/v2/admin/verification-doc?path=`** → **`createSignedUrl`** (админ UI использует **`toAdminVerificationDocProxyUrl`**). В Telegram по заявке партнёра ссылка на **карточку в админке**, не на сырой файл.
- **Debug Telegram:** **`GET /api/v2/debug/test-telegram`** — ADMIN + (dev **или** **`ENABLE_DEBUG_TELEGRAM=1`**), тест **`sendToAdminGroup('Test OK')`**, в ответе массив **`runbook`**.
- **Ledger → Telegram:** при успешной записи проводки захвата платежа (**`LedgerService.postPaymentCaptureFromBooking`**) — уведомление в топик **FINANCE** (**`notifyLedgerGuestPaymentClearingPosted`**).

### 0.3 Escrow Security Message
```
🔒 Ваши средства защищены системой Эскроу Gostaylo и выплачиваются 
владельцу только после подтверждения заселения.
```
**This message MUST appear in:**
- Payment confirmation emails
- Booking confirmation pages
- Payment success notifications

### 0.4 Documentation & AI workflow

- **Цель:** манифест и паспорт отражают текущий код; расхождения устраняются правкой кода или дока в одном PR.
- **Файлы:** `AGENTS.md` (вход), `.cursorrules`, `.cursor/rules/gostaylo-docs-constitution.mdc` (всегда для Cursor), шаблон PR **`.github/pull_request_template.md`** (чеклист доков).
- **Когда обновлять:** любые изменения в `app/api/**`, `migrations/**`, RLS, поведении продукта или зафиксированном в доках UX — правки в **`docs/TECHNICAL_MANIFESTO.md`** и в этом файле; нормативные решения — **`ARCHITECTURAL_DECISIONS.md`**.
- **Realtime JWT (антилуп):** клиент **`lib/chat/realtime-session-jwt.js`** + **`components/supabase-realtime-auth-sync.jsx`** — см. манифест §5 (bullet `applyRealtimeSessionJwt`).

### 0.5 Push + Realtime Reliability (current state)

- **Push dispatch lifetime (serverless-safe):** `POST /api/v2/chat/messages` отправляет пуш через фоновые задачи с `waitUntil` (`dispatchBackgroundTask`), чтобы FCM-отправка не обрывалась после HTTP-ответа.
- **Traceability in logs:** в проде используются стабильные метки **`[PUSH_FLOW]`** (этапы цепочки) и **`[PUSH_SENT]`** (результат FCM с userId и token snippet).
- **SW readiness:** `components/push-client-init.jsx` ждёт `navigator.serviceWorker.ready` до `getToken`; при провале регистрации токена делает retry через 5 сек.
- **Premium Quiet Policy (v3):** сервер — все **`NEW_MESSAGE`** (кроме **`FCM_INSTANT_PUSH_DEBUG`**) в отложенную очередь **`lib/services/push.service.js`** (**`PREMIUM_CHAT_PUSH_DELAY_MS` ~40 с**), перед FCM проверка **`messages.is_read`**. Клиент — **`public/push-visibility-policy.js`** (`shouldSuppressSystemNotificationForNewMessage`): для типа **`NEW_MESSAGE`** не вызывается **`showNotification`**, если есть видимая вкладка **того же origin**, что и SW; PWA/браузер в фоне (**`visibilityState !== 'visible'`**) — баннер не подавляется.
- **Realtime recovery:** при reconnect/focus/visibilitychange Realtime JWT переустанавливается без refresh страницы; backoff-слой избегает синхронного `removeChannel` в callback, чтобы исключить рекурсивные сбои.
- **Тред чата (reliability):** `useRealtimeMessages` + `subscribeRealtimeWithBackoff` (`minBackoffDelayMs` 2 с) — heartbeat **45 с** без событий на видимой вкладке → пересоздание канала; после reconnect **`onResync`** в `use-chat-thread-messages` дергает **`GET /api/v2/chat/messages`**; при возврате на вкладку — тот же resync.

### 0.6 Contact Leakage Protection (commission safety)

- Канал общения renter↔partner должен оставаться платформенным; прямой обмен контактами в чате рассматривается как риск обхода комиссии.
- Политика и целевая архитектура: **`docs/ANTI_DISINTERMEDIATION_POLICY.md`** (server-first фильтр в `POST /api/v2/chat/messages`, риск-скоринг, telemetry, moderation escalation).
- Текущий production baseline: флаг **`messages.has_safety_trigger`** + событие **`CONTACT_LEAK_ATTEMPT`** в `critical_signal_events`; у получателя в UI показывается дружелюбный safety-блок с объяснением эскроу.
- Тексты safety-блока и страницы справки — **`getUIText`** (`chatSafety_*`, `escrowProtection_*` в **`lib/translations/ui.js`**); публичный маршрут **`/help/escrow-protection`** (`app/help/escrow-protection/page.js`).
- **Режимы (ENV `CONTACT_SAFETY_MODE`):** **`ADVISORY`** — предупреждение у получателя, текст сообщения не меняется; **`REDACT`** — в БД сохраняется текст с маскировкой контактов (`maskContactInfo`); **`BLOCK`** — сообщение не отправляется (**403** `CONTACT_SAFETY_BLOCKED`), телеметрия и страйк всё равно фиксируются. Клиент: **`lib/contact-safety-mode.js`**.
- **Страйки:** колонка **`profiles.contact_leak_strikes`** (int, default 0), инкремент RPC **`increment_contact_leak_strikes`** при каждом срабатывании детектора (включая BLOCK). Миграция **`database/migrations/025_contact_leak_strikes_and_rpc.sql`**.
- **Админ-дашборд:** **`/admin/security`** — вкладка «Анализ утечек»; **`GET /api/v2/admin/contact-leak-dashboard`** (только **`profiles.role === 'ADMIN'`**, **`lib/admin-security-access.js`**) — счётчики за 24ч / 7д / 30д, оценка «потери комиссии» в **THB** с конвертацией в **USD/RUB** через **`getDisplayRateMap({ applyRetailMarkup: false })`** + **`convertAmountThbToCurrency`** (**`lib/services/currency.service.js`**, таблица **`exchange_rates`**; без хардкода курсов). Базовый средний чек: **`system_settings.general.chatSafety.estimatedBookingValueThb`**; ENV **`CONTACT_LEAK_ESTIMATED_BOOKING_THB`** при наличии переопределяет для дашборда.
- **Настройки безопасности чата (админ):** **`/admin/settings`** — блок в **`general.chatSafety`**: **`autoShadowbanEnabled`**, **`strikeThreshold`** (по умолчанию 5), **`estimatedBookingValueThb`**. Авто-shadowban **только** при **`autoShadowbanEnabled === true`**: при **`contact_leak_strikes` ≥ порога** сообщения с **`has_safety_trigger`** получают **`metadata.hidden_from_recipient`** и **не отдаются** получателю в **`GET /api/v2/chat/messages`** (**`lib/chat-message-visibility.js`**); пуш/Telegram получателю не шлются. Страйки **не** инкрементируются для **ADMIN/MODERATOR**. В **`critical_signal_events.detail`** пишется **`triggerTextSample`** (обрезанный исходный текст). API настроек: **`GET/PUT /api/admin/settings`**.

---

## 1. System Architecture

### 1.1 Stack Overview

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router) | 14.2.3 |
| Database | Supabase PostgreSQL | - |
| Auth | Supabase Auth | - |
| Storage | Supabase Storage | - |
| UI | Tailwind CSS + Shadcn/UI | 3.4.1 |
| State | React Hooks | 18.x |
| Notifications | Telegram Bot API + Resend | - |
| Deployment | Vercel | - |

### 1.2 Directory Structure

```
/app/
├── app/                          # Next.js App Router pages
│   ├── (public)/                 # Public routes (listings, checkout)
│   ├── admin/                    # Admin panel routes
│   ├── partner/                  # Partner dashboard routes
│   └── api/                      # API routes
│       ├── v2/                   # Version 2 API endpoints
│       ├── webhooks/             # Webhook handlers (CRITICAL)
│       │   └── telegram/         # Telegram bot webhook
│       └── [[...path]]/          # Legacy catch-all (deprecated)
├── lib/
│   ├── services/                 # Business logic services
│   │   ├── pricing.service.js    # Seasonal pricing calculator
│   │   ├── booking.service.js    # Booking orchestrator (API entry)
│   │   ├── booking/              # query / pricing snapshot / inquiry / creation
│   │   │   ├── query.service.js
│   │   │   ├── pricing.service.js
│   │   │   ├── inquiry.service.js
│   │   │   └── creation.js
│   │   ├── payments-v3.service.js # Payment orchestration (active)
│   │   ├── notification.service.js # Event hub (dispatch → email / TG / FCM)
│   │   ├── notifications/         # Stage 2.2: telegram, email (Resend), push re-export, formatting
│   │   ├── escrow.service.js   # Stage 2.3: PAID_ESCROW / cron thaw / balance
│   │   └── escrow/                # thaw, payout, balance, commission, utils, ledger-capture
│   ├── supabase.js               # Supabase client instances
│   └── currency.js               # Currency formatting
├── components/
│   ├── ui/                       # Shadcn/UI components
│   └── calendar-sync-manager.jsx # iCal sync UI
├── database/
│   └── migration_stage_25.sql    # Latest migration script
└── docs/
    └── TECHNICAL_MANIFESTO.md    # Extended documentation
```

---

## 2. Database Schema (Supabase PostgreSQL)

### КРИТИЧНО: типы ключей в проде (TEXT vs UUID)

В проекте **FannyRent (Supabase)** первичные и внешние ключи основных доменных таблиц — **`TEXT`**, а не нативный Postgres **`uuid`**. В частности:

- **`profiles.id`** — **TEXT**
- **`listings.id`**, **`bookings.id`**, **`conversations.id`**, **`messages.id`** — **TEXT**
- все **`owner_id` / `renter_id` / `partner_id` / `listing_id` / …** в таблицах ниже согласованы с этим типом

**При написании новых SQL-миграций** (в репозитории или в Supabase SQL Editor): не копируйте слепо шаблоны с **`uuid references profiles(id)`** — получите **ERROR 42804** (несовместимые типы). Либо используйте **`TEXT`** для FK на перечисленные таблицы, либо сначала проверьте тип родительской колонки в Dashboard.

**Prisma `schema.prisma`** может исторически отличаться; для SQL под живую БД ориентир — **этот документ (§2)** и фактическая схема Supabase.

### 2.1 Core Tables

#### `listings`
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT | NO | Primary key (e.g., `lst-abc123`) |
| `owner_id` | TEXT | NO | FK to `profiles.id` |
| `category_id` | TEXT | YES | FK to `categories.id` |
| `title` | TEXT | NO | Listing title |
| `description` | TEXT | YES | Full description |
| `district` | TEXT | YES | Location district |
| `address` | TEXT | YES | Full address |
| `base_price_thb` | NUMERIC | NO | Base price per night in THB |
| `base_currency` | TEXT/ENUM | YES | Canonical listing currency for FX markup logic (`THB`,`RUB`,`USD`,`USDT`) |
| `images` | JSONB | YES | Array of image URLs |
| `cover_image` | TEXT | YES | Primary image URL |
| `metadata` | JSONB | YES | **Extensible data store** |
| `sync_settings` | JSONB | YES | iCal sync configuration |
| `status` | TEXT | NO | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED` |
| `available` | BOOLEAN | YES | Availability flag |
| `is_featured` | BOOLEAN | YES | Featured listing flag |
| `commission_rate` | NUMERIC | YES | Custom commission % |
| `cancellation_policy` | ENUM | NO | **`flexible` / `moderate` / `strict`** — тир возврата (PR-#4); канон для Ledger |
| `min_booking_days` | INT | YES | Minimum stay |
| `max_booking_days` | INT | YES | Maximum stay |
| `rejection_reason` | TEXT | YES | Reason if rejected |
| `rejected_at` | TIMESTAMPTZ | YES | Rejection timestamp |
| `rejected_by` | TEXT | YES | Admin who rejected |
| `rating` | NUMERIC | YES | Average rating |
| `reviews_count` | INT | YES | Number of reviews |
| `views` | INT | YES | View counter |

**Critical JSONB Columns:**

```jsonc
// listings.metadata
{
  "seasonal_pricing": [
    {
      "id": "sp-uuid",
      "name": "High Season",
      "startDate": "2026-12-15",
      "endDate": "2027-01-15",
      "priceMultiplier": 1.3  // +30%
    },
    {
      "id": "sp-uuid2",
      "name": "Low Season",
      "startDate": "2026-05-01",
      "endDate": "2026-10-31",
      "priceMultiplier": 0.85  // -15%
    }
  ],
  "amenities": ["wifi", "pool", "parking"],
  "bedrooms": 3,
  "bathrooms": 2,
  "area_sqm": 150
}

// listings.sync_settings
{
  "enabled": true,
  "calendars": [
    {
      "id": "cal-uuid",
      "url": "https://airbnb.com/calendar/ical/xxx.ics",
      "platform": "airbnb",
      "lastSync": "2026-03-01T10:00:00Z",
      "status": "success"
    }
  ],
  "lastGlobalSync": "2026-03-01T10:00:00Z"
}
```

#### `bookings`
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT | NO | Primary key (e.g., `b-abc123`) |
| `listing_id` | TEXT | NO | FK to `listings.id` |
| `partner_id` | TEXT | NO | FK to `profiles.id` (listing owner) |
| `renter_id` | TEXT | YES | FK to `profiles.id` (authenticated user) |
| `status` | TEXT | NO | See status enum below |
| `check_in` | TIMESTAMPTZ | NO | Начало периода (услуга/транспорт — время; жильё — обычно 00:00 в TZ листинга) |
| `check_out` | TIMESTAMPTZ | NO | Конец периода (модель ночей **[check_in, check_out)** в календаре листинга) |
| `price_thb` | NUMERIC | NO | **Calculated total price** |
| `currency` | TEXT | YES | Display currency |
| `price_paid` | NUMERIC | YES | Actual amount paid |
| `exchange_rate` | NUMERIC | YES | Rate at payment time |
| `commission_thb` | NUMERIC | YES | Guest service fee amount (THB) |
| `taxable_margin_amount` | NUMERIC | YES | Taxable base snapshot (`guest_paid_thb - partner_earnings_thb`) |
| `rounding_diff_pot` | NUMERIC | YES | Pot amount from guest total rounding-up to nearest 10 |
| `applied_commission_rate` | NUMERIC | YES | Frozen host commission percent for settlement |
| `commission_paid` | BOOLEAN | YES | Commission settled flag |
| `listing_currency` | TEXT/ENUM | YES | Listing base currency frozen at booking creation |
| `net_amount_local` | NUMERIC | YES | Partner net in `listing_currency` (snapshot value) |
| `guest_name` | TEXT | YES | Guest full name |
| `guest_email` | TEXT | YES | Guest email |
| `guest_phone` | TEXT | YES | Guest phone |
| `special_requests` | TEXT | YES | Guest notes |
| `promo_code_used` | TEXT | YES | Applied promo code |
| `discount_amount` | NUMERIC | YES | Discount in THB |
| `pricing_snapshot` | JSONB | YES | Immutable pricing/settlement snapshot (`v1`, `fee_split_v2`, `settlement_v3`) |
| `metadata` | JSONB | NO | Extensible JSON (default `{}`); payment initiate/confirm, gateway refs — миграция **`030_financial_phase1_5_ledger_booking_metadata.sql`** |
| `conversation_id` | TEXT | YES | FK to `conversations.id` |

**Booking Status Enum:**
```
PENDING → AWAITING_PAYMENT → CONFIRMED → CHECKED_IN → COMPLETED
                          ↘ CANCELLED
```

#### `profiles`
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT | NO | Primary key (matches Supabase Auth UID) |
| `role` | TEXT | NO | `ADMIN`, `PARTNER`, `RENTER`, `MODERATOR` |
| `email` | TEXT | NO | Unique email |
| `first_name` | TEXT | YES | First name |
| `last_name` | TEXT | YES | Last name |
| `phone` | TEXT | YES | Phone number |
| `telegram_id` | TEXT | YES | Telegram user ID |
| `telegram_username` | TEXT | YES | Telegram @username |
| `telegram_linked_at` | TIMESTAMPTZ | YES | When Telegram was linked |
| `quiet_mode_enabled` | BOOLEAN | NO | Personalized quiet-hours toggle for push |
| `quiet_hour_start` | TIME | NO | Quiet-hours start (local device TZ) |
| `quiet_hour_end` | TIME | NO | Quiet-hours end (local device TZ) |
| `custom_commission_rate` | NUMERIC | YES | Partner-specific rate |
| `available_balance` | NUMERIC | YES | Withdrawable balance |
| `escrow_balance` | NUMERIC | YES | Funds in escrow |
| `preferred_payout_currency` | ENUM | YES | Partner payout display/settlement preference (`RUB`,`THB`,`USDT`,`USD`) |
| `verification_status` | TEXT | YES | KYC status |
| `referral_code` | TEXT | YES | Unique referral code |
| `referred_by` | TEXT | YES | Referrer's code |
| `contact_leak_strikes` | INTEGER | NO | Server-incremented on chat contact-safety detector hits (migration `025`) |

#### `payout_methods`
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT | NO | Primary key (`pm-*`) |
| `name` | TEXT | NO | Method label in admin/partner UI |
| `channel` | ENUM/TEXT | NO | `CARD` / `BANK` / `CRYPTO` |
| `fee_type` | ENUM/TEXT | NO | `percentage` / `fixed` |
| `value` | NUMERIC | NO | Fee value (percent or fixed amount) |
| `currency` | TEXT | NO | Rail settlement currency (`RUB`,`THB`,`USDT`,`USD`) |
| `min_payout` | NUMERIC | NO | Minimum base payout for this rail |
| `is_active` | BOOLEAN | NO | Availability flag |
| `metadata` | JSONB | NO | Optional rail details |

#### `partner_payout_profiles`
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT | NO | Primary key (`pp-*`) |
| `partner_id` | TEXT | NO | FK to `profiles.id` |
| `method_id` | TEXT | NO | FK to `payout_methods.id` |
| `data` | JSONB | NO | Partner payout реквизиты (`CARD`/`BANK`/`CRYPTO` fields) |
| `is_verified` | BOOLEAN | NO | Verification flag for ops/KYC flow |
| `is_default` | BOOLEAN | NO | Default rail for automatic/manual payout |

#### Ledger (double-entry, THB)
| Table | Purpose |
|-------|---------|
| `ledger_accounts` | План счетов: системные котлы (`GUEST_PAYMENT_CLEARING`, `PLATFORM_FEE`, `INSURANCE_FUND_RESERVE`, `PROCESSING_POT_ROUNDING`) + строки **`PARTNER_EARNINGS`** с **`partner_id`**. |
| `ledger_journals` | Группа проводок на событие (например одна запись на **`booking_payment_capture:{booking_id}`**). |
| `ledger_entries` | Строки **DEBIT/CREDIT**, сумма **`amount_thb`**, ссылка на **`ledger_accounts`**. |

#### `conversations`
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT | NO | Primary key |
| `listing_id` | TEXT | YES | Associated listing |
| `owner_id` | TEXT | YES | Listing owner |
| `partner_id` | TEXT | YES | Partner in conversation |
| `renter_id` | TEXT | YES | Renter in conversation |
| `admin_id` | TEXT | YES | Admin in conversation |
| `type` | TEXT | YES | `INQUIRY`, `SUPPORT`, `MODERATION` |
| `status` | TEXT | YES | `OPEN`, `CLOSED` |

#### `messages`
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT | NO | Primary key |
| `conversation_id` | TEXT | NO | FK to `conversations.id` |
| `sender_id` | TEXT | NO | FK to `profiles.id` |
| `sender_role` | TEXT | NO | Role at send time |
| `sender_name` | TEXT | YES | Display name |
| `message` | TEXT | NO | Message content |
| `type` | TEXT | YES | `TEXT`, `IMAGE`, `SYSTEM` |
| `metadata` | JSONB | YES | Attachments, etc. |
| `is_read` | BOOLEAN | NO | Read receipt flag |

#### `user_push_tokens` (FCM, multi-device)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `user_id` | TEXT | NO | FK `profiles.id` |
| `token` | TEXT | NO | FCM registration token, unique |
| `device_info` | JSONB | NO | `surface`, `userAgent`, **`timezone`** (IANA), … |
| `last_seen_at` | TIMESTAMPTZ | YES | Heartbeat / register (Smart Push) |
| `created_at` | TIMESTAMPTZ | NO | Default now |

#### `chat_push_delivery_batch` (отложенный FCM, anti-spam)
Одна строка на пару (**получатель**, **отправитель**) до срабатывания окна **~40 с** (**`PREMIUM_CHAT_PUSH_DELAY_MS`** в **`push.service.js`**, Premium Quiet v3). Если serverless-процесс не завершил лидер-доставку, hourly cron **`/api/cron/push-sweeper`** поднимает stale строки (10+ минут), форсирует доставку и очищает таблицу.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `recipient_id` | TEXT | NO | PK part, FK `profiles.id` |
| `sender_id` | TEXT | NO | PK part |
| `conversation_id` | TEXT | NO | Deep link |
| `sender_display_name` | TEXT | YES | Имя в пушe |
| `message_ids` | TEXT[] | NO | Пачка id из `messages` |
| `pending_tokens` | TEXT[] | NO | FCM-токены для доставки после окна |
| `window_deadline_at` | TIMESTAMPTZ | NO | Когда сработает отправка |
| `updated_at` | TIMESTAMPTZ | NO | Последнее слияние |

#### `critical_signal_events` (аудит, nightly)
Append-only события для отчётов (напр. **`PRICE_TAMPERING`** из **`recordCriticalSignal`**).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `signal_key` | TEXT | NO | e.g. `PRICE_TAMPERING` |
| `created_at` | TIMESTAMPTZ | NO | Default now |
| `detail` | JSONB | YES | Краткий контекст |

#### `ops_job_runs` (автономный бортовой журнал)
Единый операционный лог cron/background задач для модели No-Ops. Запись через `lib/ops-job-runs.js`: при сетевых сбоях (например `ECONNRESET`, `fetch failed`, 502/503/504) выполняется до четырёх попыток с экспоненциальной задержкой.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | BIGSERIAL | NO | Primary key |
| `job_name` | TEXT | NO | Идентификатор задачи (`push-sweeper`, `ical-sync`, `payouts`, ...) |
| `status` | TEXT | NO | `running` / `success` / `error` |
| `started_at` | TIMESTAMPTZ | NO | Время старта |
| `finished_at` | TIMESTAMPTZ | YES | Время завершения |
| `stats` | JSONB | NO | Метрики выполнения (counts, duration_ms, и т.п.) |
| `error_message` | TEXT | YES | Последняя ошибка (если была) |

#### `system_settings.general` (finance-relevant keys)
| Key | Type | Purpose |
|-----|------|---------|
| `guestServiceFeePercent` | NUMERIC | Guest-facing service fee percent (default 5.0) |
| `hostCommissionPercent` | NUMERIC | Host-side commission percent (default 0.0; partner override via `profiles.custom_commission_rate`) |
| `insuranceFundPercent` | NUMERIC | Insurance reserve share from platform margin (default 0.5) |
| `chatInvoiceRateMultiplier` | NUMERIC | Retail FX spread for cross-currency checkout/invoice |
| `defaultCommissionRate` | NUMERIC | Legacy fallback for host commission |
| `settlementPayoutDelayDays` | INTEGER | Delay from check-in to payout eligibility (0..60) |
| `settlementPayoutHourLocal` | INTEGER | Preferred payout processing hour (0..23) |

Admin UI (`/admin/settings`) now exposes these keys as a single "Settlement Policy & Fee Split" block with presets (`РФ`, `Таиланд`, `Global/Crypto`) and formula preview for operators.

---

## 3. Pricing System

### 3.1 Architecture

The pricing system uses `PricingService` (`/lib/services/pricing.service.js`) for ALL monetary calculations.

**Data Source:** `listings.metadata.seasonal_pricing` (JSONB array)

**Seasonal Pricing Schema:**
```typescript
interface SeasonalPrice {
  id: string;              // UUID
  name: string;            // "High Season", "Low Season"
  startDate: string;       // ISO date "YYYY-MM-DD"
  endDate: string;         // ISO date "YYYY-MM-DD"
  priceMultiplier: number; // 1.0 = base, 1.3 = +30%, 0.8 = -20%
}
```

### 3.2 PricingService Methods

| Method | Use Case | DB Call |
|--------|----------|---------|
| `calculateBookingPrice(listingId, checkIn, checkOut)` | Server-side full calculation | YES |
| `calculateBookingPriceSync(basePrice, checkIn, checkOut, seasonalPricing)` | Client-side real-time UI | NO |
| `calculateDailyPrice(basePrice, dateStr, seasonalPricing)` | Per-night calculation | NO |
| `calculateCommission(priceThb, partnerId)` | Commission calculation | YES |
| `validatePromoCode(code, bookingAmount, { listingOwnerId?, listingId? })` | Promo validation; `PARTNER` owner match; non-empty `allowed_listing_ids` requires `listingId` in list | YES |

### 3.3 Calculation Algorithm

```javascript
// Pseudo-code
for each night in booking:
  dailyPrice = basePrice
  for each season in seasonalPricing:
    if night.date >= season.startDate AND night.date <= season.endDate:
      dailyPrice = basePrice * season.priceMultiplier
      break
  totalPrice += dailyPrice
```

### 3.4 Revenue split (User total → Platform → Partner)

Canonical rates come from `system_settings.general` (`guestServiceFeePercent`, `hostCommissionPercent`, `insuranceFundPercent`) with partner override via `profiles.custom_commission_rate` for host commission.

```
subtotalThb        = PricingService total for the stay (THB, before guest fee)
guestFeeThb        = round(subtotalThb * (guestServiceFeePercent / 100))   // stored in bookings.commission_thb
guestTotalRawThb   = subtotalThb + guestFeeThb
roundingDiffPotThb = ceil(guestTotalRawThb / 10) * 10 - guestTotalRawThb   // bookings.rounding_diff_pot
userTotalThb       = guestTotalRawThb + roundingDiffPotThb
hostCommissionThb  = round(subtotalThb * (hostCommissionPercent / 100))     // affects partner payout
partnerPayoutThb   = subtotalThb - hostCommissionThb                         // bookings.partner_earnings_thb
platformMarginThb  = guestFeeThb + hostCommissionThb
insuranceReserveThb = round(platformMarginThb * (insuranceFundPercent / 100)) // settlement_v3.insurance_reserve_amount
taxableMarginThb   = userTotalThb - partnerPayoutThb                         // bookings.taxable_margin_amount
```

**Identity:** `userTotalThb − partnerPayoutThb = platformMarginThb`.

**Min transaction threshold (guest payable):** **`MIN_BOOKING_GUEST_TOTAL_THB = 100`** — минимальный **итог к оплате гостем** (субтотал проживания после промо **+** сервисный сбор, THB, те же округления, что в UI). Проверка только на сервере (**`BookingService`**, см. **`lib/booking-price-integrity.js`**); код отказа API **`BOOKING_MIN_TOTAL_THB`**.

### 3.5 Price Unification (CRITICAL)

**The listing booking widget and checkout MUST use the same commission rate source and the same THB subtotal before fee.**

```javascript
// Listing widget (app/listings/[id]/page.js) — same shape as checkout
const serviceFee = Math.round(subtotalThb * (commissionRate / 100))
const finalTotal = subtotalThb + serviceFee

// Checkout (app/checkout/[bookingId]/page.js)
const serviceFee = priceAfterDiscount * (commissionRate / 100)
const totalWithFee = priceAfterDiscount + serviceFee
```

**Display format:**
```
Subtotal (stay):     ฿Y
Service fee (r%):    ฿Z
─────────────────────────────
Total:               ฿(Y+Z)
```

---

## 4. Notification System

### 4.1 Architecture

```
NotificationService (lib/services/notification.service.js) — dispatch + safeNotifyChannel
    │
    ├── lib/services/notifications/email.service.js
    │         sendResendEmail / text→HTML (fallbacks; branded mail → lib/services/email.service.js)
    │
    ├── lib/services/notifications/telegram.service.js
    │         sendTelegramMessagePayload, sendToAdminTopic, sendTelegramBookingRequest (?booking=)
    │
    ├── lib/services/notifications/push.service.js → PushService (lib/services/push.service.js)
    │
    └── static helpers: sendEmail / textToHtml / sendTelegram* — thin delegates to the modules above
            Telegram admin topics: BOOKINGS (15), FINANCE (16), NEW_PARTNERS (17), MESSAGES (18)
```

### 4.2 Event Dispatch

```javascript
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service';

// Dispatch notification
await NotificationService.dispatch(NotificationEvents.NEW_BOOKING_REQUEST, {
  booking,
  partner,
  listing,
  guest
});
```

### 4.3 Notification Events

| Event | Recipients | Channels |
|-------|------------|----------|
| NEW_BOOKING_REQUEST | Guest, Partner, Admin | Email, Telegram, Topic:BOOKINGS |
| BOOKING_CONFIRMED | Guest, Admin | Email, Topic:BOOKINGS |
| PAYMENT_SUCCESS | Guest, Partner, Admin | Email, Telegram, Topic:FINANCE |
| CHECK_IN_CONFIRMED | Partner, Admin | Email, Telegram, Topic:FINANCE |
| LISTING_APPROVED | Partner | Email, Telegram |
| LISTING_REJECTED | Partner | Email, Telegram |
| PARTNER_VERIFIED | Partner, Admin | Email, Topic:NEW_PARTNERS |

### 4.4 Email Templates

All emails include:
- HTML version with inline CSS
- Plain text fallback
- Gostaylo footer
- Escrow security message (for payments)

### 4.5 Environment Variables

```bash
TELEGRAM_BOT_TOKEN=8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM
TELEGRAM_ADMIN_GROUP_ID=-1003832026983
RESEND_API_KEY=re_xxx  # Optional - falls back to mock
SENDER_EMAIL=Gostaylo <noreply@funnyrent.com>
```

---

## 5. Checkout Flow

### 5.1 Flow Diagram

```
[Listing Detail] → [Booking Form] → [Supabase INSERT] → [Redirect /checkout/{id}]
                        ↓                                       ↓
                 [Price + 15% Fee]                    [Direct Supabase REST fetch]
                        ↓                                       ↓
                 [grandTotal shown]                   [Same grandTotal displayed]
                                                              ↓
                                              [Payment Method Selection]
                                                              ↓
                                [CARD/MIR: Mock Gateway] | [CRYPTO: USDT TRC-20]
                                                              ↓
                                              [Confirm → Update Status]
                                                              ↓
                                              [NotificationService.dispatch()]
                                                              ↓
                                              [Check-in → Release Funds]
```

### 5.2 Critical Implementation Detail

**PROBLEM:** Kubernetes ingress returns 502 for some API routes.

**SOLUTION:** The checkout page fetches booking data directly from Supabase REST API:

```javascript
// ❌ BROKEN - API route times out
const res = await fetch(`/api/v2/bookings/${id}/payment-status`)

// ✅ WORKING - Direct Supabase call
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/bookings?id=eq.${id}&select=*`,
  {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  }
)
```

### 5.3 Booking Creation Request

```javascript
// CORRECT request body for /rest/v1/bookings INSERT
{
  "listing_id": "lst-xxx",
  "partner_id": "partner-xxx",  // = listing.owner_id
  "status": "PENDING",
  "check_in": "2026-04-01",
  "check_out": "2026-04-05",
  "price_thb": 140000,          // CALCULATED by PricingService
  "guest_name": "John Doe",
  "guest_email": "john@example.com",
  "guest_phone": "+66123456789",
  "special_requests": null
  // ❌ NO metadata field - column doesn't exist
}
```

---

## 5. Strict Development Standards

### 5.1 JSX Syntax Rules

```jsx
// ❌ FORBIDDEN - Causes Vercel build failures
className=\"bg-red-500\"
className={"bg-red-500"}

// ✅ REQUIRED - Single quotes only
className='bg-red-500'

// ✅ OK - Template literals
className={`bg-${color}-500`}
```

### 5.2 Monetary Calculations

```javascript
// ❌ FORBIDDEN - Direct arithmetic
const total = basePrice * nights

// ✅ REQUIRED - Use PricingService
import { PricingService } from '@/lib/services/pricing.service'
const result = PricingService.calculateBookingPriceSync(
  basePrice, checkIn, checkOut, seasonalPricing
)
const total = result.totalPrice
```

### 5.3 Supabase Queries

```javascript
// ❌ FORBIDDEN in API responses - ObjectId not serializable
return NextResponse.json(rawMongoDoc)

// ✅ REQUIRED - Exclude _id, transform data
const { data } = await supabase.from('bookings').select('*')
return NextResponse.json({ success: true, data })
```

### 5.4 Environment Variables

```bash
# PROTECTED - Never modify these keys
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Never use fallback values
const url = process.env.NEXT_PUBLIC_SUPABASE_URL  // ✅
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'default'  // ❌
```

### 5.5 Icon Library

```jsx
// ❌ FORBIDDEN - Emoji characters in UI
🤖 🧠 💡

// ✅ REQUIRED - lucide-react icons
import { Bot, Brain, Lightbulb } from 'lucide-react'
<Bot className='h-4 w-4' />
```

---

## 6. Expansion Guide: JSONB Metadata Pattern

### 6.1 Adding New Features via Metadata

The `listings.metadata` JSONB column is the **extensibility point** for new features without schema migrations.

#### Example: Adding Insurance Option

```javascript
// Step 1: Update metadata structure
const metadata = {
  ...existingMetadata,
  insurance: {
    enabled: true,
    options: [
      { id: 'basic', name: 'Basic Coverage', priceThb: 500, coverage: '50000' },
      { id: 'premium', name: 'Premium Coverage', priceThb: 1500, coverage: '200000' }
    ]
  }
}

// Step 2: Update listing
await supabase.from('listings')
  .update({ metadata })
  .eq('id', listingId)

// Step 3: Read in booking flow
const insurance = listing.metadata?.insurance
if (insurance?.enabled) {
  // Show insurance options in booking form
}
```

#### Example: Adding Transfer Service

```javascript
// listings.metadata.transfer
{
  "transfer": {
    "enabled": true,
    "options": [
      {
        "id": "airport-pickup",
        "name": "Airport Pickup",
        "priceThb": 1200,
        "vehicleType": "sedan",
        "maxPassengers": 3
      },
      {
        "id": "airport-roundtrip",
        "name": "Airport Roundtrip",
        "priceThb": 2000,
        "vehicleType": "minivan",
        "maxPassengers": 6
      }
    ]
  }
}
```

### 6.2 Adding Booking Add-ons

Для произвольных допов по-прежнему можно использовать **`special_requests`** или отдельную таблицу **`booking_addons`**. Платёжные и технические поля — в **`bookings.metadata`** (JSONB):

```sql
-- Option A: Use special_requests as JSON string
UPDATE bookings SET special_requests = '{"insurance":"premium","transfer":"airport-pickup"}'

-- Option B: Create dedicated table (recommended for complex add-ons)
CREATE TABLE booking_addons (
  id TEXT PRIMARY KEY,
  booking_id TEXT REFERENCES bookings(id),
  addon_type TEXT NOT NULL,  -- 'insurance', 'transfer', 'cleaning'
  addon_data JSONB NOT NULL,
  price_thb NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.3 Extending PricingService

```javascript
// Add to pricing.service.js

/**
 * Calculate total with add-ons
 */
static calculateTotalWithAddons(baseTotal, addons = []) {
  let addonsTotal = 0;
  const addonBreakdown = [];
  
  for (const addon of addons) {
    addonsTotal += addon.priceThb;
    addonBreakdown.push({
      type: addon.type,
      name: addon.name,
      price: addon.priceThb
    });
  }
  
  return {
    baseTotal,
    addonsTotal,
    grandTotal: baseTotal + addonsTotal,
    addonBreakdown
  };
}
```

---

## 7. API Endpoints Reference

### 7.1 Listings API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/listings` | List all approved listings |
| GET | `/api/v2/search?category=villas` | Search listings (primary endpoint for list/filter) |
| GET | `/api/v2/listings/[id]` | Get single listing |
| POST | `/api/v2/listings` | Create listing (Partner) |
| PATCH | `/api/v2/listings/[id]` | Update listing |

### 7.2 Bookings API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/bookings` | List bookings (session required; self-scope for non-staff) + `unified_order` envelope on each item |
| POST | `/api/v2/bookings` | Create booking |
| GET | `/api/v2/bookings/[id]/payment-status` | Get booking + listing info |
| POST | `/api/v2/bookings/[id]/payment/initiate` | Start payment flow |
| POST | `/api/v2/bookings/[id]/payment/confirm` | Подтверждение оплаты гостем → **`PAID_ESCROW`** через **`EscrowService.moveToEscrow`** (ledger); идемпотентно при повторном вызове |
| GET, POST | `/api/cron/review-reminder` | Cron: push + Telegram гостю на следующий календарный день после **`check_out`** (если ещё нет отзыва). **GET и POST** при валидном **`CRON_SECRET`** выполняют одну и ту же логику (Vercel Cron шлёт **GET**; внешний планировщик может использовать **POST**). Без **`CRON_SECRET`** в env → **503**. Сравнение Bearer-токена допускает пробелы после `Bearer`, значение секрета **trim**. |
| POST | `/api/v2/bookings/[id]/check-in/confirm` | Confirm check-in (session + participant/staff access) |
| GET | `/api/v2/admin/ledger-balances` | ADMIN: остатки ledger (THB) |
| GET | `/api/v2/admin/ledger-reconciliation` | ADMIN: сверка clearing vs credits в журналах захвата оплаты (MVP) |
| POST | `/api/v2/admin/payouts/tbank-registry` | ADMIN: CSV реестр Т-Банка + PROCESSING |
| GET | `/api/v2/admin/partner-payout-profiles` | ADMIN: профили выплат без верификации |
| GET | `/api/v2/admin/payout-methods` | ADMIN: все строки **`payout_methods`** |
| POST | `/api/v2/admin/payout-methods` | ADMIN: создать метод |
| PUT | `/api/v2/admin/payout-methods` | ADMIN: обновить метод; нет строки с **`body.id`** → **404** |
| DELETE | `/api/v2/admin/payout-methods?id=` | ADMIN: удалить метод; **409**, если метод в **`partner_payout_profiles`** |
| PATCH | `/api/v2/admin/partner-payout-profiles/[id]` | ADMIN: верифицировать профиль |
| GET | `/api/v2/admin/payouts` | ADMIN: выплаты; **`?status=PROCESSING`** или **`?status=FINAL`** (алиасы **SUCCESS**, **PAID_OR_COMPLETED**) → **PAID**+**COMPLETED**; поле **`isFinalSuccess`** |
| PATCH | `/api/v2/admin/payouts/[id]` | ADMIN: **`{ "status", "adminNote"? }`** — ключ **`adminNote`** при наличии пишет **metadata** (**PAID** и **FAILED**); PAID → ledger; FAILED только из **PROCESSING** |

### 7.3 Admin API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/moderation` | MODERATOR/ADMIN: PENDING listings (без черновиков), embed owner + **`categories(slug,name)`** |
| PATCH | `/api/admin/moderation` | MODERATOR/ADMIN: **`approve`** (опц. **`title`/`description`/`metadata`**), **`reject`** (**`rejectReason`**), **`set_featured`** (**`isFeatured`** → **`listings.is_featured`**) |
| POST | `/api/ical/sync?action=sync-all` | Global iCal sync |

### 7.4 Conversations API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/conversations` | List user's conversations |
| GET | `/api/v2/conversations/[id]` | Get single conversation |
| POST | `/api/v2/messages` | Send message |

---

## 8. Authentication & Authorization

### 8.1 Role Hierarchy

```
ADMIN > MODERATOR > PARTNER > RENTER
```

### 8.2 Route Protection

```javascript
// Protected routes check role in layout.js
const allowedRoles = {
  '/admin/*': ['ADMIN'],
  '/admin/moderation': ['ADMIN', 'MODERATOR'],
  '/partner/*': ['PARTNER', 'ADMIN'],
}
```

### 8.3 Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@funnyrent.com | ChangeMe2025! |
| Partner | partner@test.com | ChangeMe2025! |
| Moderator | assistant@funnyrent.com | ChangeMe2025! |

---

## 9. Deployment Checklist

### 9.1 Vercel Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vtzzcdsjwudkaloxhvnw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_ADMIN_GROUP_ID=-100xxx
```

### 9.2 Pre-Deployment

1. Run `yarn vercel-build` locally
2. Check for escaped quote errors in output
3. Verify all imports resolve
4. Test critical flows with curl

### 9.3 Build Command

```json
// package.json
{
  "scripts": {
    "vercel-build": "next build"
  }
}
```

---

## 10. Known Issues & Workarounds

| Issue | Workaround | Status |
|-------|------------|--------|
| Kubernetes 502 on API routes | Direct Supabase REST calls | PERMANENT |
| `bookings.metadata` missing in old DB | Run migration **`030_financial_phase1_5_ledger_booking_metadata.sql`** | FIXED (repo) |
| Escaped quotes break Vercel build | Use single quotes in className | PERMANENT |
| Edge runtime timeouts | Use Node.js runtime for long ops | PERMANENT |

---

## 11. Mocked Services

| Service | Status | Production Replacement |
|---------|--------|------------------------|
| Payment Gateway (Stripe) | MOCKED | Stripe API integration |
| TRON webhook `POST /api/webhooks/crypto/confirm` | **Shared secret** + **`verifyTronTransaction`** (TronScan) | Production path; mock removed |
| Acquiring `POST /api/webhooks/payments/confirm` | **HMAC** + **Payment Intent primary confirm** | Карты / PSP (Mandarin, YooKassa-shape) |
| Email Notifications | MOCKED | Resend API |

---

## 12. File Checksums (Critical Files)

```
lib/services/pricing.service.js  - Seasonal pricing logic
app/listings/[id]/page.js        - Booking form + price calc
app/checkout/[bookingId]/page.js - Direct Supabase fetch
database/migration_stage_25.sql  - Latest DB schema
```

---

**END OF ARCHITECTURAL PASSPORT**

*Any questions about this architecture should be directed to the PRD.md or TECHNICAL_MANIFESTO.md documents.*
