# Constitution — активные правила платформы

> **Назначение:** инварианты «как работает сейчас» — FSM, цена, FX, роли, SSOT-файлы.  
> **Не** хронология Stage и **не** полный перечень API.  
> Хаб: [`README.md`](./README.md) · карта: [`SYSTEM_MAP.md`](./SYSTEM_MAP.md) · code-truth: [`TECHNICAL_MANIFESTO.md`](./TECHNICAL_MANIFESTO.md) · история: [`HISTORY.md`](./HISTORY.md) · планы: [`ROADMAP.md`](./ROADMAP.md).  
> Политика — `ARCHITECTURAL_DECISIONS.md`. Архив монолита — [`archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md`](./archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md).

**Бренд (white-label):** display name — `getSiteDisplayName()` (`NEXT_PUBLIC_SITE_NAME` / `SITE_DISPLAY_NAME`; prod **Airento**). В i18n — плейсхолдер `{brand}`, не литерал.

---

## 1. Статусы брони и переходы (FSM)

### 1.1 Коды статусов

SSOT enum: `lib/config/app-constants.js` → `BOOKING_STATUS`.

Ключевые статусы жизненного цикла:

| Статус | Смысл |
|--------|--------|
| `INQUIRY` | Мягкий запрос / чат; **не** занимает календарь |
| `PENDING` | Заявка ожидает решения партнёра |
| `CONFIRMED` | Партнёр подтвердил; ожидание оплаты / счёта |
| `AWAITING_PAYMENT` | Окно checkout; **занимает** ночи в календаре |
| `PAID` | Legacy paid (редкий путь) |
| `PAID_ESCROW` | Оплата захвачена; средства в эскроу |
| `CHECKED_IN` | Операционный факт «гость заехал»; **деньги остаются в эскроу** |
| `THAWED` | Cron разморозил эскроу; **не** то же самое, что check-in |
| `READY_FOR_PAYOUT` | Готово к пулу выплат (после hold) |
| `COMPLETED` | Завершено |
| `CANCELLED` / `REFUNDED` | Отмена / возврат |

**UI-only:** `DECLINED` может встречаться в клиентском enum / копирайте, но в БД и FSM пишется **`CANCELLED`**. Partner API мапит `DECLINED → CANCELLED` до валидации перехода.

### 1.2 Не смешивать в UI и support

| Статус | Кто меняет | Смысл для владельца |
|--------|------------|---------------------|
| **CHECKED_IN** | Гость (`POST …/check-in/confirm`) или staff/partner → COMPLETED | «Гость заехал» — деньги **ещё в эскроу** |
| **THAWED** | Cron `escrow-thaw` | «Деньги разморожены» по правилам категории |
| **READY_FOR_PAYOUT** | Cron `promote-ready-for-payout` | Готово включить в пул выплат (после 24h hold) |

Prod-выплата: `PayoutBatchService` + ручной Concierge-банк, не legacy `processPayout`.  
Settle fail-closed: batch → `SETTLED` только после успешных ledger-проводок по всем non-SKIPPED items; при ошибках ledger — повтор settle (в т.ч. repair если уже ошибочно `SETTLED`).
Single-flight: `try_claim_payout_batch_settle_lock` / `refresh` / `release` на `payout_batches.metadata` (TTL 1800s + heartbeat); concurrent → `409 settle_in_progress`.

### 1.3 Переходы партнёра

SSOT: `lib/booking/status-transitions.js` → `PARTNER_BOOKING_STATUS_TRANSITIONS`.

| From | To (partner/staff PUT) |
|------|-------------------------|
| `PENDING` | `CONFIRMED`, `CANCELLED` |
| `INQUIRY` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `CANCELLED` |
| `AWAITING_PAYMENT` | `CANCELLED` |
| `PAID` | `COMPLETED`, `REFUNDED` |
| `PAID_ESCROW` | `REFUNDED`, `CANCELLED` |
| `CHECKED_IN` | `COMPLETED`, `REFUNDED` |
| `THAWED` | `COMPLETED`, `REFUNDED` |
| `READY_FOR_PAYOUT` / `COMPLETED` / `CANCELLED` / `REFUNDED` | _(нет partner PUT)_ |

### 1.4 Системные переходы

SSOT: `SYSTEM_BOOKING_STATUS_TRANSITIONS` в том же файле.

Типичный happy-path:

```
INQUIRY|PENDING → CONFIRMED → AWAITING_PAYMENT → PAID_ESCROW
  → (CHECKED_IN опционально) → THAWED → READY_FOR_PAYOUT → COMPLETED
```

Системный переход **`CHECKED_IN → THAWED`** разрешён (cron `escrow-thaw` выбирает `PAID_ESCROW` ∪ `CHECKED_IN` по `escrow_thaw_at`). Партнёрский PUT в `THAWED` из `CHECKED_IN` — нет.

Оплата в `PAID_ESCROW` допускается **только** через `EscrowService.moveToEscrow` (RPC capture). Прямой FSM UPDATE в `PAID_ESCROW` запрещён (`validatePaidEscrowFsmGuard`).

### 1.5 Наборы статусов (фильтры)

SSOT: `lib/booking/status-sets.js`. Фасад календаря: `lib/booking-occupancy-statuses.js`.

| Набор | Назначение | Правило |
|--------|------------|---------|
| `OCCUPYING_BOOKING_STATUSES` | Календарь / availability RPC | `INQUIRY` **вне** списка; `AWAITING_PAYMENT` **внутри**. Whole-unit inventory (`property` / whole-yacht): любая occupying-бронь блокирует даты |
| In-flight PENDING listing | Checkout / create | Новые брони блокируются, если листинг снова на модерации (`PENDING`); уже созданные `CONFIRMED` / `AWAITING_PAYMENT` **могут** доплатить на checkout |
| `ICAL_EXPORT_BOOKING_STATUSES` | Публичный iCal BUSY | Без INQUIRY; без CHECKED_IN/THAWED как отдельных BUSY |
| `ESCROW_PIPELINE_STATUSES` | Эскроу / выплаты | `PAID_ESCROW` → `READY_FOR_PAYOUT` |
| `NO_PAY_TRAVEL_STATUSES` | Чат: скрыть Pay now | Set |
| `REFERRAL_GUEST_MARGIN_BOOKING_STATUSES` | Marketing ROI (`commission_thb`) | Контур PAID → COMPLETED |

PATCH-хелперы: `validatePartnerBookingStatusTransition`, `buildPartnerBookingStatusPatch`.

---

## 2. Формула цены (guest fee, commission, rounding)

### 2.1 Источник ставок

Канон из `system_settings.general`:

| Ключ | Default | Назначение |
|------|---------|------------|
| `guestServiceFeePercent` | **15** | Сервисный сбор гостя |
| `hostCommissionPercent` | **0** | Комиссия с хоста (партнёрский override: `profiles.custom_commission_rate`) |
| `insuranceFundPercent` | **0.5** | Доля страхового резерва от platform margin |
| `chatInvoiceRateMultiplier` | (settings) | Retail FX spread для витрины/invoice |
| `defaultCommissionRate` | legacy | Не перекрывает явный `hostCommissionPercent: 0` |

Резолв: `PricingService.getFeePolicy()` → `resolveHostCommissionPercentFromGeneral`.  
Defaults object: `lib/config/platform-split-fee-defaults.js`.

### 2.2 Stay / subtotal

Дневная цена: `PricingService` (`lib/services/pricing.service.js`) — seasonal из DB `seasonal_prices` → `metadata.seasonal_pricing` (`priceDaily` / `priceMultiplier`).

```
subtotalThb = сумма ночей (после промо, до guest fee)
```

### 2.3 Guest payable (канон)

**Режим округления** — SSOT `lib/booking-guest-rounding.js` + `getServerGuestRoundingMode()`:

| Режим | Когда | Формула pot / charge |
|-------|--------|----------------------|
| **integer** | `PRICING_ENGINE_V2` on | `Math.round(guestTotalRaw)` до **1 THB**; `rounding_diff_pot` = rounded − raw (может быть дробным до round) |
| **pot10** | v2 off / legacy snapshots | `ceil(raw/10)*10 − raw` — pot до ближайших **10 THB** |

Attestation / charge readers: `lib/booking-price-integrity.js` (v2 snapshot `final_breakdown` → integer; иначе columns + pot).

```
guestFeeThb        = round(subtotalThb * (guestServiceFeePercent / 100))   // bookings.commission_thb
guestTotalRawThb   = subtotalThb + guestFeeThb [+ taxThb]
roundingDiffPotThb = f(mode)                                               // bookings.rounding_diff_pot
userTotalThb       = guestTotalRawThb + roundingDiffPotThb                 // integer: ≈ Math.round(raw)
```

Checkout charge (THB):

```
resolveCheckoutChargeTotalThb ≈ price_thb + commission_thb + rounding_diff_pot
```

Price truth (витрина / PDP): `lib/pricing/price-truth.js` historically pot10 for catalog batch; **create/checkout under v2** uses integer via PricingEngine. Do not mix modes in one booking.

```
hostCommissionThb  = round(subtotalThb * (hostCommissionPercent / 100))
partnerPayoutThb   = subtotalThb - hostCommissionThb              // partner_earnings_thb
platformMarginThb  = guestFeeThb + hostCommissionThb
insuranceReserveThb = round(platformMarginThb * (insuranceFundPercent / 100))
taxableMarginThb   = userTotalThb - partnerPayoutThb
```

**Identity (согласованный снимок):**

```
userTotalThb − partnerPayoutThb = platformMarginThb + roundingDiffPotThb [+ taxThb если tax в charge]
```

При `rounding_diff_pot = 0` и без tax упрощается до `userTotal − partnerPayout = platformMargin`.  
`taxableMarginThb = userTotalThb − partnerPayoutThb` включает pot (+ tax), не равен голому `platformMarginThb`.

**Chat Special Offer (invoice):** сумма в инвойсе = **guest capture total**. Fee-ноги — `calculateCommissionFromGuestPayable` (subtotal imputed from payable). Sync брони: `rounding_diff_pot = 0`, сброс stale `pricing_snapshot.final_breakdown`; readers предпочитают `chat_invoice_quote.amount_thb`.

**Минимум к оплате гостем:** `MIN_BOOKING_GUEST_TOTAL_THB = 100` (сервер, `BookingService` / `lib/booking-price-integrity.js`) → отказ `BOOKING_MIN_TOTAL_THB`.

### 2.4 Слои валюты листинга (asset)

| Слой | Что | FX |
|------|-----|-----|
| **L1 Asset** | `base_currency` + `metadata.base_price_asset.amount` | Нет |
| **L1 → engine** | `base_price_thb` = THB-канон при save | **Mid** |
| **L2 Storefront** | Guest display | **Retail** |
| **L3 Ledger** | `bookings.*_thb`, `pricing_snapshot` | **Mid only** |

Lock: смена `base_currency` / базовой цены при активных occupying-бронях → `400` `LISTING_ASSET_LOCKED_ACTIVE_BOOKINGS`.

### 2.5 Инварианты

- Виджет PDP и checkout используют **один** источник fee % и один THB-субтотал до fee.
- Без дат на витрине: база/`averagePerNight` + guest fee %. С датами: batch `guestPayableRoundedThb` (уже fee+tax+pot) — **без** повторного fee.
- Поиск min/max и histogram — в **гостевой** единице, не голый `base_price_thb`.
- SEO `Offer.price` — гостевая цена.

---

## 3. FX-политика (retail vs mid)

> Полная матрица (listing base × UI × payment), сценарии Berlin/MIR/инвойс: **`docs/CURRENCY_FX_SSOT.md`**.  
> Helpers: **`lib/pricing/fx-policy.js`** (Stage **200.115**).

### 3.1 Когда какой курс

| Режим | Когда использовать | Как получить |
|-------|-------------------|--------------|
| **Retail** | Витрина, каталог, PDP, checkout display, chat invoice display, wizard storefront preview, SEO display | `applyRetailMarkup: true` / `useFxRatesQuery({ retail: true })` / `GET /api/v2/exchange-rates` default `retail=1` |
| **Mid** | Settlement, ledger, payout preview (партнёр), referral stats / ambassador balance, admin risk, listing asset→THB на save | `getMidMarketDisplayRateMap` / `retail=0` / `useMidMarketDisplayFx` |

**Не менять mid+invoice логику:** `pricing_snapshot`, checkout breakdown math, `getCheckoutRateToThb`.

**Две наценки (не смешивать):**
- **Retail** — `chatInvoiceRateMultiplier` только при THB→не-THB на витрине (UI=THB не маркируется).
- **Checkout FX** — `fx_markup_pct` когда `payment_currency ≠ listing_base_currency` (в т.ч. pay=THB × base≠THB, Stage 200.88).

Payable сегодня: `BOOKING_PAYMENT_CURRENCIES` = THB\|USD\|RUB\|CNY\|USDT (**без EUR**).

### 3.2 Четыре слоя FX (не смешивать)

| # | Слой | Когда | Спред |
|---|------|-------|-------|
| 1 | Гость (оплата) | Создание брони → оплата | `fx_markup_thb` в snapshot (доход платформы у гостя) |
| 2 | Settlement (история брони) | Confirm / attach snapshot | Нет выплатного спреда |
| 3 | ~~UI справочно для выплат~~ | — | **Deprecated** для payout UI |
| 4 | Исходящая выплата | Заявка / пул | RUB: `PARTNER_PAYOUT_FX_RUB_SPREAD_PCT`; USDT: mid |

Партнёрский кабинет: баланс в **THB**; ₽/USDT — из payout preview, не из live витринного retail.

### 3.3 API и кеш

- Query `retail`: `1` storefront (default), `0` mid.
- Клиент: `localStorage` v3 (`exchange_rates_retail` / `exchange_rates_mid`, TTL 2h) + TanStack `useFxRatesQuery`.
- SSOT helpers: `lib/pricing/fx-display.js`, `CurrencyService.getDisplayRateMap`.

---

## 4. Роли доступа

### 4.1 Иерархия

```
ADMIN > MODERATOR > PARTNER > RENTER
```

Поле: `profiles.role` ∈ `ADMIN` | `MODERATOR` | `PARTNER` | `RENTER`.

### 4.2 Маршруты (принцип)

| Область | Роли |
|---------|------|
| `/admin/*` (финансы, settings, payouts) | `ADMIN` |
| `/admin/moderation`, часть staff API | `ADMIN`, `MODERATOR` |
| `/partner/*` | `PARTNER` (+ `ADMIN` где указано) |
| Renter storefront / my-bookings | авторизованный renter (self-scope) |

Server guard: `lib/security/access-guard.js` — JWT + обязательная перепроверка роли/`is_banned` в `profiles`.  
Admin financial routes: `requireAccess({ roles: ['ADMIN'] })` (e.g. `GET /api/v2/admin/ledger-balances`).  
Partner ledger shadow (ADR-203 Phase 1, read-only): `GET /api/v2/admin/partner-ledger-shadow` — `ADMIN`/`MODERATOR` via `requireAdminStaff`.  
Staff moderation/metrics: `requireAdminStaff` где применимо.
Cron: **не** cookie-session — только `CRON_SECRET`.

### 4.3 Сессия

- Cookie приложения: `gostaylo_session` (legacy internal id; TTL **7 дней**, SSOT `lib/auth/app-session-issue.js`).
- Опционально Supabase Auth (OAuth). Identity registry: `profile_auth_identities`.

---

## 5. SSOT-файлы по доменам

| Домен | SSOT |
|-------|------|
| **Статусы / FSM** | `lib/booking/status-transitions.js`, `lib/booking/status-sets.js`, `lib/config/app-constants.js` (`BOOKING_STATUS`) |
| **Цены / fee** | `lib/services/pricing.service.js`, `lib/pricing/price-truth.js`, `lib/pricing/guest-display-price.js`, `lib/config/platform-split-fee-defaults.js`, `calculateCommissionFromGuestPayable` (chat invoice) |
| **Guest breakdown UI** | `lib/booking/guest-price-breakdown.js`, `components/orders/OrderPriceBreakdown` |
| **FX display** | `lib/pricing/fx-display.js`, `lib/hooks/use-fx-rates-query.js`, `lib/client-data.js` |
| **FX policy matrix** | `docs/CURRENCY_FX_SSOT.md`, `lib/pricing/fx-policy.js` |
| **Listing asset currency** | `lib/listing/listing-base-price-canon.js`, `listing-asset-currency.js`, `listing-financial-lock.js`, **L1 notify/ops label** `lib/listing/listing-l1-price-display.js` |
| **Бронирование (оркестратор)** | `lib/services/booking.service.js` + `lib/services/booking/*` |
| **Unified order UI** | `lib/models/unified-order.js`, `components/orders/UnifiedOrderCard.jsx` |
| **Эскроу / thaw** | `lib/services/escrow.service.js`, `lib/escrow-thaw-rules.js` |
| **Partner cash SoT (interim)** | Booking statuses → `getPartnerBalance` (`lib/services/escrow/balance.service.js`); ADR-203 Phase 1 shadow: `getPartnerBalanceFromLedger` — **не** SoT до flip |
| **Ledger** | `lib/services/ledger.service.js`, `lib/services/ledger/*` |
| **Выплаты / Concierge** | `lib/services/payout-batch.service.js` (+ `payout-batch-settlement.js` fail-closed; SKIPPED re-queue), `lib/partner/partner-payout-fx.js`, ADR-097, ADR-300 (Phase 0 overlay) |
| **Платежи** | `lib/services/payments-v3.service.js`, `lib/services/payment-adapters/*` |
| **Чат** | `lib/chat/post-chat-message.server.js`, `post-chat-invoice.server.js`, `sync-booking-for-chat-invoice.server.js`, `conversation-api-client.js` |
| **Referral / MLM** | `lib/services/marketing/referral-payout.service.js`, `referral-ledger.service.js`, `referral-distribute-atomic.service.js`, `system_fintech_settings` |
| **Пуши / FCM** | `lib/services/push.service.js`, `POST /api/v2/push`, `components/push-client-init.jsx`, `src/pwa/sw.template.js` |
| **Уведомления** | `lib/services/notification.service.js`, `lib/services/notifications/notification-registry.js` |
| **Категории / вертикали** | `categories.slug` + `wizard_profile`; `lib/config/category-behavior.js`, `lib/partner/listing-service-type.js` |
| **Репутация партнёра** | `lib/services/reputation.service.js` |
| **Промо** | `lib/promo/promo-engine.js` + `PricingService.validatePromoCode` |
| **Query keys (клиент)** | `lib/query-keys.js` |
| **Design tokens** | `lib/theme/tokens.ts` / `tokens.cjs` → Tailwind / `globals.css` |
| **Mobile chrome / overlays** | **ADR-201** — recipes `action` \| `form` \| `dialog`. Pin: `hooks/use-visual-viewport-frame.js`. Sheet `fit`, Dialog `mobileAnchor`, dock lock: `lib/layout/mobile-dock-lock.js`. Open overlay **owns** the bottom edge (dock hidden). Never `bottom: navHeight` / pad = full tab bar. |
| **List scroll restore (Back)** | `lib/navigation/route-scroll-memory.js` + root `RouteScrollMemoryHost`. Allowlist: `routeScrollKeyFromLocation` / `isScrollMemoryRouteKey`. Persist: `persistLiveRouteScroll` (Link click capture **or** before `router.push`). Back: `useSoftBack` → `markPendingRouteScrollRestore`. Не плодить page-local `useRouteScrollMemory`. |
| **Storefront Search keep-alive** | `StorefrontSearchKeepAlivePane` in `StorefrontAppShell`. Parks **Home + catalog list** across `/` ↔ `/listings` (not PDP). Frozen catalog query: `useFrozenCatalogSearchParams`. Reveal: `revealStorefrontSearchKeepAlive`. Search tab does not open the filter sheet (**201.98**). Home rails: `HOME_WIDGET_QUERY_OPTIONS` 10 min stale, no mount/focus refetch (**201.99**). |
| **Post-auth redirect** | `lib/auth/auth-redirect.js` (`finishAuthNavigation`: `airento:nav-pending` + `replace`; apply login payload, do not block on `/me` or `router.refresh()` on the auth page). |
| **Бренд / site name** | `lib/site-url.js` → `getSiteDisplayName()` |
| **Resend transport guard** | `lib/email/resend-transport-guard.js` |
| **Критичная телеметрия** | `lib/critical-telemetry.js` |
| **FinTech settings** | `lib/services/finance/system-config.service.js`, `system_fintech_settings` |
| **Cron auth** | `lib/cron/verify-cron-secret.js` |

---

## 6. Жёсткие запреты (кратко)

- Не хардкодить комиссии (типа «15%») и курсы вне settings / snapshot / `currency-last-resort.js` по ADR.
- Не плодить вторую формулу цены или вторую матрицу статусов.
- Новая таблица `public`: в одной миграции **GRANT → ENABLE RLS → POLICY**.
- FK на `profiles` / `listings` / `bookings` в SQL — тип **TEXT** (прод), не слепой `uuid`.
- User-facing бренд — только `getSiteDisplayName()` / `{brand}`.
