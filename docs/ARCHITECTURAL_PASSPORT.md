# Gostaylo — Architectural Passport

> **Version**: 3.7.5 | **Last Updated**: 2026-04-22 | **Status**: Production-Ready
> 
> Архитектура, маршруты, схемы и стандарты. **Порядок для агентов:** сначала **`ARCHITECTURAL_DECISIONS.md`** (SSOT), затем **`docs/TECHNICAL_MANIFESTO.md`** (code-truth), затем этот паспорт. Синхронизация с кодом — **`AGENTS.md`** и **`.cursor/rules/gostaylo-docs-constitution.mdc`**.

---

## 0. Critical Routes & Services

### 0.0a Admin Financial Health (Ledger)
- **UI:** `app/admin/financial-health/page.jsx` — маршрут **`/admin/financial-health`**, карточки остатков по счетам **PROCESSING_POT_ROUNDING** («котёл на платёжки») и **INSURANCE_FUND_RESERVE** (страховой фонд), плюс **PLATFORM_FEE** и агрегат **PARTNER_EARNINGS**; блок **сверки Cash (MVP)** при **`marginLeakage`**; кнопка **«Сформировать реестр для Т-Банка»** (скачивание CSV); таблица выплат в **`PROCESSING`** с кнопками **PAID** / **FAILED** и **AlertDialog** подтверждения перед отправкой **PATCH**.
- **API:** **`GET /api/v2/admin/ledger-balances`** — только **`profiles.role === 'ADMIN'`**; агрегация **`sum(CREDIT) − sum(DEBIT)`** по строкам **`ledger_entries`** (см. **`lib/services/ledger.service.js`**). **`GET /api/v2/admin/ledger-reconciliation`** — сверка **только Booking Capture**: **DEBIT** по **`GUEST_PAYMENT_CLEARING`** и **CREDIT** по прочим счетам **внутри журналов с clearing DEBIT**; **CREDIT** на **`PARTNER_PAYOUTS_SETTLED`** в «распределение» не входят; smoke **`payoutSelfCheck`** (открытые выплаты vs **PARTNER_EARNINGS**). Расхождение clearing↔credits или несходящиеся журналы → **Margin Leakage**.
- **T-Bank CSV:** **`POST /api/v2/admin/payouts/tbank-registry`** — см. **`lib/services/tbank-payout-registry.service.js`**: **`payouts` PENDING**, метод **`pm-bank-ru`** (или BANK+RUB), только **`partner_payout_profiles.is_verified`**, полные **`data`** (счёт, БИК, ИНН). После экспорта — **`PROCESSING`**. Формат колонок: **ФИО;Номер счета;БИК;ИНН;Назначение платежа;Сумма** (UTF-8 BOM); опционально **`encoding: windows-1251`** → **`csvBase64`**. Верификация профилей: **`/admin/payout-verification`**, API **`GET /api/v2/admin/partner-payout-profiles`**, **`PATCH .../[id]`** с **`action: verify`**.
- **Копилка / страховой фонд (ledger):** на **`/admin/financial-health`** две карточки по данным **`ledgerReporting`** из **`GET /api/v2/admin/ledger-balances`**: **Rounding Pot** = счёт **`PROCESSING_POT_ROUNDING`** (алиас **FEE_CLEARING**), **Insurance Fund** = **`INSURANCE_FUND_RESERVE`** (алиас **RESERVES**); соглашение по балансу — как в **`ledger-balances`**.
- **Проводки:** при успешном **`EscrowService.moveToEscrow`** (бронь → **`PAID_ESCROW`**, подтверждённая оплата через **`PaymentsV3Service.confirmPayment`**) создаётся журнал **`BOOKING_PAYMENT_CAPTURED`** с пятью ногами: **DEBIT** `GUEST_PAYMENT_CLEARING`; **CREDIT** партнёрский счёт, **PLATFORM_FEE**, **INSURANCE_FUND_RESERVE**, **PROCESSING_POT_ROUNDING**. Суммы берутся из **`pricing_snapshot.fee_split_v2`** / колонок брони (идемпотентность: **`ledger_journals.idempotency_key`**). Журналы без брони: **`ledger_journals.booking_id`** может быть **NULL** (миграция **`032_ledger_payout_settlement.sql`**) — проводка **`PARTNER_PAYOUT_OBLIGATION_SETTLED`** при ручном **PAID**: **DEBIT** `PARTNER_EARNINGS` (партнёр), **CREDIT** **`PARTNER_PAYOUTS_SETTLED`** (`la-sys-partner-payouts-settled`), сумма **THB** = **`payouts.gross_amount`** (база до комиссии метода).

### 0.0a1 Partner dashboard & payout profiles (trust / viz)
- **`GET /api/v2/partner/stats`** — блок **`financialV2`**: «деньги в пути» по броням **`PAID_ESCROW`** (тот же расчёт дохода партнёра, что и в карточке «Доход») и помесячные суммы по **`payouts`** со статусами **`PAID`** / **`COMPLETED`** (см. **`docs/TECHNICAL_MANIFESTO.md`**). Клиент: **`app/partner/dashboard/page.js`** (график **recharts**); карточка «Будущий доход» ведёт на **`/partner/finances?status=PAID_ESCROW`** (фильтр списка броней на **`app/partner/finances/page.js`**).
- **PR-#2 баланс по эскроу:** **`GET /api/v2/partner/balance-breakdown`** — **`frozenBalanceThb`** / **`availableBalanceThb`** (агрегат из броней **`PAID_ESCROW`** / **`THAWED`**), **`byCategory`** (slug категории листинга), **`recentLedgerTransactions`** (последние строки **`ledger_entries`** партнёра). Колонки **`profiles.frozen_balance_thb`**, **`profiles.available_balance_thb`** синхронизируются в **`EscrowService`**. Разморозка: **`POST /api/cron/escrow-thaw`**. Из‑за лимитов **Vercel Hobby** (cron не чаще 1/день) критичные кроны запускаются гибридно: Vercel расписание остаётся daily для валидного деплоя, а **hourly** для **`escrow-thaw`** дублируется внешним планировщиком (cron-job.org) с заголовком `Authorization: Bearer CRON_SECRET` (или `x-cron-secret`). Роут **`/api/cron/payouts`** удалён из приложения (исторический автопул); см. архив **`legacy/unused-cron-logic/`**. Партнёрский UI: **`/partner/finances`** (карточка баланса + таблица ledger).
- **PR-#3 отзывы партнёра о госте:** миграция **`database/migrations/034_guest_reviews.sql`** — **`guest_reviews`** (**`author_id`** = партнёр, **`guest_id`** = рентер, **`booking_id`** UNIQUE). **`GET /api/v2/partner/pending-reviews`** — брони **`THAWED`** / **`COMPLETED`** без строки в **`guest_reviews`**. **`POST /api/v2/partner/guest-reviews`**. UI: **`/partner/bookings/[bookingId]/guest-review`**, кнопка из списка броней при **`canSubmitGuestReview`**. После перехода в **`THAWED`** (**`EscrowService.thawBookingToThawed`**) — **`NotificationEvents.PARTNER_GUEST_REVIEW_INVITE`**: Telegram + FCM **`PARTNER_GUEST_REVIEW`** с deep link **`/partner/bookings/{bookingId}/guest-review`**.
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
- **UI:** `app/admin/health/page.jsx` — маршрут **`/admin/health`**, карточки **`rounded-2xl`**: агрегаты **`ops_job_runs`** (7 дн.) для **`ical-sync`**, **`push-sweeper`**, **`push-token-hygiene`**, блок **`critical_signal_events`** (`PRICE_TAMPERING`).
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
│   │   ├── booking.service.js    # Booking management
│   │   ├── payments-v3.service.js # Payment orchestration (active)
│   │   └── notification.service.js # Telegram + Email dispatcher
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
| `validatePromoCode(code, bookingAmount)` | Promo code validation | YES |

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
NotificationService (lib/services/notification.service.js)
    │
    ├── sendEmail(to, subject, text, html)  → Resend API
    │
    ├── sendTelegram(chatId, message)       → Telegram Bot API
    │
    └── sendToAdminTopic(topic, message)    → Telegram Topics
                │
                ├── BOOKINGS (thread 15)
                ├── FINANCE (thread 16)
                └── NEW_PARTNERS (thread 17)
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
| GET | `/api/v2/listings?category=villas` | Filter by category |
| GET | `/api/v2/listings/[id]` | Get single listing |
| POST | `/api/v2/listings` | Create listing (Partner) |
| PATCH | `/api/v2/listings/[id]` | Update listing |

### 7.2 Bookings API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/bookings` | List user's bookings |
| POST | `/api/v2/bookings` | Create booking |
| GET | `/api/v2/bookings/[id]/payment-status` | Get booking + listing info |
| POST | `/api/v2/bookings/[id]/payment/initiate` | Start payment flow |
| POST | `/api/v2/bookings/[id]/payment/confirm` | Подтверждение оплаты гостем → **`PAID_ESCROW`** через **`EscrowService.moveToEscrow`** (ledger); идемпотентно при повторном вызове |
| GET, POST | `/api/cron/review-reminder` | Cron: push + Telegram гостю на следующий календарный день после **`check_out`** (если ещё нет отзыва). **GET и POST** при валидном **`CRON_SECRET`** выполняют одну и ту же логику (Vercel Cron шлёт **GET**; внешний планировщик может использовать **POST**). Без **`CRON_SECRET`** в env → **503**. Сравнение Bearer-токена допускает пробелы после `Bearer`, значение секрета **trim**. |
| POST | `/api/v2/bookings/[id]/check-in/confirm` | Confirm check-in |
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
| GET | `/api/v2/admin/moderation` | Get pending listings |
| POST | `/api/v2/admin/moderation/approve` | Approve listing |
| POST | `/api/v2/admin/moderation/reject` | Reject listing |
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
