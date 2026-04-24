# Marketing handbook (Flash Sale, social proof, Telegram)

Краткий операционный гид по маркетинговому блоку (Stages 34–41). Детальная привязка к файлам — **`docs/ARCHITECTURAL_PASSPORT.md`** (см. Stage 40–41).

## 1. Фазы Social Proof (плашка «горячо» на карточке)

**Источник правил:** `lib/listing/flash-hot-strip.js` — `resolveFlashHotStripState(catalog_flash_urgency, catalog_flash_social_proof, nowMs)`.

- Нужны оба поля из API: `catalog_flash_urgency.ends_at` и `catalog_flash_social_proof.bookingsCreatedCount` (и активный flash-промо к листингу).
- **Фаза A — «сегодня забронировали»:** остаток до конца акции **> 6 часов** и **bookingsCreatedCount > 0**. Показывается блок с 🔥 и числом.
- **Фаза B — «истекает скоро»:** остаток **≤ 6 часов**. Показывается ⏰ и оставшееся время **ЧЧ:ММ** (отдельно от общего `UrgencyTimer`, чтобы не дублировать смысл).

**Тексты (A/B без деплоя):**

1. Дефолты (код): `lib/constants/marketing.js` — ключи `flashHotBookingsToday`, `flashHotExpiresIn` для `ru` / `en` / `zh` / `th` (плейсхолдеры `{{count}}`, `{{hm}}`).
2. Переопределение в БД: таблица **`system_settings`**, ключ **`marketing_ui_strings`**, значение JSON вида:

```json
{
  "ru": {
    "flashHotBookingsToday": "Выбор гостей: {{count}} бронирований сегодня",
    "flashHotExpiresIn": "Спеццена ещё {{hm}}"
  },
  "en": { "flashHotBookingsToday": "…", "flashHotExpiresIn": "…" }
}
```

Сервер мерджит это в `lib/marketing/marketing-ui-strings.js` (`resolveMarketingUiStrings`). Клиент берёт строки с **`GET /api/v2/marketing/ui-strings?lang=ru`**; при ошибке сети UI падает на ключи **`listingFlashHot_*`** в `lib/translations`.

### 1.1 Админка: как менять тексты (Stage 41.0)

1. Откройте **`/admin/marketing`** → секция **UI Copywriting**.
2. В текстовом поле — валидный JSON-объект верхнего уровня: ключи языков **`ru`**, **`en`**, **`zh`**, **`th`** (другие ключи сервер отклонит с ошибкой).
3. Внутри каждого языка допускаются только известные поля (сейчас **`flashHotBookingsToday`**, **`flashHotExpiresIn`**). Можно указать только те языки/поля, которые нужно переопределить.
4. **Обязательные плейсхолдеры** (если поле задано непустой строкой):
   - **`flashHotBookingsToday`** — строка **должна содержать** подстроку **`{{count}}`** (подстановка числа бронирований «сегодня»).
   - **`flashHotExpiresIn`** — строка **должна содержать** **`{{hm}}`** (подстановка «ЧЧ:ММ» до конца акции).
5. Кнопка **Сохранить** выполняет ту же валидацию в браузере и на сервере (`lib/marketing/validate-marketing-ui-strings.js`, **`PUT /api/admin/marketing/ui-strings`**).
6. Пустой объект **`{}`** очищает все переопределения в `marketing_ui_strings` — снова используются только дефолты из кода.
7. API публичной выдачи строк кешируется (`s-maxage` ~2 мин) — изменения в БД видны на сайте с небольшой задержкой.

## 2. Крон и дедупликация напоминаний партнёру

- **Маршрут:** `app/api/cron/flash-sale-reminder/route.js` (расписание в `vercel.json`, интервал ~15 мин).
- **Защита:** заголовок `x-cron-secret` или `Authorization: Bearer <CRON_SECRET>` (как у прочих кронов).
- **Логика:** выбор кандидатов (активный partner Flash, до дедлайна ~1 час), затем **`MarketingNotificationsService.sendFlashSaleReminder`**.
- **Дедуп:** атомарный RPC **`promo_try_acquire_reminder_lock`** — ключ вида `flash_1h_reminder_<YYYY-MM-DD-HH>` (календарный час **Asia/Bangkok**) в `promo_codes.metadata.reminder_locks`. Параллельные запуски крона не шлют второе сообщение в тот же час. После успешной отправки в Telegram обновляется **`last_reminder_sent_at`** в metadata (аудит).

## 3. Партнёр и Telegram-бот

- При создании партнёрского Flash Sale админ-канал получает сводку (**`MarketingNotificationsService.onPartnerFlashSaleCreated`**).
- За ~1 час до `valid_until` партнёр с привязанным **`profiles.telegram_id`** получает DM с KPI числа созданных броней по коду и inline-кнопкой «Продлить» (URL на **`/partner/promo?flashCode=…&extendHours=6`**).
- Продление выполняется **`POST /api/v2/partner/promo-codes/[code]/extend-flash-sale`** (сессия партнёра + rate limit `promo_extend`). Тело может содержать `extensionSource: "telegram_deeplink"` для корректного **`audit_logs`**.
- Команда **`/promo`** в боте (см. обработчики в `lib/services/telegram/`) — список активных Flash и KPI для партнёра.

## 4. Гость после брони с Flash Sale (мультиязычность)

При успешном **`createBooking`** (статус **PENDING**): если промо было flash и у гостя есть **`telegram_id`**, отправляется DM (**`notifyGuestFlashSaleBookingCongrats`**).

- **Язык текста:** сначала **`profiles.preferred_language`** (если задан и распознан как `ru`/`en`/`zh`/`th`), иначе **`profiles.language`**, иначе **English** как канонический fallback.
- **Шаблоны** (не смешиваются с публичным `getUIText`): `lib/translations/marketing-guest-notifications.js` — тела и строка с названием листинга для RU/EN/ZH/TH.
- Колонка **`preferred_language`**: миграция **`prisma/migrations/009_stage41_profile_preferred_language.sql`** — выполните на Supabase до использования поля в проде.

В **`pricing_snapshot.promo`** по-прежнему пишется **`is_flash_sale: true`** для SSOT аналитики.

## 5. Календарь партнёра: индикатор Flash (Stage 41.0)

Для дней со статусом **AVAILABLE**, где **`buildMarketingPromoForDay`** (через **`checkApplicabilityCached`** из **`promo-engine`**) выбрал промо с **`is_flash_sale`**, в **`CalendarGrid.jsx`**:

- тонкая **внутренняя оранжевая обводка** ячейки (если день не «сегодня» с teal-кольцом);
- маленькая **оранжевая точка** в правом верхнем углу.

Логика совпадает с календарным API (`app/api/v2/partner/calendar/route.js`).

## 6. Безопасность промо

- **`POST /api/v2/promo-codes/validate`:** rate limit по IP (`promo_validate`); валидация через **`PricingService.validatePromoCode`**.
- **`extend-flash-sale`:** партнёрская сессия + лимит `promo_extend`.

---

При изменении правил применимости промо правьте **`lib/promo/promo-engine.js`** и **`PricingService`** — это SSOT для каталога, календаря и чекаута.
