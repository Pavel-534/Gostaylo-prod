# 📋 FunnyRent 2.1 — Architectural Passport
> **Version:** 2.1 (Stage 16.3)  
> **Last Updated:** February 26, 2025  
> **Status:** Demo-Ready / Beta-Ready / NOT Production-Ready

---

## 1. THE MISSION

**FunnyRent** is a Phuket Rental Super-App aggregating:
- 🏠 **Properties** (villas, apartments, condos)
- 🏍️ **Vehicles** (bikes, cars, scooters)
- 🎯 **Tours** (excursions, activities)
- 🛥️ **Yachts** (boats, sailing)

### Core Engine
1. **Dynamic Seasonal Pricing** — Prices fluctuate based on high/low season, holidays, and custom date ranges
2. **Multi-Role Escrow** — Funds held until checkout completion, then released to partners minus commission
3. **Three-Tier Notification System** — Telegram (sorted topics) + Email + In-App

### Target Users
| Role | Description |
|------|-------------|
| **Renter** | Tourist booking properties/vehicles |
| **Partner** | Property owner/realtor listing assets |
| **Admin** | Platform operator with full control |
| **Moderator** | Assistant with limited admin access |

---

## 2. DATABASE BLUEPRINT (The Brain)

### Supabase PostgreSQL — 17 Tables

| # | Table | Purpose | Key Fields |
|---|-------|---------|------------|
| 1 | `profiles` | All users (any role) | `id`, `email`, `role`, `referral_code`, `custom_commission_rate` |
| 2 | `categories` | Property/Vehicles/Tours/Yachts | `id`, `name`, `slug`, `icon`, `is_active` |
| 3 | `listings` | All rentable assets | `id`, `owner_id`, `category_id`, `base_price_thb`, `metadata` |
| 4 | `bookings` | Reservations | `id`, `listing_id`, `renter_id`, `check_in`, `check_out`, `status` |
| 5 | `payments` | Payment records | `id`, `booking_id`, `amount`, `method`, `txid`, `status` |
| 6 | `seasonal_prices` | Date-based pricing overrides | `listing_id`, `start_date`, `end_date`, `price_thb` |
| 7 | `promo_codes` | Discount codes | `code`, `type`, `value`, `usage_limit`, `expiry_date` |
| 8 | `exchange_rates` | Currency conversion | `currency`, `rate_to_thb` |
| 9 | `payouts` | Partner withdrawals | `partner_id`, `amount`, `wallet`, `status` |
| 10 | `referrals` | Affiliate tracking | `referrer_id`, `referred_id`, `bonus` |
| 11 | `activity_log` | Audit trail | `user_id`, `action`, `entity`, `timestamp` |
| 12 | `blacklist` | Blocked wallets/phones | `type`, `value`, `reason` |
| 13 | `messages` | User messaging | `conversation_id`, `sender_id`, `content` |
| 14 | `conversations` | Chat threads | `participants`, `listing_id` |
| 15 | `system_settings` | App configuration | `key`, `value` |
| 16 | `telegram_link_codes` | Bot account linking | `user_id`, `code`, `expires_at` |
| 17 | `rpc:generate_referral_code` | Database function | N/A |

### JSONB Metadata Strategy

The `metadata` JSONB field appears in `listings`, `bookings`, `payments`, and `messages`. This allows **one table to serve multiple asset types**.

**Example: How `listings.metadata` differs by category:**

```json
// Villa (category: Property)
{
  "bedrooms": 4,
  "bathrooms": 3,
  "pool": true,
  "maxGuests": 8,
  "amenities": ["wifi", "ac", "kitchen", "parking"]
}

// Bike (category: Vehicles)
{
  "brand": "Honda",
  "model": "PCX 160",
  "engineCC": 160,
  "helmet_included": true,
  "delivery_available": true
}

// Yacht (category: Yachts)
{
  "length_meters": 15,
  "capacity": 12,
  "captain_included": true,
  "fuel_policy": "full-to-full"
}
```

**Why JSONB?**
- No schema migrations when adding asset-specific fields
- Query flexibility: `metadata->>'bedrooms'` for filtering
- Single API endpoint handles all categories

---

## 3. BUSINESS LOGIC (The DNA)

### 3.1 Pricing Engine (`/lib/services/pricing.service.js`)

```
┌─────────────────────────────────────────────────────────────┐
│                    PRICE CALCULATION FLOW                    │
├─────────────────────────────────────────────────────────────┤
│  1. Get base_price_thb from listing                         │
│  2. Check seasonal_prices table for date range overrides    │
│  3. Apply promo code discount (if valid)                    │
│  4. Calculate nights × daily rate                           │
│  5. Apply commission_rate (partner-specific or default 15%) │
│  6. Convert to USDT using exchange_rates                    │
└─────────────────────────────────────────────────────────────┘
```

**Commission Logic:**
```javascript
// Priority order for commission rate:
1. partner.custom_commission_rate  // Per-partner override
2. system_settings.defaultCommissionRate  // Global default
3. 15  // Hardcoded fallback
```

### 3.2 Payment Service (`/lib/services/payment.service.js`)

| Method | Status | Implementation |
|--------|--------|----------------|
| **USDT TRC-20** | ⚠️ MOCK | `verifyCryptoPayment()` at line 82. TRON API call **commented out** at line 151 |
| **MIR Cards** | ❌ MOCK | Redirect URL generated at line 66, no processor integrated |
| **Stripe** | ❌ NOT IMPLEMENTED | No code exists |
| **Bank Transfer** | ❌ MOCK | Status manually updated by admin |

**TRON API Location:**
```javascript
// File: /lib/services/payment.service.js
// Line 151 (commented):
// const response = await fetch(`https://api.trongrid.io/v1/transactions/${txId}`);
```

### 3.3 Escrow Flow (Conceptual)

```
Guest Pays → Payment PENDING → Admin Confirms → Payment CONFIRMED
                                                      ↓
                                              Funds in ESCROW
                                                      ↓
                                           Guest Checks Out
                                                      ↓
                                    Payout RELEASED (minus commission)
```

---

## 4. NOTIFICATION ENGINE

### Telegram Integration

| Component | Value |
|-----------|-------|
| **Bot Username** | `@FunnyRent_777_bot` |
| **Bot Token** | `8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM` |
| **Admin Group** | FunnyRent HQ |
| **Group ID** | `-1003832026983` |

### Topic Routing (Forum Threads)

| Topic | Thread ID | Triggered By |
|-------|-----------|--------------|
| 🏠 **Bookings** | `15` | `NEW_BOOKING_REQUEST`, `BOOKING_CONFIRMED`, `BOOKING_CANCELLED` |
| 💰 **Finance** | `16` | `PAYMENT_RECEIVED`, `PAYOUT_PROCESSED`, `PAYOUT_REJECTED` |
| 🤝 **Partners** | `17` | `USER_WELCOME` (role=PARTNER), `PARTNER_VERIFIED`, `PARTNER_REJECTED` |

### How Routing Works

```javascript
// File: /lib/services/notification.service.js

static async sendToAdminTopic(topicType, message) {
  const TOPIC_IDS = {
    BOOKINGS: 15,
    FINANCE: 16,
    NEW_PARTNERS: 17
  };
  
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    body: JSON.stringify({
      chat_id: ADMIN_GROUP_ID,
      message_thread_id: TOPIC_IDS[topicType],  // Routes to correct topic
      text: message,
      parse_mode: 'HTML'
    })
  });
}
```

### Email Service

| Provider | Status |
|----------|--------|
| **Resend** | ⚠️ CODE READY, API KEY NOT CONFIGURED |

Location: `/lib/services/notification.service.js` line ~120

---

## 5. SECURITY & ROLES

### Role Definitions

| Role | DB `role` Value | Access Scope |
|------|-----------------|--------------|
| **ADMIN** | `ADMIN` | All pages, all data, all actions |
| **MODERATOR** | `ADMIN` + `last_name` contains `[MODERATOR]` | Dashboard, Moderation, Categories, Test DB only |
| **PARTNER** | `PARTNER` | Partner dashboard, own listings, own bookings, payouts |
| **RENTER** | `RENTER` | Public pages, booking flow, profile |

### MODERATOR Implementation Detail

Since the `user_role` PostgreSQL enum couldn't be altered, MODERATOR is implemented as:
```sql
-- Profile record for moderator:
INSERT INTO profiles (id, email, role, last_name) 
VALUES ('mod-1', 'assistant@test.com', 'ADMIN', 'Smith [MODERATOR]');
```

Login API strips the marker and returns `role: "MODERATOR"` to frontend.

### ⚠️ AUTHENTICATION WARNING

```
┌──────────────────────────────────────────────────────────────┐
│  🔴 AUTH IS CURRENTLY MOCK                                   │
│  ────────────────────────────────────────────────────────────│
│  • Passwords are NOT verified                                │
│  • Any password works for existing emails                    │
│  • No bcrypt hashing implemented                             │
│  • No JWT/session tokens                                     │
│  • State managed via localStorage only                       │
│                                                              │
│  REQUIRED FOR PRODUCTION:                                    │
│  • Implement Supabase Auth OR                                │
│  • Add bcrypt + JWT to /api/v2/auth/login                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. API v2 INVENTORY

All routes use **Supabase client** directly (not legacy `db-service.js`).

### Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/auth/login` | POST | User login (MOCK password check) |
| `/api/v2/auth/register` | POST | New user registration |

### Public Data

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/categories` | GET | List active categories |
| `/api/v2/districts` | GET | List Phuket districts |
| `/api/v2/exchange-rates` | GET | Currency conversion rates |
| `/api/v2/listings` | GET | Search/filter listings |
| `/api/v2/listings/[id]` | GET | Single listing details |

### Bookings

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/bookings` | GET/POST | List or create bookings |
| `/api/v2/bookings/[id]` | GET/PATCH | Get or update booking status |
| `/api/v2/promo-codes/validate` | POST | Validate discount code |

### Partner Dashboard

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/partner/stats` | GET | Partner earnings/bookings stats |
| `/api/v2/partner/listings` | GET/POST | Partner's listings CRUD |
| `/api/v2/partner/payouts` | GET/POST | Payout requests |

### Admin

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/admin/stats` | GET | Platform-wide statistics |

### User Profile

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/profile` | GET/PATCH | User profile management |

### Telegram

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/telegram/test` | GET/POST | Bot status & test alerts |
| `/api/v2/telegram/link` | POST/PUT | Generate/confirm link codes |

---

## 7. FILE STRUCTURE (Key Locations)

```
/app
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── [[...path]]/route.js  # Legacy redirect (227 lines)
│   │   └── v2/                   # Active API routes
│   ├── admin/                    # Admin pages (9 sections)
│   ├── partner/                  # Partner dashboard
│   └── listings/[id]/            # Public listing page
├── components/
│   └── role-bar.js               # Admin/Partner navigation bar
├── lib/
│   ├── supabase.js               # Supabase client instances
│   ├── client-data.js            # Browser-side Supabase fetcher
│   ├── telegram.js               # Telegram Bot API wrapper
│   └── services/
│       ├── pricing.service.js    # Price calculation
│       ├── booking.service.js    # Availability & status
│       ├── notification.service.js # Telegram + Email
│       └── payment.service.js    # Escrow & crypto
└── .env                          # Environment variables
```

---

## 8. ENVIRONMENT VARIABLES

```env
# Supabase (CONFIGURED)
NEXT_PUBLIC_SUPABASE_URL=https://vtzzcdsjwudkaloxhvnw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Telegram (CONFIGURED)
TELEGRAM_BOT_TOKEN=8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM
TELEGRAM_ADMIN_GROUP_ID=-1003832026983

# Email (NOT CONFIGURED)
RESEND_API_KEY=

# Payments (NOT CONFIGURED)
STRIPE_SECRET_KEY=
TRON_API_KEY=
```

---

## 9. DEMO ACCOUNTS

| Email | Password | Role |
|-------|----------|------|
| `admin@funnyrent.com` | any | Super Admin |
| `assistant@test.com` | any | Moderator |
| `partner@funnyrent.com` | any | Partner |
| `partner@test.com` | any | Partner |
| `client@test.com` | any | Renter |

---

## 10. PRODUCTION CHECKLIST

| Task | Status | Priority |
|------|--------|----------|
| Implement bcrypt password hashing | ❌ | P0 |
| Add JWT/session tokens | ❌ | P0 |
| Configure Resend API key | ❌ | P1 |
| Integrate Stripe payments | ❌ | P1 |
| Enable TRON API verification | ❌ | P1 |
| Add rate limiting | ❌ | P2 |
| Implement CSRF protection | ❌ | P2 |
| Set up error monitoring (Sentry) | ❌ | P2 |

---

## 11. QUICK REFERENCE

### Test Telegram Alerts
```bash
curl -X POST http://localhost:3000/api/v2/telegram/test \
  -H "Content-Type: application/json" \
  -d '{"type": "booking"}'  # or "finance" or "partner"
```

### Check Database Connection
```bash
curl http://localhost:3000/api/v2/telegram/test
# Returns: { configured: true, bot: {...}, chat: {...} }
```

### Login as Admin
```javascript
localStorage.setItem('funnyrent_user', JSON.stringify({
  id: 'admin-777',
  email: 'admin@funnyrent.com',
  role: 'ADMIN',
  name: 'Pavel B.'
}));
```

---

**Document Author:** AI Agent  
**Review Required By:** Lead Architect  
**Next Steps:** Implement P0 security items before any public deployment
