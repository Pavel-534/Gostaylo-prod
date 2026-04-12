# Gostaylo — Architectural Passport

> **Version**: 2.1.13 | **Last Updated**: 2026-04-12 | **Status**: Production-Ready
> 
> Архитектура, маршруты, схемы и стандарты. **Порядок для агентов:** сначала **`ARCHITECTURAL_DECISIONS.md`** (SSOT), затем **`docs/TECHNICAL_MANIFESTO.md`** (code-truth), затем этот паспорт. Синхронизация с кодом — **`AGENTS.md`** и **`.cursor/rules/gostaylo-docs-constitution.mdc`**.

---

## 0. Critical Routes & Services

### 0.0 Admin Health Dashboard (ops + security)
- **UI:** `app/admin/health/page.jsx` — маршрут **`/admin/health`**, карточки **`rounded-2xl`**: агрегаты **`ops_job_runs`** (7 дн.) для **`ical-sync`**, **`push-sweeper`**, **`push-token-hygiene`**, блок **`critical_signal_events`** (`PRICE_TAMPERING`).
- **API:** **`GET /api/v2/admin/health`** — только **`profiles.role === 'ADMIN'`** или email из **`ADMIN_HEALTH_EMAILS`** (см. **`lib/admin-health-access.js`**); данные через **`supabaseAdmin`**.
- **Chat reliability (mobile/web):** глобальный presence трекинг через **`PresenceProvider`** (`app/layout.js`, канал `gostaylo-site-presence:v1`) и устойчивый badge unread из **`ChatContext`** (`GET /api/v2/chat/conversations?archived=all&enrich=1&limit=100`; события `messages` по Realtime проходят RLS, без ложного отбрасывания до синхронизации локального списка — см. v2.1.9 в манифесте).
- **Messenger-grade v2.1.9:** как v2.1.8, плюс **единый ref-counted канал `typing:global:v1`** (`lib/chat/typing-global-channel.js`) для инбокса и треда; dev-подсказки при обрыве Realtime — **`lib/chat/realtime-dev-warn.js`** + опция **`channelLabel`** в **`subscribeRealtimeWithBackoff`**.

### 0.1 CRITICAL: Telegram Webhook
```
Route: /api/webhooks/telegram
Status: PUBLIC (no auth required)
Runtime: nodejs
Pattern: Immediate Response + Fire-and-Forget
```

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
- **Realtime recovery:** при reconnect/focus/visibilitychange Realtime JWT переустанавливается без refresh страницы; backoff-слой избегает синхронного `removeChannel` в callback, чтобы исключить рекурсивные сбои.

### 0.6 Contact Leakage Protection (commission safety)

- Канал общения renter↔partner должен оставаться платформенным; прямой обмен контактами в чате рассматривается как риск обхода комиссии.
- Политика и целевая архитектура: **`docs/ANTI_DISINTERMEDIATION_POLICY.md`** (server-first фильтр в `POST /api/v2/chat/messages`, риск-скоринг, telemetry, moderation escalation).
- Текущий production baseline: флаг **`messages.has_safety_trigger`** + событие **`CONTACT_LEAK_ATTEMPT`** в `critical_signal_events`; у получателя в UI показывается дружелюбный safety-блок с объяснением эскроу.
- Тексты safety-блока и страницы справки — **`getUIText`** (`chatSafety_*`, `escrowProtection_*` в **`lib/translations/ui.js`**); публичный маршрут **`/help/escrow-protection`** (`app/help/escrow-protection/page.js`).

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
│   │   ├── payment.service.js    # Payment processing (MOCKED)
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
| `images` | JSONB | YES | Array of image URLs |
| `cover_image` | TEXT | YES | Primary image URL |
| `metadata` | JSONB | YES | **Extensible data store** |
| `sync_settings` | JSONB | YES | iCal sync configuration |
| `status` | TEXT | NO | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED` |
| `available` | BOOLEAN | YES | Availability flag |
| `is_featured` | BOOLEAN | YES | Featured listing flag |
| `commission_rate` | NUMERIC | YES | Custom commission % |
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
| `check_in` | DATE | NO | Check-in date |
| `check_out` | DATE | NO | Check-out date |
| `price_thb` | NUMERIC | NO | **Calculated total price** |
| `currency` | TEXT | YES | Display currency |
| `price_paid` | NUMERIC | YES | Actual amount paid |
| `exchange_rate` | NUMERIC | YES | Rate at payment time |
| `commission_thb` | NUMERIC | YES | Platform commission |
| `commission_paid` | BOOLEAN | YES | Commission settled flag |
| `guest_name` | TEXT | YES | Guest full name |
| `guest_email` | TEXT | YES | Guest email |
| `guest_phone` | TEXT | YES | Guest phone |
| `special_requests` | TEXT | YES | Guest notes |
| `promo_code_used` | TEXT | YES | Applied promo code |
| `discount_amount` | NUMERIC | YES | Discount in THB |
| `conversation_id` | TEXT | YES | FK to `conversations.id` |

**Booking Status Enum:**
```
PENDING → AWAITING_PAYMENT → CONFIRMED → CHECKED_IN → COMPLETED
                          ↘ CANCELLED
```

> **NOTE**: The `bookings` table does NOT have a `metadata` column. Do NOT attempt to insert metadata into bookings.

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
| `verification_status` | TEXT | YES | KYC status |
| `referral_code` | TEXT | YES | Unique referral code |
| `referred_by` | TEXT | YES | Referrer's code |

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
Одна строка на пару (**получатель**, **отправитель**) до срабатывания окна **45 с**. Если serverless-процесс не завершил лидер-доставку, hourly cron **`/api/cron/push-sweeper`** поднимает stale строки (10+ минут), форсирует доставку и очищает таблицу.

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

Canonical rates come from **`resolveDefaultCommissionPercent()`** / listing / partner overrides — not a hardcoded **15%** in code.

```
subtotalThb   = PricingService total for the stay (THB, before guest fee)
guestFeeThb   = round(subtotalThb * (commissionRate / 100))   // «сервисный сбор» на витрине
userTotalThb  = subtotalThb + guestFeeThb                     // what the guest pays (listing widget / checkout)
commissionThb = round(subtotalThb * (commissionRate / 100))   // platform cut from host side; stored as bookings.commission_thb
partnerPayoutThb = subtotalThb - commissionThb                // bookings.partner_earnings_thb
```

**Identity:** `userTotalThb − partnerPayoutThb = guestFeeThb + commissionThb` (when both percentages apply to the same subtotal, `guestFeeThb` and `commissionThb` match before rounding).

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

Since `bookings` table lacks a `metadata` column, use `special_requests` or create a new `booking_addons` table:

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
| POST | `/api/v2/bookings/[id]/payment/confirm` | Confirm payment |
| POST | `/api/v2/bookings/[id]/check-in/confirm` | Confirm check-in |

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
| `bookings.metadata` doesn't exist | Don't insert metadata | FIXED |
| Escaped quotes break Vercel build | Use single quotes in className | PERMANENT |
| Edge runtime timeouts | Use Node.js runtime for long ops | PERMANENT |

---

## 11. Mocked Services

| Service | Status | Production Replacement |
|---------|--------|------------------------|
| Payment Gateway (Stripe) | MOCKED | Stripe API integration |
| TRON Verification | MOCKED | Trongrid API |
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
