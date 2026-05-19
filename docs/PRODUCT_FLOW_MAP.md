# Product Flow Map — GoStayLo

**Version:** 1.0.0  
**Last updated:** 2026-05-19  
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
| Переходы статусов (хост) | `STATUS_TRANSITIONS` в `app/api/v2/partner/bookings/[id]/route.js` | `BookingService.updateStatus` (урезан) |
| UI-лейблы статусов | `lib/booking/booking-status-display.js` | Только `lib/config/app-constants.js` |
| Оплата → эскроу | `EscrowService.moveToEscrow` + RPC `move_to_escrow_and_post_ledger_v1` | Прямой `status = PAID_ESCROW` |
| Разморозка | Cron `POST /api/cron/escrow-thaw` | Ручной `CHECKED_IN` как замена thaw |
| Доступно к выплате | Cron `promote-ready-for-payout` + `lib/partner/partner-payout-eligibility.js` | — |
| Выплата prod (Concierge) | `PayoutBatchService` + ручной банк | `EscrowService.processPayout` |
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
| Цена на карточке | `ListingCard`, `catalog-guest-display-price.js` | guest display = base + guest service fee |
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

**Известное наложение:** глобальный `ChatProvider` + `useConversationInbox` на странице треда; часть send-path в `UnifiedMessagesClient` минует `useChatThreadMessages`.

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

Источник: `app/api/v2/partner/bookings/[id]/route.js`

```
PENDING / INQUIRY → CONFIRMED | CANCELLED
CONFIRMED / AWAITING_PAYMENT → CANCELLED
PAID → COMPLETED | REFUNDED
PAID_ESCROW → REFUNDED | CANCELLED
CHECKED_IN / THAWED → COMPLETED | REFUNDED
```

`READY_FOR_PAYOUT` выставляется **cron**, не партнёрским PUT.

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
| `BookingService.updateStatus` | Нет `PAID_ESCROW`, `THAWED`, `READY_FOR_PAYOUT`, `CHECKED_IN` |
| `lib/config/app-constants.js` `BOOKING_STATUS` | Нет `THAWED`, `READY_FOR_PAYOUT`, `CHECKED_IN`, `AWAITING_PAYMENT` |
| `lib/services/escrow/constants.js` | Подмножество для escrow-only |
| `lib/booking-occupancy-statuses.js` | Блокирует ночи до `THAWED` (+ `CHECKED_IN`), не `READY_FOR_PAYOUT` |

**Целевой SSOT (PR P1-1):** `lib/booking/status-transitions.js` — один экспорт для partner, occupancy, display, docs.

---

## 6. Реестр дублирования и мёртвого кода

| ID | Тип | Описание | Файлы | Действие |
|----|-----|----------|-------|----------|
| D-01 | Legacy payout | Второй контур выплат в обход пула | `escrow/payout.service.js` | Guard + deprecate (P0-1) |
| D-02 | Status FSM | 4+ определения переходов | partner route, `booking.service.js`, constants | SSOT module (P0-2 / P1-1) |
| D-03 | Pricing name | Два `pricing.service.js` | `lib/services/pricing.service.js` vs `booking/pricing.service.js` | Док + alias в импортах (P1-8 doc-only) |
| D-04 | Search URL | Два endpoint | `/api/v2/search`, `/api/v2/listings/search` | OK (thin wrapper) |
| D-05 | Chat Realtime | Два inbox loader | `ChatContext.jsx`, `useConversationInbox` | Dedup (P1-3) |
| D-06 | Chat send | Два send path | `useChatThreadMessages`, `UnifiedMessagesClient` fetch | Unify (P1-2) |
| D-07 | Dead UI | confirm/reject API не существует | `components/booking-actions.jsx` | Delete or fix (P1-4) |
| D-08 | Dead UI | Нет импортов | `chat-booking-announcement.jsx`, `chat-typing-bar.jsx` | Remove (P1-5) |
| D-09 | CHECKED_IN vs THAWED | Два смысла «после оплаты» | check-in route vs escrow-thaw | Doc + product rule (P1-6) |
| D-10 | Schema drift | Колонки 053 не на всех БД | `migrations/stage103_2_*` | Apply all envs (P0-3) |

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
| **P0-1** | Guard legacy auto-payout | Запретить `processPayout` / `processAllPayoutsForToday` на prod без явного `ALLOW_LEGACY_PAYOUT=1` | `lib/services/escrow/payout.service.js`, `escrow.service.js`, runbook | Ни один cron/admin путь не вызывает legacy на prod; unit/log при попытке |
| **P0-2** | Booking status SSOT module | Вынести `STATUS_TRANSITIONS` + occupancy + display hints в `lib/booking/status-transitions.js`; partner route импортирует | `lib/booking/status-transitions.js`, `partner/bookings/[id]/route.js`, `booking-occupancy-statuses.js` | Один файл — источник allowed transitions; partner behavior unchanged |
| **P0-3** | Schema 103.2 all environments | Док + скрипт проверки колонок; merge `stage103_2` в runbook deploy | `migrations/stage103_2_*`, `migrations/stage103_2_*_SPLIT.md`, `PRE_LAUNCH_CHECKLIST` | SQL check returns 3 rows; `npm run smoke:full-financial` PASS on staging/prod |
| **P0-4** | External financial cron verification | Health: last run timestamps в `ops_job_runs` или admin widget; alert if stale > 2h | `app/api/cron/*`, `docs/CRON_EXTERNAL_FINANCIAL.md`, optional admin route | Документированный способ увидеть «thaw не бегал 3 часа» |

**Suggested branch names:** `fix/p0-legacy-payout-guard`, `refactor/p0-booking-status-ssot`, `chore/p0-schema-103-2`, `feat/p0-cron-health-surface`

---

### P1 — UX, чат, чистка, согласованность

| PR | Название | Scope | Ключевые файлы | Acceptance criteria |
|----|----------|-------|----------------|---------------------|
| **P1-1** | Extend `BookingService.updateStatus` or deprecate | Либо делегировать в SSOT module, либо `@deprecated` + redirect staff to partner/admin tools | `booking.service.js`, `app/api/v2/bookings/[id]/route.js` | Staff transitions ⊆ partner graph for overlapping statuses |
| **P1-2** | Unify chat send pipeline | Voice/invoice/passport через `useChatThreadMessages` | `UnifiedMessagesClient.jsx`, `use-chat-thread-messages.js` | Один optimistic/retry path; no duplicate fetch blocks |
| **P1-3** | Dedup chat inbox Realtime | Thread page: только `useConversationInbox` **или** только `ChatProvider` list | `ChatContext.jsx`, `messages/[id]/page.js` | Одна postgres_changes подписка на inbox на thread |
| **P1-4** | Remove dead `booking-actions` | Удалить или заменить на `PUT partner/bookings` | `components/booking-actions.jsx` | Нет импортов в репо; CI green |
| **P1-5** | Remove unused chat components | Delete `chat-booking-announcement`, `chat-typing-bar` | `components/chat-*` | Build passes; milestone card remains |
| **P1-6** | CHECKED_IN vs THAWED product doc | ADR snippet + UI copy: check-in ≠ payout release | `docs/ADR/097-*` or this doc §4.6, check-in route comment | Support/runbook answers one paragraph |
| **P1-7** | Client `BOOKING_STATUS` parity | Добавить `THAWED`, `READY_FOR_PAYOUT`, `CHECKED_IN`, `AWAITING_PAYMENT` или codegen from server | `lib/config/app-constants.js`, filters in renter/partner UI | No undefined status in booking lists after thaw |
| **P1-8** | Pricing service rename clarity | Re-export aliases `PricingCatalogService` / `BookingSettlementPricing` (no behavior change) | `pricing.service.js` files, imports optional | New code cannot confuse two modules by name |

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
| 1.0.0 | 2026-05-19 | Initial map + P0/P1 PR backlog (post Stage 103 smoke) |
