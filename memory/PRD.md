# FunnyRent 2.1 - Product Requirements Document

## Documentation

### Source of Truth Documents
1. **`/app/ARCHITECTURAL_PASSPORT.md`** — Complete technical reference (DB schema, APIs, standards)
2. **`/app/memory/PRD.md`** — Product requirements and changelog
3. **`/app/docs/TECHNICAL_MANIFESTO.md`** — Extended technical documentation

---

## Latest Update: 2026-03-04 - Stage 33.2.1 Global Navigation & Access Repair ✅

### Universal Header (P0) - COMPLETE
- **Component:** `/app/components/universal-header.jsx`
- **Features:**
  - Home icon (teal gradient square) - always visible, leads to landing page
  - Login button (for non-authenticated users)
  - User dropdown (for authenticated users) with role-based navigation
  - Admin Dashboard button (for ADMIN role) - visible everywhere
  - Partner button (for PARTNER & ADMIN roles)
  - My Bookings button (for all authenticated users)
- **Styling:** Fixed position, white background with backdrop-blur, z-index 100

### Route Repair (P0) - COMPLETE
- **Renter Dashboard:** `/dashboard/renter` now loads correctly (was 404)
- **Dashboard shows:** Stats cards (Total Bookings, Active Trips, Pending, Completed)
- **Quick Actions:** My Bookings, Messages, Favorites links

### Data Rendering Fix (P1) - COMPLETE
- **Issue:** Partner Bookings showed "Invalid Date" and "฿0"
- **Cause:** API returns snake_case (`check_in`, `price_thb`) but code expected camelCase
- **Fix:** Added fallback handling for both formats:
  ```js
  const checkIn = booking.checkIn || booking.check_in;
  const priceThb = booking.priceThb || booking.price_thb || 0;
  ```
- **Safe Date Formatting:** Try/catch wrapper prevents Invalid Date errors

### Testing Results - 100% PASS
- Universal Header with Home icon verified on all pages
- Renter Dashboard loads correctly (no 404)
- Partner Bookings - no Invalid Date, no NaN values
- Login flow works (partner credentials tested)

---

## Previous Update: 2026-03-04 - Stage 33.1 Security Alignment & Navigation Fix ✅

### RLS Alignment (P0) - COMPLETE
- **SQL Script v2:** `/app/database/rls_policies_v2.sql` with `::text` casting
- **Issue:** `auth.uid()` returns UUID, IDs stored as TEXT
- **Fix:** All comparisons now use `auth.uid()::text`
- **Helper Functions:** `is_admin()`, `current_user_id()` with TEXT casting
- **Status:** Ready for manual application in Supabase SQL Editor

### Navigation & Roles - COMPLETE
- **Admin Header Bar:** `/app/components/admin-header-bar.jsx` - Persistent purple bar for ADMIN role
- **Dashboard Router:** `/app/app/dashboard/page.js` - Redirects to role-specific dashboard
- **Partner Dashboard:** `/app/app/dashboard/partner/page.js` - Stats, listings, bookings
- **Renter Dashboard:** `/app/app/dashboard/renter/page.js` - Bookings, messages, favorites
- **Admin Dashboard:** `/app/app/admin/page.js` - Full stats, quick actions, system health

### Booking Flow Fix - COMPLETE
- **Issue:** Direct Supabase REST calls with anon key blocked by RLS
- **Fix:** Booking form now uses `/api/v2/bookings` API route (uses service key)
- **Bug Fixed:** Availability check logic (changed OR to AND for date overlap)
- **Guest Bookings:** `renter_id` set to null for anonymous bookings

### Testing Results - 100% PASS
- **Backend:** 9/9 pytest tests passed
- **Frontend:** All dashboards, currency selector working
- **Bug Fixes:** Availability check logic, guest ID handling

---

## Previous Update: 2026-03-04 - Stage 32.2 Security & Automation ✅

### Supabase RLS (P0) - THE SHIELD - READY
- **SQL Script:** `/app/database/rls_policies.sql` created
- **Tables Protected:** listings, bookings, payments, messages, conversations, profiles
- **Rules:**
  - Users see only their own records (`user_id` or `owner_id` = auth.uid())
  - ACTIVE listings visible to all (public catalog)
  - Admin role has FULL access (via `is_admin()` helper function)
- **Status:** Ready for manual application in Supabase SQL Editor

### Vercel Cron Jobs (P0) - THE BRAIN - CONFIGURED
- **File:** `/app/vercel.json` created
- **Trigger 1 (Check-in Prompt):** `0 7 * * *` (14:00 Bangkok)
  - Push notification: "🏝 Have you checked in? Confirm arrival in the app!"
- **Trigger 2 (Auto-Payout):** `0 11 * * *` (18:00 Bangkok)
  - Release funds for bookings > 24h after check-in
- **Security:** Both cron APIs support:
  - `x-vercel-cron` header (Vercel automatic)
  - `x-cron-secret` header (manual trigger)
  - `Authorization: Bearer {secret}` (API clients)

### Currency Selector (P1) - UX - COMPLETE
- **Component:** `/app/components/currency-selector.jsx`
- **Location:** Header (next to Language switcher)
- **Currencies:** THB 🇹🇭, USD 🇺🇸, RUB 🇷🇺, CNY 🇨🇳, EUR 🇪🇺, GBP 🇬🇧
- **Persistence:** localStorage key `funnyrent_currency`
- **Broadcast:** Custom event `currency-change` for cross-component sync

### Testing Results - 100% PASS
- **Backend:** 11/11 pytest tests passed
- **Frontend:** Currency selector, homepage, listings all working
- **Bug Fixed:** checkin-reminder cron enum (PAID_ESCROW → PAID/CONFIRMED)

---

## Previous Update: 2026-03-04 - Stage 32.1 Stability & Live Business Test ✅

### Infrastructure Fixes (P0) - COMPLETE
- **DYNAMIC_SERVER_USAGE:** Added `export const dynamic = 'force-dynamic'` to:
  - `/api/v2/profile/route.js`
  - `/api/v2/partner/stats/route.js`
  - `/api/v2/geo/route.js`
  - `/api/v2/forex/route.js`
  - `/api/v2/push/route.js`
  - `/api/v2/bookings/route.js`
  - `/api/v2/listings/route.js`
  - `/api/v2/payments/route.js`
- **API Timeouts:** All external APIs (ExchangeRate-API, TronScan, ip-api.com) have 10s timeouts with fallbacks

### Live Business Test Results - 100% PASS
- **Forex API:** THB→RUB (25,432.02₽), THB→USD ($326.65), THB→CNY (¥2,249.05)
- **FunnyRate 3.5%:** Mathematically verified (funnyRate = marketRate × 1.035)
- **Geo API:** Currency recommendation working
- **24H Escrow Rule:** Cron returns "Payouts released at 18:00, 24 hours after check-in"
- **PWA:** manifest.json and icons (192x192, 512x512) accessible
- **Homepage:** 5 listings with "Book Now" buttons displayed
- **Booking Form:** Price breakdown shows rental + 15% service fee

### UX Polish - COMPLETE
- **Listing Cards:** Book Now buttons aligned
- **Price Display:** ฿35,000/per day format
- **Icons:** Beds/baths/area aligned in card grid
- **Featured Badge:** Gradient purple-pink styling

---

## Previous Update: 2026-03-04 - Stage 32 Escrow 24H & Dynamic Forex Engine ✅

### 24H Escrow Rule (P0) - COMPLETE
- **New Logic:** Payouts released at **18:00 LOCAL TIME ON DAY AFTER CHECK-IN**
- **Buffer:** 24h window protects guests from no-shows
- **Status:** New `THAWED` status between `PAID_ESCROW` and `COMPLETED`
- **Admin Notification:** Thread 16 receives alerts when payouts are "Thawed"
- **API:** `/api/cron/payouts?secret=funnyrent-cron-2026` (GET for status, POST for processing)

### Dynamic Forex Engine (P0) - COMPLETE
- **Base Currency:** THB in all database records
- **FunnyRate Formula:** Display Price = Market Rate × 1.035 (hidden 3.5% markup)
- **Provider:** ExchangeRate-API (key: `9098becb6ccc3ca934ab5884`)
- **Caching:** 1-hour in-memory cache with fallback rates
- **API:** `/api/v2/forex` - GET rates, ?convert=X&from=THB&to=USD for conversion
- **12 Supported Currencies:** THB, USD, RUB, CNY, EUR, GBP, AUD, SGD, JPY, KRW, INR, USDT

### Geo-Detection & Auto-Currency (P0) - COMPLETE
- **Provider:** ip-api.com (free tier)
- **Country Mapping:** 30+ countries to preferred currencies
- **API:** `/api/v2/geo` - Detects location and recommends currency
- **Hook:** `use-currency.js` - React hook for currency context
- **Fallback:** USD for unknown locations

### Firebase Push Notifications (P1) - COMPLETE
- **Project:** funnyrent-push
- **Service:** Firebase Cloud Messaging (FCM)
- **Templates:** NEW_MESSAGE, BOOKING_REQUEST, BOOKING_CONFIRMED, PAYMENT_RECEIVED, CHECKIN_REMINDER, PAYOUT_READY
- **Check-in Reminder:** Automatic push at 14:00 on check-in day
- **API:** `/api/v2/push` - Register tokens, send notifications
- **Cron:** `/api/cron/checkin-reminder` - 14:00 daily

### Booking Actions in Chat - COMPLETE
- **Component:** `/components/booking-actions.jsx`
- **Features:** Quick Approve/Reject buttons for partners
- **Dialog:** Reject with reason (sent to guest)
- **Inline:** Compact version for chat messages

### Files Created
- `/app/lib/services/forex.service.js` → Exchange rate service with FunnyRate
- `/app/lib/services/geo.service.js` → IP-based geo detection
- `/app/lib/services/push.service.js` → Firebase FCM integration
- `/app/hooks/use-currency.js` → React currency context hook
- `/app/app/api/v2/forex/route.js` → Forex API endpoint
- `/app/app/api/v2/geo/route.js` → Geo detection API
- `/app/app/api/v2/push/route.js` → Push notification API
- `/app/app/api/cron/checkin-reminder/route.js` → Check-in reminder cron
- `/app/components/booking-actions.jsx` → Approve/Reject booking UI

### Files Modified
- `/app/lib/services/escrow.service.js` → Added 24H rule (ESCROW_THAW_DAYS = 1)
- `/app/lib/services/notification.service.js` → New events for thaw/payout/reminder
- `/app/app/api/cron/payouts/route.js` → Updated with 24H logic + admin notifications
- `/app/.env` → Added EXCHANGE_API_KEY, CRON_SECRET

### Testing Results
- **Backend:** 100% (11/11 tests passed)
- **Features Verified:** Forex conversion, FunnyRate markup, Geo detection, Push templates, 24H cron

---

## Previous Update: 2026-03-03 - Stage 31 In-Chat Payments & Escrow Logic ✅

### Supabase Realtime Chat
- **Hook:** `/hooks/use-realtime-chat.js` с useRealtimeMessages, usePresence
- **Features:**
  - Instant message sync via postgres_changes
  - Online/Offline status indicator
  - Notification sound for new messages
  - Presence tracking

### Finance Precision
- **Tolerance:** Changed to 0.5% (strict) in `tron.service.js`
- **USDT in Telegram:** Alerts now show amount in USDT (Thread 16)
- **New Topic:** MESSAGES (Thread 18) for chat notifications

### PWA Support
- **Manifest:** `/public/manifest.json` created
- **Icons:** Placeholder structure in `/public/icons/`
- **Meta tags:** apple-mobile-web-app support in layout.js

### Notification Bridge
- **NEW_MESSAGE handler:** Routes to dedicated MESSAGES topic (Thread 18)
- **Template:** "💬 New message from [Name] regarding [Listing Title]"

### Files Created/Modified
- `/app/hooks/use-realtime-chat.js` → NEW: Realtime hooks
- `/app/public/manifest.json` → NEW: PWA manifest
- `/app/app/layout.js` → Updated with PWA meta tags
- `/app/app/renter/messages/[id]/page.js` → Realtime + Online status
- `/app/app/partner/messages/[id]/page.js` → Realtime + Online status
- `/app/lib/services/notification.service.js` → MESSAGES topic, USDT display

---

## Latest Update: 2026-03-03 - Stage 29.7 Payment UX & Security Upgrade ✅

### QR Code Integration (UX)
- **Library:** `qrcode.react` v4.2.0 installed
- **Location:** Crypto Modal in `/app/checkout/[bookingId]/page.js`
- **Data:** Encodes `TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5`
- **UI:** Central QR code with "Scan with your Wallet App (TRC-20)" label

### Full Amount Verification (SECURITY) - ACTIVE
- **Service:** `/lib/services/tron.service.js` v2.0
- **Logic:** Fetches actual amount from TronScan API
- **Validation:**
  - `UNDERPAID` if Blockchain Amount < Booking Amount (with 2% tolerance)
  - `INVALID_RECIPIENT` if addresses don't match
  - `SUCCESS` if all checks pass
- **Admin UI:** Shows Received vs Expected amount in Finance Dashboard

### New Status Badges
- `UNDERPAID` - Orange badge for insufficient payment
- `INVALID_RECIPIENT` - Red badge for wrong wallet
- Amount comparison table in verification results

### Files Modified
- `/app/lib/services/tron.service.js` → Full amount verification
- `/app/app/api/v2/payments/verify-tron/route.js` → Amount params
- `/app/app/checkout/[bookingId]/page.js` → QR Code + amount UI
- `/app/app/admin/finances/page.js` → Amount comparison display

### Known Issues
- **Preview API 502:** Intermittent proxy timeouts on preview environment
- All APIs work correctly on localhost:3000

---

## Latest Update: 2026-03-03 - Stage 29.6 Finance Hub & Live Verification ✅

### USDT Payment Integration (LIVE)
- **Official Wallet:** `TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5`
- **Network:** TRC-20 (TRON)
- **Checkout Modal:** Updated with correct wallet, copy button, amount in USDT
- **TXID Submit:** `/api/v2/payments/submit-txid` API for user TXID submission

### TronScan Live Verification
- **API Service:** `/lib/services/tron.service.js`
- **Endpoint:** `/api/v2/payments/verify-tron?txid=[TXID]`
- **Checks:** Transaction confirmation, recipient wallet match, USDT token validation
- **Status Badges:** SUCCESS, PENDING, NOT_FOUND, WRONG_WALLET, WRONG_TOKEN

### Finance Dashboard (Admin)
- **Location:** `/admin/finances`
- **Features:**
  - Pending payments counter with red badge
  - Filter tabs: All, Pending, Crypto, MIR, Card, Confirmed
  - Payment cards with method icons, status badges
  - "View on TronScan" button for crypto payments
  - Live verification with real-time status display
  - Confirm/Reject actions with notifications

### Scalable Payments Table
- **Schema:** `payments` table with `method` ENUM (CRYPTO, CARD, MIR)
- **Fields:** booking_id, amount, currency, method, status, tx_id, metadata

### Telegram Finance Alerts (Thread 16)
- **New Event:** `PAYMENT_SUBMITTED` - triggers when user submits TXID
- **Template:** "💰 NEW [USDT TRC-20] PAYMENT! Listing: [Title], Amount: [Price], TXID: [Value]"
- **Partner Alert:** "Оплата на проверке" notification

### Files Created/Modified
- `/app/lib/services/tron.service.js` → NEW: TronScan verification
- `/app/lib/services/payment.service.js` → UPDATED: submitTxid, countPending
- `/app/app/api/v2/payments/route.js` → NEW: Payments list API
- `/app/app/api/v2/payments/submit-txid/route.js` → NEW: TXID submit
- `/app/app/api/v2/payments/verify-tron/route.js` → NEW: Live verification
- `/app/app/admin/finances/page.js` → UPDATED: Finance dashboard
- `/app/app/checkout/[bookingId]/page.js` → UPDATED: Crypto modal
- `/app/app/api/v2/bookings/[id]/payment/initiate/route.js` → UPDATED: Wallet

---

## Latest Update: 2026-03-03 - Stage 29 Unified Ecosystem ✅

### Partner Onboarding Flow
- **"Become a Partner" Button:** `/profile` page for RENTERs with CTA
- **Application Form:** Phone*, Social Link, Experience*, Portfolio
- **Admin Moderation:** `/admin/moderation` Partners tab filters `metadata.partner_status = 'PENDING'`
- **Approval Flow:** Sets `role = 'PARTNER'`, sends email notification
- **Telegram Alert:** Notification to Admin Group (Thread 17) on new applications

### Dashboard Mode Toggle (Airbnb-style)
- **For Partners:** "Путешествую" / "Сдаю жильё" toggle in profile
- **Redirects:** To `/my-bookings` or `/partner/dashboard`
- **Stored in:** `profile.metadata.dashboard_mode`

### Smart Chat Security
- **Pattern Detector:** `/components/chat-safety.js`
- **Detects:** Phone numbers, @telegram handles, URLs, WhatsApp mentions
- **SafetyBanner:** Shows warning without blocking (escrow reminder)

### USDT Payment (TRC-20) Stub
- **Enhanced Modal:** Network warning, copy wallet address
- **Wallet:** `TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb`
- **TXID Field:** Saved to payments table for admin verification

### Additional Email Templates
- `partnerApproved`: Sent when admin approves partner
- `bookingStatusChange`: Sent on CONFIRMED/CANCELLED/PAID

### Files Created/Modified
- `/app/app/profile/page.js` → NEW: User profile with partner CTA
- `/app/components/chat-safety.js` → NEW: Pattern detector + SafetyBanner
- `/app/app/api/notifications/partner-approved/route.js` → NEW: Email trigger
- `/app/lib/services/email.service.js` → Added 2 new templates
- `/app/app/admin/moderation/page.js` → Partner approval with email
- `/app/app/checkout/[bookingId]/page.js` → USDT TRC-20 enhanced

---

## Latest Update: 2026-03-03 - Stage 28 Visual Perfection & Resend ✅

### Header & User Identity
- **User Name Display:** Shows first name next to profile icon when logged in
- **"List Property" CTA:** Teal button in header (desktop), links to `/partner/listings/new`
- **Responsive Navigation:** Clean, no-overlap layout on mobile/tablet

### Homepage & Listing Cards (Pixel Perfect)
- **Search Bar:** Added functional "Search" button with magnifying glass icon
- **Filter Alignment:** Dates, District, Category filters properly aligned in grid
- **Card Button Alignment:** "Book Now" buttons aligned at bottom using `flex-col` + `mt-auto`
- **Icon Row:** Bedroom/bathroom/area icons in single consistent line
- **Tropical Style:** White background, soft shadows, unified Teal (#0d9488) color

### Resend Email Engine ✅
- **API Key:** `re_Rr2not4n_BuKnXeBCp432v3Avgr2KAFmG` (added to `.env`)
- **Email Service:** `/app/lib/services/email.service.js` with professional templates
- **Multilingual Support:** RU, EN, ZH, TH with bilingual format
- **Templates Implemented:**
  1. Welcome Email (New Registration)
  2. Booking Requested (To Renter)
  3. New Lead Alert (To Partner/Admin)
- **Booking Integration:** ✅ Emails triggered on booking creation
- **Note:** Domain verification required at resend.com/domains for production

### Technical Improvements
- **Tailwind Config:** Centralized Teal/Azure colors in `/app/tailwind.config.js`
- **Form Buttons:** Full-width on mobile with `w-full sm:w-auto`

### Files Created/Modified
- `/app/tailwind.config.js` → Added teal/azure color palette
- `/app/lib/services/email.service.js` → NEW: Resend email service
- `/app/app/page.js` → REWRITTEN: Visual perfection, header, cards
- `/app/.env` → Added RESEND_API_KEY

---

## Latest Update: 2026-03-03 - Stage 27 Complete ✅

### Telegram Bot & Workflow Cleanup (Stage 27)

#### Task 1: Draft Isolation ✅
- **Bot creates listings** with `status='INACTIVE'` + `metadata.is_draft=true`
- **Admin moderation** filters out listings where `metadata.is_draft=true`
- **Rationale**: `DRAFT` is not a valid enum value, so we use INACTIVE + metadata flag

#### Task 2: Storage Auto-Cleanup ✅
- **DELETE /api/v2/listings/[id]** now cleans up Supabase Storage files
- **Partner dashboard delete** also cleans up storage
- Files in `listings` bucket are deleted when listing is removed

#### Task 3: Advanced Price Parsing ✅
- Handles currency markers (THB, бат, ฿, baht)
- Picks MAX number > 1000 (ignores bedroom/bathroom counts)
- Filters out distance/time patterns (до 300м, через 5 минут)
- Test: "3 bedrooms, 5000 THB" → 5000 ✅

#### Task 4: DB Schema Compliance ✅
- Column name: `base_price_thb` (not `base_price`)
- Status enum: PENDING, ACTIVE, BOOKED, INACTIVE, REJECTED

#### Task 5: "Publish Draft" Button ✅ (LAZY REALTOR COMPLETE)
- **Button Location:** Partner Dashboard, appears only for draft listings
- **Validation:** Disabled if `base_price_thb <= 0` OR `images` array empty
- **Transition:** `status: INACTIVE → PENDING`, `metadata.is_draft: true → false`
- **Admin Notification:** Telegram to Group Thread 17 (NEW_PARTNERS)
- **UI Feedback:** Toast: "Отправлено на модерацию"

### Full "Lazy Realtor" Flow ✅
```
1. Partner sends photo + caption to Telegram Bot
2. Bot creates listing: status=INACTIVE, is_draft=true (NOT visible to Admin)
3. Partner edits draft in Dashboard (add price, photos if needed)
4. Partner clicks "Отправить на модерацию" button
5. System: status→PENDING, is_draft→false, Telegram notification sent
6. Admin sees listing in Moderation queue
7. Admin approves → status=ACTIVE (live on site)
```

### Files Modified
- `/app/app/api/webhooks/telegram/route.js` → v6.2
- `/app/app/admin/moderation/page.js` → Draft filtering
- `/app/app/api/v2/listings/[id]/route.js` → Storage cleanup
- `/app/app/partner/listings/page.js` → **REWRITTEN** - Mobile-first responsive UI
- `/app/app/partner/listings/new/page.js` → Mobile-optimized form buttons

### Mobile UI Overhaul (Partner Dashboard)
- **Container:** `max-w-full overflow-x-hidden` - no horizontal scrolling
- **Stats:** 2x2 grid on mobile (compact)
- **Listing Cards:** Image + Info on left, clickable card navigates to edit
- **Action Buttons:** Always visible row below card content
- **Publish Button:** Prominent teal "Опубликовать" for ANY `INACTIVE` listing
- **Form Buttons:** Full-width on mobile (`w-full sm:w-auto`)
- **FAB:** Removed (replaced with header "Добавить" button)

---

## Latest Update: 2026-03-02 - Nervous System Phase ✅

### Notification System Activated (2026-03-02)

#### NotificationService v2.0
- **Telegram Topics**: BOOKINGS (15), FINANCE (16), NEW_PARTNERS (17)
- **Resend Email**: Ready for integration (falls back to mock if no API key)
- **Escrow Message**: Included in all payment-related notifications

#### Telegram Webhook v5.0
- **Runtime**: Node.js (more stable than Edge)
- **Pattern**: Immediate Response + Fire-and-Forget
- **Commands**: /start, /help, /link email, /status
- **Lazy Realtor**: Photo → Draft listing

#### Event Types Supported
- NEW_BOOKING_REQUEST → Guest + Partner + Admin Topic
- BOOKING_CONFIRMED → Guest + Admin Topic
- PAYMENT_SUCCESS → Guest + Partner + Admin Topic (with Escrow message)
- CHECK_IN_CONFIRMED → Partner + Admin Topic
- LISTING_APPROVED/REJECTED → Partner
- PARTNER_VERIFIED/REJECTED → Partner + Admin Topic

### ARCHITECTURAL_PASSPORT.md Updated
- Added Critical Routes section (webhook)
- Added Notification System section
- Added Price Unification formula
- Added Escrow message documentation

---

## Latest Update: 2026-03-02 - Unified Pricing & Mobile UI Fix ✅

### Pricing Unification (2026-03-02)

#### Problem Solved
- **Price Mismatch**: Booking modal showed ฿175,000 but checkout showed ฿201,250 (+15% fee)
- **User Surprise**: Hidden service fee was frustrating for users

#### Solution ✅
- Booking modal now includes 15% service fee in the price breakdown
- "Total to Pay" in modal matches checkout page exactly
- Smart discount display shows strikethrough for low season pricing

#### Price Breakdown Display
```
Rental cost (5 nights):     ฿175,000
Service fee (15%):          ฿26,250
─────────────────────────────────────
Total to Pay:               ฿201,250
```

### Mobile Responsiveness (2026-03-02) ✅
- Modal: `max-h-[90vh] overflow-y-auto`
- Touch-friendly inputs: `h-12` height
- 2-column date layout on mobile
- Scrollable price breakdown section

---

## Latest Update: 2026-03-01 - Booking Submission Fix Complete ✅

### Booking Form Fix (2026-03-01)

#### Problem Solved
- **"Error creating request"**: The booking form showed an error toast instead of creating the booking.
- **Root Cause**: The code was trying to insert a `metadata` column that doesn't exist in the `bookings` table.
- **Supabase Error**: `PGRST204 - Could not find the 'metadata' column of 'bookings' in the schema cache`

#### Solution ✅
- Removed the `metadata` field from the booking insert request in `/app/listings/[id]/page.js`
- Added detailed console logging for debugging future issues

#### Full Flow Now Working ✅
1. User fills booking form (name, email, phone, dates)
2. Price breakdown calculates automatically
3. Submit button shows calculated total
4. Booking saved to Supabase with correct `price_thb`
5. User redirected to `/checkout/[booking_id]`
6. Checkout page loads booking from Supabase
7. Payment options displayed with 15% service fee

---

### Checkout Page Fixes (2026-03-01) ✅

#### Problem Solved
- **"Redirect Deadlock"**: After booking creation, users were redirected to `/checkout/[id]` but saw "Бронирование недоступно" (Booking not found) error.
- **Root Cause**: Kubernetes ingress/proxy was returning 502 errors for API routes like `/api/v2/bookings/[id]/payment-status`.

#### Solution Implemented ✅
- Modified `loadPaymentStatus()` in `/app/checkout/[bookingId]/page.js` to fetch booking data directly from Supabase REST API, bypassing the internal API routes.
- This mirrors the approach used in the listing detail page, which already works correctly.

#### New API Endpoints Created ✅
- `GET /api/v2/bookings/[id]/payment-status` — Returns booking + listing info
- `POST /api/v2/bookings/[id]/payment/initiate` — Initiate payment (CARD/MIR/CRYPTO)
- `POST /api/v2/bookings/[id]/payment/confirm` — Confirm payment
- `POST /api/v2/bookings/[id]/check-in/confirm` — Confirm check-in, release funds

#### Checkout Page Features ✅
- Payment methods: Bank card, MIR, USDT (TRC-20)
- Order summary with dates and calculated total
- 15% service fee automatically calculated
- Promo code input with validation
- "Оплатить" button shows total price

---

### Pricing Integration (2026-03-01) ✅

#### pricing.service.js Refactored
- Reads seasonal pricing from `listings.metadata.seasonal_pricing` (JSONB)
- New method: `calculateBookingPriceSync()` for client-side calculation
- Uses `priceMultiplier` (e.g., 1.3 = +30%)

#### Listing Detail Page
- Real-time price calculation when dates selected
- Price breakdown UI in booking modal
- Submit button shows calculated total

---

### UI Cleanup Changes (2026-03-01)

#### Moderation Modal Fixes ✅
- **Single Close Button**: Hidden default Shadcn button via `[&>button]:hidden`, custom X button at z-20
- **Carousel Arrows**: Positioned at left-4/right-14 with z-10, no overlap with close button
- **Featured Toggle**: Replaced text "нажмите" with functional Switch component
- **Clean Layout**: Info grid shows Цена, Комиссия, Дата, Рекомендуем with Switch

#### Partner Edit Page Fixes ✅
- **Mobile Responsive Seasonal Pricing**: Grid layout with 2-column date inputs
- **Improved Form Padding**: Better spacing on mobile devices
- **Save Redirect**: After save, redirects to `/partner/listings` with success toast

---

## Previous Changes

### iCal UI & Manual Sync (2026-03-01) ✅
- CalendarSyncManager with URL input + Platform dropdown
- Admin Panel manual sync button
- Node.js runtime for longer operations

### Stage 25.2 (2026-02-28) ✅
- Moderation Photo Carousel
- Chat System (conversations + messages)
- Reject Flow with Telegram notifications
- Read Receipts

---

## Working Features

### Pricing System ✅
- Seasonal pricing stored in `listings.metadata.seasonal_pricing`
- Real-time price calculation in booking form
- Price breakdown by season in booking modal
- Calculated total sent to booking (not base price)

### Moderation System ✅
- Single close button in modal
- Photo carousel for mobile
- Featured toggle with Switch
- Approve/Reject with feedback
- Telegram notifications
- Admin ↔ Partner messaging

### iCal Synchronization ✅
- Add multiple sources per listing
- Platform dropdown (Airbnb, Booking, VRBO, Google, Custom)
- Manual sync per listing
- Global sync from Admin Panel
- Auto-sync toggle

### Partner Portal ✅
- Create/Edit listings
- Mobile-responsive forms
- Save as Draft
- Redirect after save
- Seasonal pricing management
- iCal sync management

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@funnyrent.com | ChangeMe2025! |
| Partner | partner@test.com | ChangeMe2025! |

---

## Tech Stack
- **Framework:** Next.js 14.2.3 (App Router)
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage
- **Auth:** Supabase Auth
- **Bot:** Telegram Bot API
- **UI:** Tailwind CSS, Shadcn/UI, Embla Carousel

---

## Code Architecture
```
/app/
├── lib/
│   └── services/
│       └── pricing.service.js     # Refactored - uses metadata
├── components/
│   ├── ui/                         # Shadcn components
│   │   ├── switch.jsx              # Used for Featured toggle
│   │   └── carousel.jsx            # Used in moderation modal
│   └── calendar-sync-manager.jsx   # iCal UI
├── app/
│   ├── listings/[id]/page.js       # Price breakdown in modal
│   ├── admin/
│   │   ├── moderation/page.js      # UI cleanup applied
│   │   ├── messages/page.js
│   │   └── system/page.js
│   └── partner/
│       ├── listings/[id]/page.js   # Mobile-responsive, redirect
│       └── messages/[id]/page.js
```

---

## Next Priority Tasks

### Upcoming (P1)
- **Background iCal Sync** — Vercel Cron or external service
- **Stripe Integration** — Payment processing
- **Resend Integration** — Email notifications
- **Real-time Chat** — Supabase Realtime for instant messages

### Future/Backlog (P2+)
- Move Supabase service key to environment variables
- Add VisuallyHidden DialogTitle for accessibility
- TRON/USDT Verification
- Advanced Analytics

---

## Testing Summary
- **Pricing Tests (2026-03-01)**: 4/4 passed (base, high season, mixed, invalid)
- **iteration_5.json**: UI Cleanup - 100% success (6/6 tests)
- **iteration_4.json**: iCal UI - All tests passed
- **iteration_3.json**: Stage 25.2 - All tests passed

---

## Preview URL
https://c325362c-1be1-450d-a1ad-cc1fb45ba828.preview.emergentagent.com
