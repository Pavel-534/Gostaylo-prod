# GoStayLo — Technical Manifesto (code-truth)

**Назначение:** сжатый снимок **текущей** реализации в репозитории. Продуктовые правила и золотые ограничения — в корневом **`ARCHITECTURAL_DECISIONS.md`** (SSOT). Секреты и полные перечни API здесь не дублируются.

**Стек:** Next.js **14** (App Router), React, Supabase (Postgres + Storage), JWT в cookie `gostaylo_session`, **`prisma/schema.prisma`** только как описание схемы (рантайм — Supabase).

---

## 1. Деньги и валюта (CurrencyService)

### 1.1 Источники данных

| Что | Где живёт | Модуль / API |
|-----|-----------|----------------|
| Суммы в БД и расчётах | **THB** | `base_price_thb`, брони, `bookings.pricing_snapshot` |
| Курсы для витрины (карточки, каталог, карта) | Таблица **`exchange_rates`** (`rate_to_thb` = THB за **1** единицу валюты) | **`lib/services/currency.service.js`** → **`getDisplayRateMap`**, TTL **6 ч** (`EXCHANGE_RATES_DB_TTL_MS`), при необходимости ExchangeRate-API v6 + upsert в БД |
| Курсы при создании брони (`price_paid` / `exchange_rate`) | Тот же канон, что витрина | **`PricingService.getExchangeRates()`** → **`CurrencyService.getDisplayRateMap`** (не «сырой» обходной SELECT без TTL/API) |
| Публичный API курсов | — | **`GET /api/v2/exchange-rates`** → `rateMap` |
| Клиентский кеш | localStorage, согласованный с TTL сервера | **`lib/client-data.js`** — **`fetchExchangeRates`** |
| USDT (платежи, уведомления) | `exchange_rates` → API → env / settings | **`resolveThbPerUsdt()`**, аварии — **`lib/services/currency-last-resort.js`** |
| Комиссия платформы | `system_settings` / env | **`resolveDefaultCommissionPercent()`** |
| Множитель курса для счетов в чате THB↔USDT | админка **`/admin/settings`** / env | **`getEffectiveRate`** + **`resolveChatInvoiceRateMultiplier`** |

В **`currency.service.js`** не вводить захардкоженные курсы (например **35.5**) и фиксированный множитель **1.02** для чата — только цепочка выше.

### 1.2 UI: откуда берутся цифры на экране

- **`formatPrice(amountThb, currency, exchangeRates, language)`** в **`lib/currency.js`** — для валюты ≠ THB **делит** сумму в THB на **`exchangeRates[currency]`**, **только если** в переданной карте есть конечный положительный курс. Иначе отображается число в THB с символом выбранной валюты (без выдуманного кросса). Четвёртый аргумент — язык UI для **`toLocaleString`** (группировка разрядов). **Таблицы курсов в `lib/currency.js` нет** (удалены неиспользуемые конвертеры с литералами).
- Витрина подгружает курсы через **`fetchExchangeRates()`** или **`hooks/use-currency.js`** (оба — **`/api/v2/exchange-rates`**).
- Значение по умолчанию **`{ THB: 1 }`** у пропа `exchangeRates` — это **нейтральный множитель для THB**, не курс «доллара».
- Гео-подсказка валюты: **`GET /api/v2/geo`** использует **`getDisplayRateMap`** (тот же канон, без отдельного Forex-модуля).

### 1.3 Удалено (не возвращать)

- **`lib/services/forex.service.js`**, **`GET /api/v2/forex`** — удалены; второго FX-движка нет.
- **`lib/services/currency-helper.js`** — удалён (реэкспорт без потребителей); импортировать **`currency.service.js`** напрямую.
- Скрытая наценка **3.5%** (FunnyRate) — снята; новая «витринная» наценка — только через **`system_settings` / env** по тому же принципу, что чат-счета.

### 1.4 Finance & Currency — формулы `price_thb` и сезоны

**Канон расчёта:** **`PricingService.calculateBookingPrice`** (`lib/services/pricing.service.js`) из **`BookingService.createBooking` / `createInquiryBooking`** (`lib/services/booking.service.js`).

1. **Период:** даты приводятся к дню листинга (**`toListingDate`**). Цикл по каждой **ночи** от `check_in` до `check_out` (день за днём, пока `night < checkOutStr`); **`nights`** = число итераций.
2. **Ставка за ночь/сутки:** для каждой даты **`calculateDailyPrice`**: сначала окна **`seasonal_prices`** (БД, первое совпадение диапазона), иначе **`listings.metadata.seasonal_pricing`** — абсолют **`priceDaily` / `price_daily`** или **`base_price_thb × priceMultiplier`**.
3. **Субтотал:** `subtotalBeforeDuration` = сумма дневных ставок за период.
4. **Скидка за длительность:** **`applyDurationDiscountToSubtotal`** по **`metadata.discounts`** (пороги в ночах, см. комментарии в **`pricing.service.js`**). **`totalPrice`** до промо = `discountedPrice`.
5. **Промокод:** в **`BookingService`** — после шага 4, снимается с THB; итог пишется в **`bookings.price_thb`**.
6. **Снимок:** **`buildBookingPricingSnapshot`** → **`bookings.pricing_snapshot`** (ночи, субтотал до лестницы, скидка, промо).

**По категориям (код = истина):**

| Категория | Смысл `base_price_thb` в продукте | Фактическая формула в коде |
|-----------|-----------------------------------|----------------------------|
| **Properties (жильё)** | За ночь | **Σ(ставка за каждую ночь с учётом сезонов)**; при плоской ставке без сезонов и без лестницы скидок эквивалентно **base × nights**. |
| **Vehicles (транспорт)** | За сутки | Тот же цикл по ночам между датами → число суток = обычно **checkout − checkin** в днях; сезоны — как у жилья. |
| **Tours (туры)** | За человека / билет | Базовый расчёт периода (сезоны + скидка длительности) затем **множитель по группе**: **`totalPrice = discountedPrice × guestsCount`**. `guestsCount` для туров валидируется как минимум **1** (0 недопустим). |

### 1.4a Защита цены при создании брони (client attestation)

- Клиент передаёт **`clientQuotedSubtotalThb`** (THB, до промокода), витрина считает ту же сумму через **`PricingService.calculatePrice`** / **`calculateBookingPriceSync`** (в т.ч. тур × **`guestsCount`**).
- **`BookingService.createBooking`** и **`createInquiryBooking`** (кроме **`privateTrip`** / **`negotiationRequest`**) сверяют **`Math.round(clientQuotedSubtotalThb)`** с **`Math.round(PricingService.calculateBookingPrice(…).totalPrice)`** до применения промокода. Расхождение → отказ (**`code: 'PRICE_MISMATCH'`**), **`notifySystemAlert`** с меткой **«ATTEMPTED PRICE MANIPULATION»**.
- Схема тела: **`lib/validations/booking.js`**; публичный вход — **`POST /api/v2/bookings`**.
- **Финальный POST с клиента** (кнопка «Забронировать»): заголовки **`Cache-Control: no-cache`** и **`Pragma: no-cache`**, чтобы промежуточный HTTP-кэш (в т.ч. после **`private` TTL календаря**) не подставил устаревшую картину занятости; сервер всё равно делает **повторную проверку доступности** в **`BookingService`** непосредственно перед INSERT.
- **Конфликт дат после кэша:** ответ **`code: 'DATES_CONFLICT'`** → пользователю **`getBookingApiUserMessage`** / **`bookingErr_datesConflict`** (локализовано в **`lib/translations/errors.js`**).

### 1.4b Deep links (мобильные уведомления / внешние приложения)

Канонические экраны: **`/messages/[id]`** (чат), **`/checkout/[bookingId]`** (оплата). Для коротких URL в push / Telegram / будущем нативном shell:

| Алиас | Редирект |
|-------|-----------|
| **`/chat/[id]`** | **`/messages/[id]`** — **`app/chat/[id]/page.js`** |
| **`/bookings/[id]`** | **`/checkout/[id]`** — **`app/bookings/[id]/page.js`** |

При появлении нативного приложения те же пути можно зарегистрировать как **universal links** / **app links** без смены серверных маршрутов.

### 1.4c Критические сигналы (Telegram system topic)

- Повторяющиеся **`PRICE_MISMATCH`**: **`lib/critical-telemetry.js`** (`recordCriticalSignal`) — при превышении порога за окно времени дополнительное сообщение в системный топик с префиксом **`[FRAUD_DETECTION]`** (дополняет поштучные **`notifySystemAlert`** из **`booking.service.js`**). При наличии **`banUserId`** в опциях — в сообщение добавляется **inline URL-кнопка** «Забанить пользователя …» (**`buildFraudBanReplyMarkup`**, **`lib/services/fraud-telegram-ban-button.js`**).
- Тексты манипуляции ценой в алертах также помечены **`[FRAUD_DETECTION]`**; мгновенная кнопка бана дублируется и на поштучном **`notifySystemAlert`** из **`booking.service.js`**, если известен **`renter_id`**.

### 1.4d LQIP карточек листинга

- Плейсхолдер **`next/image`**: по умолчанию нейтральный blur (**`LISTING_CARD_BLUR_DATA_URL`**). Если в **`listings.metadata`** задано **`card_blur_data_url`** или **`blur_data_url`** (data URL крошечного превью), используется **`getListingCardBlurDataURL`** (**`lib/listing-image-blur.js`**) в **`CardImageCarousel`** / контекст-карточке.

### 1.5 Витринные курсы, снимок брони, оплата

- **Единый источник курсов для витрины и полей `price_paid` / `exchange_rate` при создании брони:** **`CurrencyService.getDisplayRateMap()`**. Конвертация в список для поиска по коду — **`PricingService.getExchangeRates()`** (динамический импорт **`currency.service.js`**).
- **При INSERT в `bookings`:** `exchange_rate` = **`rateToThb`** выбранной валюты запроса (THB за 1 единицу); **`price_paid`** = **`price_thb / exchange_rate`**. Для **`currency === 'THB'`** курс **1**.
- **Пересчёта при переходе в PAID нет:** **`BookingService.updateStatus`** и **`PUT /api/v2/partner/bookings/[id]`** меняют только **`status`** и временные метки (**`checked_in_at`** для PAID в partner flow), не трогая **`price_thb`**, **`exchange_rate`**, **`commission_*`**. Тело **PUT** парсится через **`request.text()`** + **`JSON.parse`**; пустое или невалидное JSON → **400**, не **500**.
- **USDT в момент оплаты:** **`resolveThbPerUsdt()`** (цепочка **`exchange_rates` → API → env / `system_settings`**) используется в **`payment/initiate`**, **`payment.service`**, верификации Tron — это **операционный курс оплаты**, не обязано совпадать с **`bookings.exchange_rate`** (который про валюту запроса USD/RUB/CNY). Счета в чате THB↔USDT — **`getEffectiveRate`** + **`resolveChatInvoiceRateMultiplier`** (отдельно от **`getDisplayRateMap`**).
- **Скан на «магические» курсы:** литералов **1.035 / 0.965** в финансовом ядре нет. Число **1.02** — только как платформенный дефолт **`chatInvoiceRateMultiplier`** в **`currency-last-resort.js`** / placeholder админки, не как множитель витринного **`getDisplayRateMap`**. **`GET /api/v2/partner/stats`:** доход партнёра из **`partner_earnings_thb`**, иначе **`price_thb − commission_thb`**, иначе **`price_thb × (1 − commission_rate/100)`** — без фиксированного **0.85**.

### 1.6 Admin Health Alerts (дисплей-FX)

- **Когда:** при загрузке карты курсов для витрины **`CurrencyService.getDisplayRateMap`** оценивает «свежесть» строк **`exchange_rates`** (в т.ч. USDT с **`updated_at`**). Если для любой из ожидаемых валют в карте **нет** `updated_at` или возраст **`updated_at` &gt; 24 ч** (`DISPLAY_FX_STALE_ALERT_MS`), состояние считается **stale**.
- **Лог + Telegram:** **`maybeAlertStaleDisplayRates`** пишет **`console.warn`**, затем **`notifySystemAlert`** → топик **`TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`** (fallback — **`sendToAdmin`**: личка или топик FINANCE). Текст вида **«КРИТИЧНО: Курсы валют устарели»** (Bangkok TZ). Повтор не чаще **1 ч** (`DISPLAY_FX_STALE_ALERT_COOLDOWN_MS`).
- **Дашборд админа:** **`GET /api/v2/admin/exchange-rates-health`** (JWT **ADMIN**, cookie `gostaylo_session`) отдаёт **`{ stale, staleCodes, lastUpdateLabel, oldestStaleIso }`** из **`getDisplayFxStaleHealthFromDb`** без вызова внешнего FX API. Клиент **`app/admin/dashboard/page.js`** поднимает **красный баннер** при **`stale === true`** (`data-testid="admin-fx-stale-banner"`).

### 1.7 Traceability: листинг → карточка в чате

1. **`listings.base_price_thb`** (+ **`seasonal_prices`** + **`metadata.seasonal_pricing`** + **`metadata.discounts`**).
2. **`PricingService.calculateBookingPrice`** → **`BookingService.createBooking`** → **`bookings`** (**`price_thb`**, **`exchange_rate`**, **`price_paid`**, **`commission_thb`**, **`commission_rate`**, **`partner_earnings_thb`**, **`pricing_snapshot`**).
3. **`ensureBookingConversation`** / **`ensureInquiryConversation`** → первая **`messages`**: system с **`metadata.price_thb`**, **`pricing_snapshot`**, **`booking_id`**.
4. Обычный UI: **`ChatMilestoneCard`** — итог **THB** из **`metadata.price_thb`** (и даты из metadata).
5. **`BookingRequestCard`** + **`lib/chat-booking-totals.js`** (`resolveChatBookingBreakdown`): только сообщения типа **`BOOKING_REQUEST`** в staff-треде; разбивка **× дней / × гостей** зависит от **`metadata.totalPrice` / `basePrice` / `days` / `group_size`** — не отдельный дубль сервера для стандартного **`booking_created`**.

---

## 2. Календари и доступность

- **Истина:** **`calendar_blocks`** + **`lib/services/calendar.service.js`**.
- **iCal → блоки:** **`lib/services/ical-calendar-blocks-sync.js`**. Вызовы: **`/api/cron/ical-sync`**, **`/api/ical/sync`**, **`/api/v2/admin/ical`**. Логи: **`ical_sync_logs`**. Экспорт `.ics`: **`/api/v2/listings/[id]/ical`**.
- **Надёжность импорта:** при ошибке **fetch/parse/insert** существующие блоки источника **не затираются** (вставка новых строк выполняется до удаления старых; при сбое удаления — откат вставленных id). Ошибки синхронизации в cron агрегируются и уходят в **системный Telegram** (**`notifySystemAlert`** в **`app/api/cron/ical-sync/route.js`** при **`errors > 0`**).
- **День листинга:** **`Asia/Bangkok`** — **`lib/listing-date.js`**. All-day iCal: **`lib/ical-all-day-range.js`**.
- **Не использовать** для прод-записи партнёрами: **`availability_blocks`**.

---

## 3. Категории листингов: жильё, транспорт, туры

### 3.1 Слуги и UX

- Slug категории из БД — **`lib/listing-category-slug.js`**, **`lib/listing-booking-ui.js`** (`getListingBookingUiMode`, `getListingRentalPeriodMode`, exclusive/shared инвентарь).
- **Подписи периода в виджете** (`components/listing/BookingWidget.jsx`): режим **`night`** или **`day`** задаётся **`getListingRentalPeriodMode`** — **`day`** для **`vehicles`**, яхт/лодок (yacht/boat в slug), **туров** (`tours` / `tour` в slug).

### 3.2 Канон: единица брони и колонки `min_booking_days` / `max_booking_days`

| Категория (продукт) | EN | Что считаем | Колонки min/max дней в БД | `POST /api/v2/bookings` |
|---------------------|-----|-------------|---------------------------|-------------------------|
| **Жильё и аналоги** | Properties | **Ночи** | Реальные лимиты партнёра | Длина периода в ночах ≥ `min_booking_days` (и max при наличии) |
| **Транспорт** | Vehicles | **Сутки (24h)** в копирайте и ценообразовании | Реальные лимиты аренды по дням | Сравнение длины периода **в днях** с min/max колонок (как для «ночей» по датам, см. сервер) |
| **Туры** | Tours | **Люди / билеты** — лимит гостей | **Фиксировано 1 / 730** из партнёрского UI — колонки **не** выражают размер группы и **не** должны отсекать тур по длительности | Для `categories.slug === 'tours'`: проверка **`guestsCount`** vs **`metadata.group_size_min` / `group_size_max`** (+ `max_capacity` при необходимости). Реализация: **`app/api/v2/bookings/route.js`**. |

### 3.3 Туры: миграция из старых колонок в metadata

1. Исторически партнёрский UI записывал «мин/макс группы» в **`min_booking_days` / `max_booking_days`** — семантически неверно.
2. **Сейчас:** **`listings.metadata.group_size_min`** и **`group_size_max`** — единственный смысловой источник для лимита гостей; при сохранении нормализует **`normalizePartnerListingMetadata`** (**`lib/partner/listing-wizard-metadata.js`**).
3. **При открытии формы:** если в metadata ещё нет `group_size_*`, один раз подставляются значения из колонок функцией **`mergeTourGroupMetadataFromListingColumns`** (тот же файл). Вызовы: **`app/partner/listings/new/page.js`**, **`app/partner/listings/[id]/page.js`**. После сохранения листинга источником истины остаётся metadata.
4. Партнёр при сохранении туров отправляет **`minBookingDays: 1`**, **`maxBookingDays: 730`** — осознанная фиксация в БД, чтобы общий пайплайн «дней» не блокировал туры, пока логика — по гостям.

### 3.4 Карточка «запрос брони» в чате (отображение суммы)

- **Обычный поток:** системное сообщение о брони → **`ChatMilestoneCard`** показывает **`metadata.price_thb`** (= **`bookings.price_thb`** на момент создания).
- **Staff / тип `BOOKING_REQUEST`:** **`lib/chat-booking-totals.js`** → **`resolveChatBookingBreakdown`**: для туров (slug `tours` / подстрока `tour`) итог из metadata = **цена × размер группы**; для жилья/транспорта — **субтотал периода** или **ставка × `days`** из **`totalPrice` / `basePrice`**. Комиссия в **`PriceBreakdown`** — от **`metadata.commissionRate`** или хука **`useCommission`**.

---

## 4. Авторизация: 100% cookie + сервер (единый стандарт)

- **Сессия:** HttpOnly **`gostaylo_session`** (JWT), выставляется только API логина/рефреша. Клиентский **`localStorage.gostaylo_user`** — кеш для UI и быстрого старта **`AuthProvider`**, **не** источник решения о доступе к закрытым зонам.
- **Edge:** **`middleware.ts`** проверяет JWT и роль для префиксов **`/admin`**, **`/partner`**, **`/renter`**, **`/messages`**. Нет валидной сессии → редирект на **`/login?redirect=<path>`** (страница **`app/login/page.js`** кладёт `redirect` в `sessionStorage` и открывает вход через **`/profile?login=true`**).
- **Админ-лейаут:** **`app/admin/layout.js`** после middleware дополнительно запрашивает **`GET /api/v2/auth/me`** (роль из БД). Без сессии → **`/login`**, не ADMIN/MODERATOR → **`/`**. Режим «войти как» (только при реальной роли ADMIN в JWT): UI берётся из **`localStorage`** при **`isImpersonated`**, подделка без ADMIN-сессии невозможна.
- **Выход из админки:** **`POST /api/v2/auth/logout`** + очистка локальных ключей impersonation.

## 5. Чат как транзакционный центр (Command Center)

- **Канон отправки из UI:** **`POST /api/v2/chat/messages`** — **`getSessionPayload`** + участие в беседе (**`lib/services/chat/access.js`**). Поля **`sender_id` / `sender_role` / `sender_name` из тела запроса игнорируются**; в БД пишутся роль и имя из **`profiles`** текущей сессии.
- **Системные сообщения:** тип **`system`** — по умолчанию только **ADMIN/MODERATOR**; у партнёра — узкий whitelist **`metadata.system_key`** (`passport_request`, `booking_confirmed`, `booking_declined`) при участии в диалоге. Renter/USER не могут эмулировать «Систему» или чужую роль через API.
- **Транзакционные события (бронь, счёт, статусы):** серверные вставки в **`messages`** из **`lib/services/booking.service.js`**, **`lib/booking-status-chat-sync.js`**, **`app/api/v2/chat/support/join/route.js`** и т.д. — обходят HTTP-роут там, где нужна атомарность с бизнес-операцией; клиентский путь остаётся единым для пользовательского текста/медиа/счетов из кабинета.
- **Уведомления после сообщения:** **`PushService.sendToUser`** (FCM) для контрагента в диалоге; ошибки FCM **логируются, не ломают** ответ API (**`.catch`** в роуте). Опциональный **Telegram ping** только если **`recipientTelegramId`** принадлежит **участнику этой беседы** (не произвольному пользователю). Текстовые сообщения при включённых prefs могут дублироваться в Telegram без явного **`notifyTelegram`**.
- **Realtime (Supabase) — единая стратегия переподключения:** модуль **`lib/chat/realtime-subscribe-with-backoff.js`** (`subscribeRealtimeWithBackoff`). Любой Realtime-канал чата пересоздаётся при статусах **`CHANNEL_ERROR`**, **`TIMED_OUT`**, **`CLOSED`** с задержкой **`min(30s, 1000 × 2^min(attempt,5))`**. Имена каналов включают **`attempt`**, чтобы не конфликтовать с «зависшими» подписками. Потребители: **`lib/context/ChatContext.jsx`** (два канала: `conversations` + `messages` для списка диалогов), **`hooks/use-realtime-chat.js`** (`useRealtimeMessages`, `useRealtimeConversations`, **`usePresence`** — после `SUBSCRIBED` вызывается **`channel.track`**). Источник истины для текста сообщений — **POST** в API; при длительном офлайне список/тред догружаются через **`GET /api/v2/chat/conversations`** и **`GET /api/v2/chat/messages`**. Очереди исходящих в браузере нет (кроме optimistic UI в отдельных хуках).
- **E2E-фикстуры чата (Playwright):** при **`E2E_FIXTURE_SECRET`** в env приложения и в окружении запуска тестов — **`POST /api/v2/internal/e2e/pending-chat-booking`** (заголовок **`x-e2e-fixture-secret`**) создаёт **PENDING**-бронь и беседу через **`BookingService.createBooking`** (**`lib/e2e/create-pending-chat-booking-fixture.js`**). Без секрета роут отвечает **404**. Профили партнёра/рентера — **`E2E_PARTNER_EMAIL` / `E2E_RENTER_EMAIL`** (как в **`tests/auth.setup.ts`**); у партнёра должен быть хотя бы один листинг.
- **E2E тур: математика × гости:** **`POST /api/v2/internal/e2e/tour-booking-math`** (тот же секрет) — **`lib/e2e/create-tour-booking-math-fixture.js`**. Фикстура перебирает даты и оставляет только окна, где итог тура совпадает с **`round(base_price_thb × guests_count)`**, затем создаёт бронь и проверяет **`price_thb === PricingService.total`**. В **`tests/e2e/mobile-chat.spec.ts`** — для **3** гостей: **`price_thb === round(base_price_thb × 3)`** (и совпадение с **`expectedTotalThb`** из ответа).
- **Мобильный тактильный отклик кнопок чата:** панель **`components/chat-action-bar.jsx`** — на **`pointerdown`** (и CSS **`active:`**) кратко **`opacity: 0.7`** и **`scale: 0.98`**, атрибут **`data-pressing="true|false"`** для проверок в **`tests/e2e/mobile-chat.spec.ts`**. Не дублировать скрытые процентные наценки вне **`CurrencyService` / комиссии платформы**.

### 5.1 Mobile Design System (Premium Unified)

- **Скругления 16px:** ключевые блоки чата и связанный UI используют **`rounded-2xl`** (Tailwind = **16px**): лента (`ChatMessageList`), карточки вех/запроса (`ChatMilestoneCard`, **`BookingRequestCard`**), **`ChatActionBar`**, **`ChatSearchBar`** (внутренний контейнер поиска), композеры, статусные бейджи в инбоксе (**`ConversationList`** / `StatusBadge`). Глобально кнопки shadcn — **`rounded-lg`** = **`var(--radius)`** (**`1rem`**) в **`app/globals.css`**.
- **Палитра:** нейтральная база **`bg-white`**; акцент **teal** для primary CTA.
- **Горизонтальные отступы:** минимум **`px-4`** (16px) у оболочек чата, поиска, списка диалогов; лента — **`px-4` / `sm:px-5`**; нижний safe-area — **`CHAT_COMPOSER_SHELL_CLASS`**.
- **Ширина мобильных CTA:** **`w-full`** на мобиле, **`sm:w-auto`** на больших экранах.

### 5.2 Telegram: продуктовые события и личка админа

- **`NotificationService.dispatch`** — брони, оплаты, письма партнёрам/гостям, топики форума (**`sendToAdminTopic`**).
- **`sendToAdmin`** — личка (`TELEGRAM_ADMIN_DM_CHAT_ID` / `ADMIN_TELEGRAM_ID`) или fallback топик FINANCE.

### 5.3 Системные алерты (топик `TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`)

Единая точка: **`NotificationService.sendSystemAlert`** и обёртка **`notifySystemAlert`** (`lib/services/system-alert-notify.js`). При отсутствии или неверном `TELEGRAM_SYSTEM_ALERTS_TOPIC_ID` — fallback на **`sendToAdmin`**.

| Категория | Примеры условий |
|-----------|-----------------|
| **FX / витрина** | Устаревшие дисплей-курсы (`CurrencyService.maybeAlertStaleDisplayRates`) |
| **Бронирования** | Ошибка INSERT; бронь без чата; необработанное исключение `POST /api/v2/bookings`; ручное бронирование календаря — ошибка БД |
| **Гонка дат** | Повторная **`checkAvailability`** непосредственно перед INSERT в **`BookingService.createBooking`**; при конфликте — **`code: 'DATES_CONFLICT'`**, HTTP **409** из API (полная атомарность возможна только constraint/lock в Postgres) |
| **Чат** | Сбой записи сообщения или инвойса (`POST /api/v2/chat/messages`) |
| **Платежи** | Initiate/confirm PATCH; `PaymentService.initializePayment` / `submitTxid` |
| **Resend** | Ошибки HTTP/исключения в `NotificationService.sendEmail`, `EmailService`, `admin/partners` |
| **Cron** | `payouts`, `checkin-reminder`, `draft-digest`, `cleanup-drafts`, `ical-sync` (ошибка или исключение) |
| **Webhooks** | `POST /api/webhooks/crypto/confirm` (JSON, тело, confirm API); `POST /api/webhooks/supabase/booking-status` (JSON, валидация, исключения) |

**Чат — «тупики» UI:** при **`CANCELLED` / `REFUNDED` / `PAID` / `COMPLETED` / `PAID_ESCROW`** гость не видит панель оплаты (**`ChatActionBar`**, **`payNowHref`** в **`UnifiedMessagesClient`**). Карточка **`BookingRequestCard`**: кнопки партнёра только при **`PENDING`**; бейдж статуса синхронизирован с **`bookingStatus`**.

**Оптимистичный UI (тактильный отклик):** **`Подтвердить` / `Отклонить`** — мгновенное обновление **`booking.status`** в **`UnifiedMessagesClient`** с откатом при ошибке API; панель хоста исчезает без спиннеров. **`Оплатить`** — по клику скрываются **`ChatActionBar`** и десктопная кнопка в **`ChatHeaderActions`** (**`payBarSuppressed`** + **`onPayNowClick`**).

### 5.4 Playwright (локальная среда)

- В **`playwright.config.ts`**: **`loadEnvConfig`** подхватывает **`.env.local`** и **`.env`** (как Next).
- **`globalSetup`:** **`tests/global-setup.ts`** печатает **`[Playwright] E2E_FIXTURE_SECRET: LOADED | MISSING`**; при **LOADED** вызывается **`tests/e2e/seed-e2e-tour.ts`** — при отсутствии листинга **tours** у **`E2E_PARTNER_EMAIL`** создаётся один сид (лог **`E2E tours listing: seeded | already present`**), чтобы сценарии туров и RBAC не скипались.
- **`use.baseURL`:** по умолчанию **`http://localhost:3000`**; переопределение: **`PLAYWRIGHT_BASE_URL`** или **`BASE_URL`**.

### 5.5 Notification Integrity (email + Telegram)

- **Booking confirmed email** строится в **`EmailService.prepareBookingConfirmedGuestEmail`** (и отправляется через `sendBookingConfirmedGuest`):  
  - прямой deep-link в чат: **`/messages/{conversationId}/`** при наличии беседы;
  - календарные кнопки: **Google + Outlook + .ics**;
  - подписанный URL `.ics`: **`/api/calendar/stay?t=...`**;
  - вложение `.ics` (`gostaylo-stay.ics`) в payload Resend (`attachments` base64).
- **Deep-link fallback:** при отсутствии беседы используется **`/messages/`** (NotificationService, helper `buildGuestChatUrlForBooking`).
- **i18n email UX:** для **zh** в `booking-email-i18n.js` акцент на `.ics` (Google может быть недоступен).
- **Telemetry email-failure:** `EmailService.sendEmail` на отказах/исключениях вызывает **`recordCriticalSignal('EMAIL_FAILURE', { tag: '[EMAIL_FAILURE]' ... })`**.
- **Integrity smoke API (e2e):** **`POST /api/v2/test/notifications/integrity`** (под `x-e2e-fixture-secret`) проверяет deep-link, наличие `.ics` attachment и валидность токена кнопки бана Telegram.

### 5.6 E2E Hygiene: маркировка, фильтрация, очистка

- Единый маркер тест-данных: **`[E2E_TEST_DATA]`** (`lib/e2e/test-data-tag.js`).
- Фикстуры и сиды (`create-pending-chat-booking-fixture`, `create-tour-booking-math-fixture`, `seed-e2e-tour`) проставляют маркер в `special_requests`/`title`/`metadata`.
- Глобальная фильтрация тест-объектов в «общих» выборках:
  - поиск листингов: `lib/api/run-listings-search-get.js`;
  - SSR листингов: `lib/server-data.js`;
  - service-layer list API: `lib/db-service.js` (`listingsService.findAll`, `bookingsService.findAll`);
  - `BookingService.getBookings` и chat inbox `GET /api/v2/chat/conversations`.
- **Playwright global teardown:** `tests/global-teardown.ts` подключён в `playwright.config.ts`; удаляет E2E-артефакты из `messages`, `conversations`, `bookings`, `listings`. Обязателен для локального/CI прогона против dev/staging БД; на прод-smoke (`RUN_PRODUCTION_SMOKE=1`) teardown **автоматически отключается**, чтобы не трогать прод-данные. Подробнее: **§10**.
- **Разовая чистка мусора:** `scripts/clean-e2e-garbage.mjs` (email-цели + `[E2E_TEST_DATA]`), поддержка `--dry-run`.

---

## 6. План масштабирования базы данных и запросов

### 6.1 Индексы (рекомендуемые SQL, когда объёмы &gt; ~1000 строк и растут)

**`messages`** — история по треду: каноническая миграция **`database/migrations/019_messages_thread_and_listings_map_indexes.sql`** (составной **`conversation_id`, `created_at DESC`**). Для больших таблиц в проде при отдельном окне обслуживания допустима замена на **`CREATE INDEX CONCURRENTLY`**.

**`listings`** — каталог + гео-фильтры:

- Уже полезны: **`district`**, **`status`**, **`available`**, **`category_id`** (см. `prisma/schema.prisma`).
- **Карта:** в той же миграции **019** — частичный B-tree **`(latitude, longitude) WHERE … IS NOT NULL`**; для «точки в полигоне» без PostGIS остаётся фильтр в приложении; при переходе на **PostGIS** — **`GIST`** по **`geography(point)`** / **`ST_MakePoint(longitude, latitude)`**.
- Полнотекст / вектор: см. миграции embedding (**`004_listings_embedding.sql`**); для поиска по названию — **`GIN`** по `to_tsvector` при росте нагрузки.

**`bookings`** — календарь и анти-овербукинг на уровне БД (долгосрочно): уникальность пересечений для **`listing_id` с max_capacity = 1** задаётся через **EXCLUDE** / триггеры или сериализуемые транзакции — вынести в отдельную миграцию после продуктового решения.

### 6.2 N+1 и тяжёлые циклы в `lib/services/`

- **`EscrowService.processAllPayoutsForToday`**: выплаты обрабатываются пулом с ограниченным параллелизмом (**`mapWithConcurrency`**, **`PAYOUT_CRON_CONCURRENCY = 5`**) — без полного **`Promise.all`** и без строго последовательного цикла; каждый шаг по-прежнему **`processPayout(bookingId)`** (идемпотентность по статусу брони).
- **`app/api/cron/ical-sync`**: вложенные циклы листинги × источники — ожидаемо; оптимизация — батчить листинги с одинаковым интервалом, кэшировать HTTP iCal.
- **`CalendarService.getCalendar`**: один проход по датам после загрузки блоков/броней — не N+1 к БД внутри цикла по дням; держать окно **`getCalendar(listingId, 365, …)`** осознанным.

### 6.3 Наблюдения по предыдущим этапам (кратко)

- Системные алерты завязаны на env; на staging проверить **`TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`** и лимиты Telegram.
- Финальная **`checkAvailability`** перед INSERT снижает, но не устраняет гонку — зафиксировано выше.
- **Zero skip (бронь / RBAC / туры):** **`E2E_FIXTURE_SECRET`**, **`SUPABASE_SERVICE_ROLE_KEY`** и **`NEXT_PUBLIC_SUPABASE_URL`** должны быть доступны процессу Playwright (те же **`.env.local` / `.env`**, что подхватывает **`loadEnvConfig`** в **`globalSetup`**), иначе сид тура не выполнится. Профили **`E2E_PARTNER_EMAIL` / `E2E_RENTER_EMAIL`** (дефолт партнёра совпадает с **`tests/auth.setup.ts`**). Строка **`[Playwright] E2E_FIXTURE_SECRET: LOADED`** и лог **`E2E tours listing: seeded | already present`** подтверждают готовность; при **MISSING** секрета или без service role часть сценариев остаётся **skipped**.

---

## 7. Указатель на ядро (файлы)

| Область | Файл(ы) |
|--------|---------|
| FX / комиссия / чат-курс | `lib/services/currency.service.js`, `lib/services/currency-last-resort.js` |
| Admin: здоровье дисплей-курсов | `GET /api/v2/admin/exchange-rates-health`, `app/admin/dashboard/page.js` |
| Отображение символов валют | `lib/currency.js` (`CURRENCIES`, `formatPrice`) |
| Календарь + бронь | `lib/services/calendar.service.js`, `lib/services/booking.service.js` |
| Цены по датам | `lib/services/pricing.service.js` |
| iCal → блоки | `lib/services/ical-calendar-blocks-sync.js` |
| Категории / UI брони | `lib/listing-booking-ui.js`, `lib/listing-category-slug.js` |
| Туры: metadata группы + миграция | `lib/partner/listing-wizard-metadata.js` |
| Сумма в карточке запроса в чате (туры × гости, жильё × ночи) | `lib/chat-booking-totals.js` (`resolveChatBookingBreakdown`) |
| E2E: PENDING + чат для mobile-chat | `lib/e2e/create-pending-chat-booking-fixture.js`, `app/api/v2/internal/e2e/pending-chat-booking/route.js` |
| E2E: тур × гости (mobile-chat) | `lib/e2e/create-tour-booking-math-fixture.js`, `app/api/v2/internal/e2e/tour-booking-math/route.js` |
| E2E: integrity уведомлений | `app/api/v2/test/notifications/integrity/route.js`, `e2e/notifications-integrity.spec.ts` |
| Чат + статусы брони | `app/api/v2/chat/messages/route.js`, `lib/services/chat/access.js`, `lib/booking-status-chat-sync.js` |
| Auth edge + login | `middleware.ts`, `app/login/page.js`, `app/admin/layout.js` |
| Realtime чат (backoff) | `lib/chat/realtime-subscribe-with-backoff.js`, `hooks/use-realtime-chat.js`, `lib/context/ChatContext.jsx` |
| Платежи / эскроу | `lib/services/payment.service.js`, `lib/services/escrow.service.js`, `app/api/cron/payouts` |
| Системные TG-алерты | `lib/services/system-alert-notify.js`, `NotificationService.sendSystemAlert`, `lib/critical-telemetry.js`, `lib/services/fraud-telegram-ban-button.js` |
| Admin: бан пользователя (TG link + API) | `POST/GET /api/v2/admin/users/ban`, `lib/auth/telegram-ban-link.js` |
| E2E hygiene helper / cleanup | `lib/e2e/test-data-tag.js`, `tests/global-teardown.ts`, `scripts/clean-e2e-garbage.mjs` |
| i18n UI | `lib/translations/index.js`, `getUIText`, `app/listings/[id]/layout.js` (metadata + цена) |
| Playwright env + лог секрета + сид tours | `playwright.config.ts`, `tests/global-setup.ts`, `tests/e2e/seed-e2e-tour.ts` |

---

## 8. Security & Admin Controls

### 8.1 Мгновенное реагирование через Telegram

- Системные алерты (**`notifySystemAlert`** → **`NotificationService.sendSystemAlert`**) уходят в топик **`TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`** (или fallback **`sendToAdmin`**). Для сценариев **`[FRAUD_DETECTION]`** с известным пользователем в алерте добавляется **inline keyboard** со ссылкой на **`GET /api/v2/admin/users/ban?t=…`**: токен подписан HMAC (**`lib/auth/telegram-ban-link.js`**, секрет **`TELEGRAM_ADMIN_BAN_SECRET`** или fallback **`JWT_SECRET`**).
- **`POST /api/v2/admin/users/ban`** принимает JSON **`{ userId, banToken? }`**: либо сессия **ADMIN** (`gostaylo_session`), либо валидный **`banToken`** для того же **`userId`**. Действие: **`profiles.is_banned = true`** (миграция **`database/migrations/020_profiles_is_banned.sql`**) и **`supabase.auth.admin.updateUserById(…, { ban_duration })`** — аннулирование сессий Supabase Auth; параллельно **middleware** (`middleware.ts`) при каждом заходе в защищённые зоны опрашивает **`profiles.is_banned`** через REST (service role), при **`true`** сбрасывает cookie и отправляет на логин. Логин и **`GET /api/v2/auth/me`** отклоняют забаненных.

### 8.2 Critical Telemetry (архитектура)

- **`lib/critical-telemetry.js`** — скользящие окна и пороги по ключам сигналов (например **`PRICE_MISMATCH`**), анти-спам между алертами; единая точка вызова **`notifySystemAlert`** с опциональным **`reply_markup`**.
- Тяжёлые вызывающие модули импортируют только **`system-alert-notify.js`** / **`recordCriticalSignal`**, не дублируя Telegram-транспорт.

### 8.3 Интернационализация (i18n)

- Пользовательский текст в зонах **рентера и партнёра** выводится через **`getUIText`** и слои в **`lib/translations/`** (в т.ч. **`ui.js`**, **`renter-reviews-flow.js`**, публичные строки листингов). Хардкод по **`language === 'ru'`** в этих кабинетах убран в пользу ключей словаря; язык UI синхронизируется с **`gostaylo_language`** / контекстом **`useI18n`**.

---

## 9. Environment Variables & Secrets (критичные для продакшена)

Кратко о переменных, без полного каталога всех ключей.

| Переменная | Назначение |
|------------|------------|
| **`CALENDAR_STAY_LINK_SECRET`** | HMAC-секрет для подписи токенов ссылки **`GET /api/calendar/stay?t=…`** (кнопки «добавить в календарь» и вложение `.ics` в письмах). В **production** обязателен: без него модуль **`lib/calendar/calendar-stay-token.js`** бросает ошибку. В dev при отсутствии — предупреждение и fallback (только для локальной разработки). |
| **`TELEGRAM_ADMIN_BAN_SECRET`** | Отдельный секрет для подписи одноразовых ссылок бана из Telegram (**`lib/auth/telegram-ban-link.js`** → **`GET /api/v2/admin/users/ban?t=…`**). Если не задан, используется fallback **`JWT_SECRET`** (менее изолированно). Рекомендуется выделенный секрет в проде. |
| **`TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`** | ID **топика** (forum thread) в админской Telegram-группе для **системных алертов** (**`NotificationService.sendSystemAlert`** / **`notifySystemAlert`**): FX stale, сбои брони/чата/платежей, cron, webhooks и т.д. При отсутствии или неверном значении — fallback **`sendToAdmin`** (личка / топик FINANCE). См. §1.6 и §5.3. |

---

## 10. E2E Hygiene System (правила и обязательность)

1. **Маркер данных:** любые сиды и фикстуры помечают сущности строкой **`[E2E_TEST_DATA]`** (константа **`lib/e2e/test-data-tag.js`**), чтобы их можно было отфильтровать из публичного поиска, списков чата и выборок «как у пользователя».
2. **Фильтрация в коде:** поиск листингов, SSR, `db-service`, `BookingService.getBookings`, **`GET /api/v2/chat/conversations`** (для не-staff) исключают помеченные записи; для Playwright при заголовке **`x-e2e-test-mode`** фильтр можно обходить (см. роут conversations).
3. **`globalTeardown`:** в **`playwright.config.ts`** указан **`tests/global-teardown.ts`** — после прогона удаляются артефакты с тегом и связанные строки. Это **обязательная** часть гигиены при работе с тестовой/staging БД. Вручную: **`node scripts/clean-e2e-garbage.mjs`** (поддержка **`--dry-run`**).
4. **Production smoke:** проекты **`setup-production-smoke`** + **`production-smoke`** включаются только при **`RUN_PRODUCTION_SMOKE=1`**; базовый URL — **`PRODUCTION_SMOKE_URL`** (по умолчанию **`https://gostaylo.com`**). Сценарии **не** вызывают internal fixture API (нет лишних броней и уведомлений реальным хостам); используются учётные данные **`E2E_PARTNER_EMAIL`** / **`E2E_PASSWORD`**. При **`RUN_PRODUCTION_SMOKE=1`** teardown **не выполняется** (защита прод-БД из `.env`). Опционально: **`E2E_PRODUCTION_LISTING_ID`** для стабильной карточки листинга.

---

## 11. Roadmap: Future bots & monitoring

- **SEO Spy Bot** — периодический обход ключевых публичных URL: проверка **`title`**, **`meta description`**, **`og:*`**, **`h1`**, канонических ссылок и кодов ответа; алерт при регрессии относительно baseline или чек-листа.
- **Accountant Bot** — синтетические сценарии мультивалютной витрины и брони: согласованность **RUB / THB / USD** (и др.) с **`exchange_rates`** и **`CurrencyService.getDisplayRateMap`**, отсутствие «магических» курсов в UI/логах, смок **`GET /api/v2/exchange-rates`**.
- **Bot #25: E2E Data Sentinel** — nightly: поиск утечек **`[E2E_TEST_DATA]`** в публичных API/SSR и алерт.
- **Bot #26: Notification Contract Diff** — сравнение HTML/email с baseline (deep links, календарь, вложения, i18n).
- **Bot #27: Calendar Link Guard** — TTL/валидность **`/api/calendar/stay`**, наличие **`CALENDAR_STAY_LINK_SECRET`** в окружениях.
- **Bot #28: Telegram Action Security** — синтетика lifecycle ban-token (подпись, TTL, replay).

---

**Версия:** апрель 2026 — §9 env secrets; §10–11 E2E hygiene + roadmap; production-smoke Playwright; premium notifications (deep links + Outlook + ICS), notification integrity e2e; §8 admin ban + critical telemetry; SEO листинга в **`app/listings/[id]/layout.js`**.
