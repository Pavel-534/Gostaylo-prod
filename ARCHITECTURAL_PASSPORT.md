# FunnyRent 2.1 — Architectural Passport

> **Version**: 2.1.1 | **Last Updated**: 2026-03-02 | **Status**: Production-Ready
> 
> This document is the **absolute source of truth** for all technical decisions, database schemas, and development standards. Any AI agent working on this codebase MUST read this document first.

---

## 0. Critical Routes & Services

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
🔒 Ваши средства защищены системой Эскроу FunnyRent и выплачиваются 
владельцу только после подтверждения заселения.
```
**This message MUST appear in:**
- Payment confirmation emails
- Booking confirmation pages
- Payment success notifications

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

### 3.4 Commission Formula

```
serviceFee = priceThb * (SERVICE_FEE_RATE)  // 15% = 0.15
totalWithFee = priceThb + serviceFee
grandTotal = totalWithFee  // This is shown in booking modal AND checkout
partnerEarnings = priceThb - (priceThb * commissionRate)
```

Default service fee: **15%**

### 3.5 Price Unification (CRITICAL)

**The booking modal and checkout page MUST show identical totals:**

```javascript
// In listing detail page - booking modal
const serviceFee = Math.round(rentalTotal * 0.15);
const grandTotal = rentalTotal + serviceFee;  // ← This MUST match checkout

// In checkout page
const serviceFee = priceThb * 0.15;
const total = priceThb + serviceFee;  // ← Same value
```

**Display format:**
```
Rental cost (X nights):     ฿Y
Service fee (15%):          ฿Z
─────────────────────────────
Total to Pay:               ฿(Y+Z)
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
- FunnyRent footer
- Escrow security message (for payments)

### 4.5 Environment Variables

```bash
TELEGRAM_BOT_TOKEN=8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM
TELEGRAM_ADMIN_GROUP_ID=-1003832026983
RESEND_API_KEY=re_xxx  # Optional - falls back to mock
SENDER_EMAIL=FunnyRent <noreply@funnyrent.com>
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
