# Product Flow Map — GoStayLo

**Version:** 2.0.0  
**Last updated:** 2026-05-20 | **Stage 112.3:** iCal/seasonal/referral/push API clients; realtime auth SSOT; 109–112.x closed. | **Stage 112.2:** calendar/bookings/finances clients. | **Stage 112.1:** Go/No-Go; chat hooks → API clients. | **Stage 112.0:** pre-launch hardening — chat-ui + catalog-public; admin messages single enrich fetch. | **Stage 111.2:** all FinTech admin panels via API client. | **Stage 111.1:** home + FinTech API clients, catalog-public SSOT. | **Stage 111.0:** pre-launch page split — admin marketing/payments, partner dashboard, renter profile → hooks + PageContent; payments API client. | **Stage 110.8:** final polish — chat API client SSOT, page unload via api-clients/hooks. | **Stage 110.6b:** invoice = storefront (retail FX SSOT, partner guest prefill, dual-currency guest display). | **Stage 110.7:** chat final (`conversation-api-client`, inbox UPDATE merge, outbound thread-only); P2 UI extract — partner dashboard widgets, renter profile modal/completion, marketing promo helpers. | **Stage 110.6:** outbound/inbox polish, `post-chat-invoice.js`, P1-2 send pipeline closed on `/messages`. | **Stage 110.5:** Chat SSOT — `post-chat-message.server.js`, invoice → тот же POST; inbox/thread Realtime без дубля. | **Stage 110.4:** SSOT FX — `lib/pricing/fx-display.js`; витрина `retail=1`, settlement `retail=0`; wizard preview = retail rateMap в `baseCurrency`. | **Stage 109.0:** Admin FinTech console refactor (panels + hook, owner mode preserved). | **Stage 108.5 (FIN):** pricing aliases, chat badge dedup, FX cache v3, owner FinTech polish. | **Stage 108.4:** schema verify, status SSOT, CHECKED_IN UI. | **Stage 108.3:** cron health, thread Realtime dedup. | **Stage 108.1–108.2:** payout guard, dead UI, chat POST SSOT.  
**Audience:** product, engineering, AI agents  
**Status:** code-truth snapshot; normative policy remains **`ARCHITECTURAL_DECISIONS.md`** and **`docs/ADR/097-financial-model-v2.md`**

---

## 1. Назначение

Единая **карта сквозного пути** гостя и хоста (от регистрации до выплаты и отзывов) с указанием:

- канонических API и сервисов (SSOT);
- параллельных/legacy путей, которые нельзя размножать;
- известных слабых мест и очереди PR (**§8**).

Связанные документы:

| Документ | Роль |
|----------|------|
| `ARCHITECTURAL_DECISIONS.md` | Политика, золотые правила |
| `docs/TECHNICAL_MANIFESTO.md` | Сжатый code-truth по стадиям |
| `docs/ARCHITECTURAL_PASSPORT.md` | Маршруты, таблицы, UI |
| `docs/ADR/097-financial-model-v2.md` | Финмодель v2, Concierge |
| `docs/SEARCH_FILTERS_QUERY_MAP.md` | Каталог → SQL |
| `docs/CRON_EXTERNAL_FINANCIAL.md` | Hourly financial crons |
| `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md` | День выплаты |
| `docs/PRE_LAUNCH_CHECKLIST.md` | Pre-launch |

---

## 2. SSOT по доменам

| Домен | SSOT (читать первым) | Не считать SSOT |
|--------|----------------------|-----------------|
| Политика | `ARCHITECTURAL_DECISIONS.md` | Старые комментарии в UI |
| Вертикаль листинга | `categories.slug` + `categories.wizard_profile` | Только `category_id` без slug |
| Поиск каталога | `lib/api/run-listings-search-get.js` | Прямой PostgREST с клиента |
| Создание брони | `POST /api/v2/bookings` → `lib/services/booking/creation.js` / `inquiry.service.js` | Прямой INSERT в `bookings` |
| Атомарность create | RPC `create_booking_atomic_v1` | Двухшаговый create без RPC |
| Цена на create | `pricing_snapshot` + `lib/services/booking/pricing-engine-integration.js` | Клиентский total без attestation |
| Settlement на оплате | `lib/services/booking/pricing.service.js` (`settlement_v3`) | Пересчёт комиссии на confirm |
| Комиссия / FX | `lib/services/currency.service.js`, `exchange_rates`, snapshot | Литералы 10%/35.5 в коде |
| Переходы статусов (хост) | `lib/booking/status-transitions.js` | Локальные копии `STATUS_TRANSITIONS` |
| UI-лейблы статусов | `lib/booking/booking-status-display.js` | Только `lib/config/app-constants.js` |
| Оплата → эскроу | `EscrowService.moveToEscrow` + RPC `move_to_escrow_and_post_ledger_v1` | Прямой `status = PAID_ESCROW` |
| Разморозка | Cron `POST /api/cron/escrow-thaw` | Ручной `CHECKED_IN` как замена thaw |
| Доступно к выплате | Cron `promote-ready-for-payout` + `lib/partner/partner-payout-eligibility.js` | — |
| Выплата prod (Concierge) | `PayoutBatchService` + ручной банк | `EscrowService.processPayout` (**заблокирован** Stage 108.1) |
| Чат | `/messages/[id]`, `/api/v2/chat/*` | `/chat/[id]` (только redirect) |
| Отзыв гостя | `POST /api/v2/reviews`, `lib/orders/order-timeline.js` | — |
| Рейтинг на карточке | `listings.avg_rating` (триггер DB) | Клиентский средний без БД |
| Юр. версии | `LegalVersionsService`, `lib/legal-consent.js` | Хардкод версии только в config |
| Сессия | `gostaylo_session`, `lib/auth/verify-app-session-jwt.js` | `auth.uid()` как `profiles.id` |

---

## 3. Сквозная диаграмма (гость + хост)

```mermaid
flowchart TB
  subgraph auth [Auth]
    R[Register / Login / Google OAuth]
    R --> S[gostaylo_session JWT]
  end

  subgraph discover [Discovery]
    S --> H[Home /listings]
    H --> PDP[PDP /listings/id]
  end

  subgraph book [Booking]
    PDP --> CB{POST /api/v2/bookings}
    CB -->|instant_booking| CF[CONFIRMED]
    CB -->|inquiry / pending| CP[PENDING / INQUIRY]
    CP --> PF[Partner PUT → CONFIRMED]
    CF --> CH[Chat /messages/id]
    PF --> CH
  end

  subgraph pay [Payment]
    CH --> CO[/checkout/bookingId]
    CO --> PE[PAID_ESCROW + ledger RPC]
  end

  subgraph escrow [Escrow lifecycle]
    PE --> CR1[cron escrow-thaw hourly]
    CR1 --> TH[THAWED]
    TH --> CR2[cron promote-ready-for-payout hourly]
    CR2 --> RFP[READY_FOR_PAYOUT]
  end

  subgraph stay [Stay and reviews]
    PE --> CI[optional check-in → CHECKED_IN]
    CI --> RV[POST /api/v2/reviews]
    TH --> RV
  end

  subgraph treasury [Treasury Concierge]
    RFP --> POOL[Admin pool DRAFT → LOCK → CSV]
    POOL --> BANK[Bank transfer manual]
    BANK --> SET[markBatchSettled → COMPLETED + PDF]
  end
```

---

## 4. Фазы продукта (детально)

### 4.1 Регистрация и роли

| Шаг | UI | API / код |
|-----|-----|-----------|
| Email/password | `contexts/auth-context.jsx`, `AuthModal` | `POST /api/v2/auth/register`, `login` |
| Google OAuth | Same + `app/auth/callback/route.js` | Supabase PKCE → `oauth-profile-sync.service.js` |
| Юр. согласие | `LegalConsentCheckboxRow` | `acceptedLegalTerms`, `profiles.terms_accepted_at` |
| Сессия | Cookie `gostaylo_session` | `lib/auth/app-session-issue.js`, `session-service.js` |
| Роли | Redirect после login | `RENTER` / `PARTNER` / `ADMIN` |

**Инвариант:** финальная сессия приложения — всегда JWT GoStayLo, не только Supabase session.

---

### 4.2 Каталог и выбор объекта

| Шаг | UI | API / код |
|-----|-----|-----------|
| Главная | `PlatformHomeContent`, `HomeHeroLuxe` | `GET /api/v2/categories` |
| Каталог | `app/listings/*`, `useListingsSearch` | `GET /api/v2/search`, `GET /api/v2/listings/search` → **`runListingsSearchGet`** |
| Фильтры | `SearchFiltersDialog`, `docs/SEARCH_FILTERS_QUERY_MAP.md` | `query-builder`, `listing-metadata-filter` |
| PDP | `app/listings/[id]/page.js` | `GET /api/v2/listings/[id]` |
| Цена на карточке / фильтр | `ListingCard`, `CardPriceDisplay`, **`guest-display-price.js`**, **`fx-display.js`** | **110.1:** guest THB = base + `guestServiceFeePercent`; search → `guestDisplayPriceThb`. **110.4:** FX в UI = **`formatDisplayPriceInCurrency`** + retail `rateMap` (`fetchExchangeRates({ retail: true })`, API `?retail=1`). PDP hero — тот же контракт. Breakdown брони / snapshot — mid FX, без retail. |
| Trust | `ListingTrustVerifiedMiniBadge` | `listingQualifiesForTrustVerifiedMiniBadge` + `owner.is_verified` |

**Инвариант:** категории с `is_preview_only` / неактивные скрыты для не-админа (Stage 85).

---

### 4.3 Бронирование

| Ветка | Условие | Статус после create | Сервис |
|-------|---------|---------------------|--------|
| Instant Book | `listings.instant_booking` | `CONFIRMED` | `createBooking` + `forceStatus` |
| Request | default | `PENDING` | `createBooking` |
| Inquiry / мало мест | guests > min_remaining / private trip | `INQUIRY` | `createInquiryBooking` |

| Компонент | Путь |
|-----------|------|
| HTTP | `app/api/v2/bookings/route.js` |
| Create | `lib/services/booking/creation.js` |
| Inquiry + calendar | `lib/services/booking/inquiry.service.js` |
| Orchestrator | `lib/services/booking.service.js` |
| DB lock | RPC `create_booking_atomic_v1` |
| Price integrity | `lib/booking-price-integrity.js` |
| Чат после create | `ensureBookingConversation()` |
| **Наборы статусов (110.2)** | **`lib/booking/status-sets.js`** — занятость календаря, iCal, ROI, escrow pipe, чат Pay now, transport confirm, cancel/refund, FinTech; FSM — **`status-transitions.js`** |
| **Ledger / выплаты (110.3)** | Оплата → **`LedgerService.postPaymentCaptureFromBooking`**; batch settle → **`postPartnerBatchBookingPayoutSettled`**; модули **`lib/services/ledger/*`**; prod payout только **`PayoutBatchService`** |

**INQUIRY** не в `OCCUPYING_BOOKING_STATUSES` — запрос в чате не резервирует даты до CONFIRMED (см. комментарии в `status-sets.js`).

**Партнёр подтверждает:** `PUT /api/v2/partner/bookings/[id]` (`STATUS_TRANSITIONS`), Telegram callbacks, кнопки в `UnifiedMessagesClient` (тот же PUT).

**Staff:** `PUT /api/v2/bookings/[id]` → `BookingService.updateStatus` — **узкий граф**, не использовать для новых фич.

---

### 4.4 Чат (до и после оплаты)

| Элемент | SSOT |
|---------|------|
| Inbox | `/messages`, `useConversationInbox` |
| Thread | `/messages/[id]`, `UnifiedMessagesClient.jsx` |
| Legacy URL | `/chat/[id]` → 302 `/messages/[id]` |
| Создание треда | `POST /api/v2/chat/conversations`, `from-profile`, `ensureBookingConversation` |
| Сообщения | `POST/GET /api/v2/chat/messages` |
| Realtime | `hooks/use-realtime-chat.js`, `GET /api/v2/auth/realtime-token` |
| Вложения | `lib/chat-upload.js` → `POST /api/v2/upload` (bucket `chat-attachments`) |
| Счёт в чате | `POST /api/v2/chat/invoice` → checkout `?invoiceId=` |
| Sync статуса брони | `lib/booking-status-chat-sync.js` |

**Realtime (110.5):** на треде один канал `inbox-messages` + `thread-inbox-bridge`; `deferThreadRealtime` отключает per-thread подписку. POST: `post-chat-message.server.js`; invoice делегирует туда же.

---

### 4.5 Оплата

| Шаг | Маршрут | Сервис |
|-----|---------|--------|
| Checkout UI | `app/checkout/[bookingId]/page.js` | hooks `useCheckout*` |
| Intent | `GET .../payment-intent` | `PaymentIntentService` |
| Initiate | `POST .../payment/initiate` | wallet + acquirer |
| Confirm | `POST .../payment/confirm` | `attachSettlementSnapshotForBooking` → **`moveToEscrow`** |
| Webhook | `POST /api/webhooks/payments/confirm` | same escrow path |
| Crypto | `POST /api/v2/payments/verify-tron` | `PaymentsV3Service` |
| Legal gate | body `acceptedLegalTerms` | `lib/legal-consent.js` |
| Terms stamp | on escrow | `stampBookingTermsOnSuccessfulPayment` |

**Допустимые статусы перед confirm:** `PENDING`, `AWAITING_PAYMENT`, `CONFIRMED`, `PAID` → **`PAID_ESCROW`**.

**Fiscal:** без `FISCAL_PROVIDER_URL` — `fiscal receipt pending` (не блокирует escrow в smoke).

---

### 4.6 Эскроу, проживание, отзывы

| Этап | Механизм | Статус |
|------|----------|--------|
| Деньги на эскроу | RPC + ledger | `PAID_ESCROW` |
| Разморозка по правилам категории | **`POST /api/cron/escrow-thaw`** (hourly external) | `THAWED` |
| UI «24 ч hold» | `booking-status-display` → `THAW_HOLD` | виртуальный |
| Готово к пулу | **`POST /api/cron/promote-ready-for-payout`** | `READY_FOR_PAYOUT` |
| Check-in (опционально) | `POST .../check-in/confirm` | `CHECKED_IN` |
| Отзыв гостя | `POST /api/v2/reviews` | после lifecycle (`order-timeline.js`) |
| Отзыв хоста о госте | `POST /api/v2/partner/guest-reviews` | `THAWED` / `COMPLETED` |
| Агрегат рейтинга | trigger `refresh_listing_review_stats` | `listings.avg_rating` |
| Reputation / ранжирование | `lib/services/reputation/*` | search ranking |

**Важно:** `CHECKED_IN` **не заменяет** cron thaw; это параллельный продуктовый сигнал «заехал».

---

### 4.7 Выплаты (Concierge / ADR-097)

| Шаг | Кто | Код |
|-----|-----|-----|
| Партнёр видит баланс | UI `/partner/finances` | `GET /api/v2/partner/balance-breakdown` |
| Заявка на вывод (опционально) | Partner | `POST /api/v2/partner/payouts` |
| Пул (ручной) | Admin FinTech | `PayoutBatchService.createDraftPoolForToday` |
| Lock | Admin | `lockBatch` |
| CSV / ZIP | Admin | `exportBatchRegistry`, `bank-package` |
| Закрытие после банка | Admin | `markBatchSettled` → ledger + `COMPLETED` + PDF |
| Compliance | Admin | `compliance-registry-csv.js` |

**Legacy (не prod path):** `lib/services/escrow/payout.service.js` — `processPayout`, `processAllPayoutsForToday` (прямо в `COMPLETED` + row в `payouts`).

**Cron Concierge:** auto `payout-batch-pools` **выключен** на launch; см. runbook.

---

### 4.8 Споры, отмены, возвраты

| Действие | API / сервис |
|----------|----------------|
| Отмена | `POST /api/v2/bookings/[id]/cancel` |
| Preview refund | `cancel-preview` |
| Refund calc | `booking-refund-calculator.service.js` |
| Dispute freeze payout | `lib/services/dispute/dispute-payout-freeze.js` + `partner-payout-eligibility.js` |

---

## 5. Машина статусов брони (консолидировано)

### 5.1 Операционный граф (партнёр API) — **канон для хоста**

Источник: **`lib/booking/status-transitions.js`** (`PARTNER_BOOKING_STATUS_TRANSITIONS`). Импорт: partner route, `BookingService.updateStatus`, occupancy.

```
PENDING / INQUIRY → CONFIRMED | CANCELLED
CONFIRMED / AWAITING_PAYMENT → CANCELLED
PAID → COMPLETED | REFUNDED
PAID_ESCROW → REFUNDED | CANCELLED
CHECKED_IN / THAWED → COMPLETED | REFUNDED
```

`READY_FOR_PAYOUT` выставляется **cron**, не партнёрским PUT.

**CHECKED_IN ≠ THAWED:** check-in — сигнал «заехал»; thaw — разморозка эскроу cron.

### 5.2 Финансовый подграф (ADR-097)

```
CONFIRMED → (pay) → PAID_ESCROW → (cron thaw) → THAWED
  → (24h + cron) → READY_FOR_PAYOUT → (batch settled) → COMPLETED
```

### 5.3 UI-only / клиент

| Статус | Где |
|--------|-----|
| `THAW_HOLD` | `booking-status-display.js` |
| `DISPUTED` | display + dispute metadata |
| `DECLINED` / `REJECTED` | i18n / chat (не всегда enum DB) |

### 5.4 Расхождения (техдолг)

| Место | Проблема |
|-------|----------|
| `lib/config/app-constants.js` `BOOKING_STATUS` | Нет `THAWED`, `READY_FOR_PAYOUT`, `CHECKED_IN`, `AWAITING_PAYMENT` |
| `lib/services/escrow/constants.js` | Подмножество для escrow-only (не граф переходов) |

**Закрыто (108.1):** `lib/booking/status-transitions.js` — partner, `BookingService.updateStatus`, occupancy re-export, display hint.

---

## 6. Реестр дублирования и мёртвого кода

| ID | Тип | Описание | Файлы | Действие |
|----|-----|----------|-------|----------|
| D-01 | Legacy payout | Второй контур выплат в обход пула | `escrow/payout.service.js` | **Done 108.1** — `legacy-payout-guard.js`, TG FINANCE alert |
| D-02 | Status FSM | 4+ определения переходов | partner route, `booking.service.js` | **Done 108.1** — `status-transitions.js` |
| D-03 | Pricing name | Два `pricing.service.js` | `lib/services/pricing.service.js` vs `booking/pricing.service.js` | **Done 108.5** — `PricingCatalogService` / `BookingSettlementPricing` + `PRICING_SERVICES.md` |
| D-04 | Search URL | Два endpoint | `/api/v2/search`, `/api/v2/listings/search` | OK (thin wrapper) |
| D-05 | Chat Realtime | Два inbox loader | `ChatContext.jsx`, `useConversationInbox` | **Done 108.5** — на `/messages*` Realtime списка только inbox; badge через `chat-unread-bridge` |
| D-06 | Chat send | Дубли `fetch` к messages | `lib/chat/post-chat-message.js` | **Частично 108.2** — SSOT POST; текст/voice/media через хук |
| D-07 | Dead UI | confirm/reject API не существует | ~~`booking-actions.jsx`~~ | **Done 108.2** — удалён; партнёр: `PUT partner/bookings` + чат |
| D-08 | Dead UI | Нет импортов | ~~chat-booking-announcement, chat-typing-bar~~ | **Done 108.2** — удалены |
| D-09 | CHECKED_IN vs THAWED | Два смысла «после оплаты» | check-in route vs escrow-thaw | **Done 108.4** — SSOT table + UI hints (P1-6) |
| D-10 | Schema drift | Колонки 053 не на всех БД | `migrations/stage103_2_*` | **Done 108.4** — `npm run verify:schema-103-2`; apply SQL if fail |

---

## 7. Сравнение с паттерном Airbnb

| Паттерн | GoStayLo | Примечание |
|---------|----------|------------|
| Instant Book | ✓ `instant_booking` | |
| Request to book | ✓ `INQUIRY` / `PENDING` | |
| Messaging | ✓ `/messages` + invoices | Богаче: KYC/passport в чате |
| Platform payment | ✓ `PAID_ESCROW` + ledger | |
| Host payout | Ручной банк + пул | **Concierge**, не Stripe Connect auto |
| Reviews | ✓ guest → listing; host → guest | Разные таблицы |
| Resolution / disputes | ✓ freeze payout | |

---

## 8. Очередь PR (P0 / P1)

Использовать как backlog. Каждый PR — узкий diff, обновление этого файла / манифеста при смене контракта.

### P0 — деньги, cron, схема, статусы (делать первыми)

| PR | Название | Scope | Ключевые файлы | Acceptance criteria |
|----|----------|-------|----------------|---------------------|
| **P0-1** | Guard legacy auto-payout | ✅ **108.1** | `legacy-payout-guard.js`, `payout.service.js` | Blocked prod + manual mode; `ALLOW_LEGACY_PAYOUT=1` override; TG alert |
| **P0-2** | Booking status SSOT module | ✅ **108.1** | `lib/booking/status-transitions.js` | Partner + staff + occupancy; CHECKED_IN ≠ THAWED documented |
| **P0-3** | Schema 103.2 all environments | ✅ **108.4** (tooling) | `scripts/verify-stage103-2-schema.mjs`, `npm run verify:schema-103-2` | 6/6 columns on each env; apply migration if missing |
| **P0-4** | External financial cron verification | ✅ **108.3** | `lib/admin/financial-cron-health.js`, `FinTechCronHealthPanel`, `GET treasury-ops` | Панель на `/admin/settings/finances`; stale > 3h → жёлтый/красный + TG FINANCE |

**Suggested branch names:** `fix/p0-legacy-payout-guard`, `refactor/p0-booking-status-ssot`, `chore/p0-schema-103-2`, `feat/p0-cron-health-surface`

---

### P1 — UX, чат, чистка, согласованность

| PR | Название | Scope | Ключевые файлы | Acceptance criteria |
|----|----------|-------|----------------|---------------------|
| **P1-1** | Extend `BookingService.updateStatus` or deprecate | ✅ **108.4** | `validatePartnerBookingStatusTransition`, `@deprecated` on `updateStatus` | PATCH fields + graph from `status-transitions.js` |
| **P1-2** | Unify chat send pipeline | ✅ **110.6** | `useUnifiedMessagesOutbound.js`, `use-chat-thread-messages.js`, `post-chat-invoice.js` | Текст/voice/media/passport/invoice → thread SSOT + `appendServerChatMessage` |
| **P1-3** | Dedup chat inbox Realtime | ✅ **110.5** | `thread-inbox-bridge.js`, `use-conversation-inbox.js`, `use-chat-thread-messages.js` | `deferThreadRealtime` реально отключает thread channel; bridge + resync |
| **P1-4** | Remove dead `booking-actions` | ✅ **108.2** | — | Удалён |
| **P1-5** | Remove unused chat components | ✅ **108.2** | — | Удалены |
| **P1-6** | CHECKED_IN vs THAWED product doc | ✅ **108.4** | `status-transitions.js` table, `BOOKING_STATUS_OWNER_HINTS_RU`, partner finances tooltip | «Гость заехал» ≠ «Разморожено» в UI |
| **P1-7** | Client `BOOKING_STATUS` parity | ✅ **108.4** | `BOOKING_STATUS_CODES`, `BOOKING_ESCROW_PIPELINE_STATUSES`, `escrow/constants.js` | All pipeline statuses in client SSOT |
| **P1-8** | Pricing service rename clarity | ✅ **108.5** | `PricingCatalogService`, `BookingSettlementPricing` | Алиасы в коде + карта в `PRICING_SERVICES.md` |

**Suggested branch names:** `refactor/p1-chat-send-ssot`, `refactor/p1-chat-inbox-dedup`, `chore/p1-dead-components`, `docs/p1-checkedin-thaw`, `fix/p1-booking-status-constants`

---

### Порядок слияния (рекомендация)

```
P0-3 (schema) → P0-4 (cron visibility) → P0-1 (legacy guard) → P0-2 (status SSOT)
  → P1-4, P1-5 (quick deletes)
  → P1-2, P1-3 (chat)
  → P1-1, P1-7, P1-6 (status/doc)
  → P1-8 (optional rename)
```

---

## 9. Smoke и регрессия

| Проверка | Команда / док |
|----------|----------------|
| Financial E2E | `npm run smoke:full-financial` |
| Pre-launch | `docs/PRE_LAUNCH_CHECKLIST.md` §12 |
| Cron manual | `docs/CRON_EXTERNAL_FINANCIAL.md` |
| Treasury day-1 | `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md` §13 |

---

## 10. История изменений

| Version | Date | Change |
|---------|------|--------|
| 1.6.0 | 2026-05-20 | **Stage 109.0:** Admin FinTech console split (`useAdminFinTechConsole`, panel modules, owner mode preserved) |
| 1.5.0 | 2026-05-20 | **Stage 108 закрыт:** P1-8 pricing aliases, D-05 chat badge bridge, FX cache v3, owner FinTech |
| 1.4.0 | 2026-05-20 | Schema verify, status SSOT, CHECKED_IN hints |
| 1.0.0 | 2026-05-19 | Initial map + P0/P1 PR backlog (post Stage 103 smoke) |
