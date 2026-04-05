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

---

## 6. Указатель на ядро (файлы)

| Область | Файл(ы) |
|--------|---------|
| FX / комиссия / чат-курс | `lib/services/currency.service.js`, `lib/services/currency-last-resort.js` |
| Отображение символов валют | `lib/currency.js` (`CURRENCIES`, `formatPrice`) |
| Календарь + бронь | `lib/services/calendar.service.js`, `lib/services/booking.service.js` |
| Цены по датам | `lib/services/pricing.service.js` |
| iCal → блоки | `lib/services/ical-calendar-blocks-sync.js` |
| Категории / UI брони | `lib/listing-booking-ui.js`, `lib/listing-category-slug.js` |
| Туры: metadata группы + миграция | `lib/partner/listing-wizard-metadata.js` |
| Чат + статусы брони | `app/api/v2/chat/messages/route.js`, `lib/services/chat/access.js`, `lib/booking-status-chat-sync.js` |
| Auth edge + login | `middleware.ts`, `app/login/page.js`, `app/admin/layout.js` |
| Realtime чат (backoff) | `lib/chat/realtime-subscribe-with-backoff.js`, `hooks/use-realtime-chat.js`, `lib/context/ChatContext.jsx` |
| Платежи / эскроу | `lib/services/payment.service.js`, `lib/services/escrow.service.js`, `app/api/cron/payouts` |

---

**Версия:** апрель 2026 — единый стандарт cookie-auth + `/login`, админка без gate на `localStorage`, усиление `POST /api/v2/chat/messages`, устойчивый Realtime-reconnect; плюс CurrencyService, схема Properties / Vehicles / Tours и `group_size`.
