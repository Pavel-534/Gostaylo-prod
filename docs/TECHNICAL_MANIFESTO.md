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

- **`formatPrice(amountThb, currency, exchangeRates)`** в **`lib/currency.js`** — для валюты ≠ THB **делит** сумму в THB на **`exchangeRates[currency]`**, **только если** в переданной карте есть конечный положительный курс. Иначе отображается число в THB с символом выбранной валюты (без выдуманного кросса). **Таблицы курсов в `lib/currency.js` нет** (удалены неиспользуемые конвертеры с литералами).
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

### 1.5 Витринные курсы, снимок брони, оплата

- **Единый источник курсов для витрины и полей `price_paid` / `exchange_rate` при создании брони:** **`CurrencyService.getDisplayRateMap()`**. Конвертация в список для поиска по коду — **`PricingService.getExchangeRates()`** (динамический импорт **`currency.service.js`**).
- **При INSERT в `bookings`:** `exchange_rate` = **`rateToThb`** выбранной валюты запроса (THB за 1 единицу); **`price_paid`** = **`price_thb / exchange_rate`**. Для **`currency === 'THB'`** курс **1**.
- **Пересчёта при переходе в PAID нет:** **`BookingService.updateStatus`** и **`PUT /api/v2/partner/bookings/[id]`** меняют только **`status`** и временные метки (**`checked_in_at`** для PAID в partner flow), не трогая **`price_thb`**, **`exchange_rate`**, **`commission_*`**.
- **USDT в момент оплаты:** **`resolveThbPerUsdt()`** (цепочка **`exchange_rates` → API → env / `system_settings`**) используется в **`payment/initiate`**, **`payment.service`**, верификации Tron — это **операционный курс оплаты**, не обязано совпадать с **`bookings.exchange_rate`** (который про валюту запроса USD/RUB/CNY). Счета в чате THB↔USDT — **`getEffectiveRate`** + **`resolveChatInvoiceRateMultiplier`** (отдельно от **`getDisplayRateMap`**).
- **Скан на «магические» курсы:** литералов **1.035 / 0.965** в финансовом ядре нет. Число **1.02** — только как платформенный дефолт **`chatInvoiceRateMultiplier`** в **`currency-last-resort.js`** / placeholder админки, не как множитель витринного **`getDisplayRateMap`**. **`GET /api/v2/partner/stats`:** доход партнёра из **`partner_earnings_thb`**, иначе **`price_thb − commission_thb`**, иначе **`price_thb × (1 − commission_rate/100)`** — без фиксированного **0.85**.

### 1.6 Admin Health Alerts (дисплей-FX)

- **Когда:** при загрузке карты курсов для витрины **`CurrencyService.getDisplayRateMap`** оценивает «свежесть» строк **`exchange_rates`** (в т.ч. USDT с **`updated_at`**). Если для любой из ожидаемых валют в карте **нет** `updated_at` или возраст **`updated_at` &gt; 24 ч** (`DISPLAY_FX_STALE_ALERT_MS`), состояние считается **stale**.
- **Лог + Telegram админу:** **`maybeAlertStaleDisplayRates`** пишет **`console.warn`**, затем **`NotificationService.sendToAdmin`** с текстом вида **«КРИТИЧНО: Курсы валют устарели»** и подписью последнего обновления (Bangkok TZ). Повторная отправка не чаще чем раз в **1 ч** (`DISPLAY_FX_STALE_ALERT_COOLDOWN_MS`), чтобы не спамить при частых запросах.
- **Куда уходит `sendToAdmin`:** приоритет — личка **`TELEGRAM_ADMIN_DM_CHAT_ID`** или **`ADMIN_TELEGRAM_ID`**; иначе — админ-топик (как у прочих admin Telegram-сообщений). Реализация — **`lib/services/notification.service.js`**.
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

- **Скругления:** базовый радиус интерфейса через `--radius: 1rem` в **`app/globals.css`**; в мобильном чате все ключевые блоки (`ChatMessageList`, `ChatMilestoneCard`, `BookingRequestCard`, `ChatActionBar`, оба composer) используют **`rounded-2xl`**.
- **Палитра:** нейтральная база **`bg-white`** + **`bg-slate-50`**; основной акцент в интерактивах — **teal** (`bg-teal-600`, hover `bg-teal-700`) для primary-кнопок (`Оплатить`, `Подтвердить`, `Отправить`).
- **Отступы и safe areas:** контейнеры ленты/композера и вставки баннеров соблюдают боковые **`px-4`** на мобиле и **`sm:px-5`**; нижний safe-area — через **`CHAT_COMPOSER_SHELL_CLASS`** (`pb-[max(1rem, env(safe-area-inset-bottom,0px))]`).
- **Ширина мобильных CTA:** action buttons и booking CTA идут **`w-full`** на мобильном брейкпоинте, с переходом в `sm:w-auto` только на больших экранах.

### 5.2 Telegram бот и admin alerts

- **Единый диспетчер:** `NotificationService.dispatch(event, data)` маппит события (`NEW_BOOKING_REQUEST`, `BOOKING_CONFIRMED`, `PAYMENT_*`, `PAYOUT_*`) на обработчики e-mail + Telegram.
- **Канал админа:** `NotificationService.sendToAdmin` отправляет в приоритете личный чат (`TELEGRAM_ADMIN_DM_CHAT_ID` или `ADMIN_TELEGRAM_ID`), fallback — админ-топик (`sendToAdminTopic`).
- **Системные health-alerts:** `CurrencyService.maybeAlertStaleDisplayRates` поднимает Telegram-алерт при stale FX (`>24h`), с cooldown 1 час, плюс admin API **`/api/v2/admin/exchange-rates-health`** для UI-баннера.
- **Куда расширять «системные проблемы»:** текущий слой уже подходит для новых событий типа `EXTERNAL_API_DOWN`, `PAYMENT_GATEWAY_DEGRADED`, `CRON_STUCK` — достаточно добавить событие в `NotificationEvents`, handler в `NotificationService` и единый вызов из места детекта.

---

## 6. Указатель на ядро (файлы)

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
| Чат + статусы брони | `app/api/v2/chat/messages/route.js`, `lib/services/chat/access.js`, `lib/booking-status-chat-sync.js` |
| Auth edge + login | `middleware.ts`, `app/login/page.js`, `app/admin/layout.js` |
| Realtime чат (backoff) | `lib/chat/realtime-subscribe-with-backoff.js`, `hooks/use-realtime-chat.js`, `lib/context/ChatContext.jsx` |
| Платежи / эскроу | `lib/services/payment.service.js`, `lib/services/escrow.service.js`, `app/api/cron/payouts` |

---

**Версия:** апрель 2026 — единый стандарт cookie-auth + `/login`, админка без gate на `localStorage`, усиление `POST /api/v2/chat/messages`, устойчивый Realtime-reconnect; плюс CurrencyService, схема Properties / Vehicles / Tours и `group_size`.
