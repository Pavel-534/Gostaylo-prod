# FunnyRent 2.1 - Product Requirements Document

## Documentation

### Source of Truth Documents
1. **`/app/ARCHITECTURAL_PASSPORT.md`** — Complete technical reference (DB schema, APIs, standards)
2. **`/app/memory/PRD.md`** — Product requirements and changelog
3. **`/app/docs/TECHNICAL_MANIFESTO.md`** — Extended technical documentation

---

## Latest Update: 2026-03-03 - Stage 31 In-Chat Payments & Escrow Logic ✅

### In-Chat Invoicing (P0) - COMPLETE
- **Location:** Partner Chat (`/app/partner/messages/[id]/page.js`)
- **UI:** Send Invoice button with amber styling and Receipt icon
- **Dialog:** `SendInvoiceDialog` component for creating invoices with:
  - Amount input with currency selector (THB, USDT, RUB)
  - Payment method selection (CRYPTO, CARD, MIR)
  - Optional description field
  - Auto-conversion to USDT display
- **API:** `/api/v2/chat/invoice` - POST to create, GET to retrieve
- **Display:** `InvoiceCard` component shows in chat for both partner and renter

### Dynamic Commission System (NEW CRITICAL) - COMPLETE
- **Snapshot Logic:** Commission rate captured at booking creation
- **Storage:** New field `applied_commission_rate` in bookings
- **Service:** `EscrowService.snapshotCommissionRate(bookingId)`
- **Integrity:** Payout uses snapshotted rate, immune to global rate changes
- **Notifications:** Telegram payouts show "Commission: X% (fixed at booking time)"

### Invoice Card Features
- **Currency Symbols:** THB (฿), USDT ($), RUB (₽) with colored icons
- **Status Badges:** PENDING, PAID, EXPIRED, CANCELLED
- **Listing Info:** Title, dates, property image
- **Pay Button:** For renters - redirects to checkout page

### Escrow & Payout Logic (P1) - COMPLETE
- **Status:** `PAID_ESCROW` status implemented
- **Commission Calculation:** Uses snapshotted rate from booking
- **Cron Job:** `/api/cron/payouts` for automated 18:00 payouts
- **Notifications:** Telegram alerts with commission details

### PWA Visuals - COMPLETE
- **Icons:** Real PNG icons generated (192x192, 512x512)
- **Theme:** Tropical teal gradient with house/palm silhouette
- **Manifest:** Updated `/public/manifest.json` with new icons

### Files Created/Modified
- `/app/app/partner/messages/[id]/page.js` → Send Invoice button + Invoice rendering
- `/app/app/renter/messages/[id]/page.js` → Invoice card display with Pay button
- `/app/components/chat-invoice.jsx` → InvoiceCard + SendInvoiceDialog
- `/app/app/api/v2/chat/invoice/route.js` → Invoice API
- `/app/lib/services/escrow.service.js` → Dynamic commission snapshotting
- `/app/lib/services/notification.service.js` → Payout notifications with commission
- `/app/public/icons/icon-192x192.png` → PWA icon (real PNG)
- `/app/public/icons/icon-512x512.png` → PWA icon (real PNG)
- `/app/public/manifest.json` → Updated with new icons

### Known Issues
- **Preview API 502:** Intermittent proxy timeouts (infrastructure, not code)
- All APIs work correctly on localhost:3000
- Code verified via testing agent code review (100% pass)

---

## Previous Update: 2026-03-03 - Stage 30 Realtime Chat & Finance Precision ✅

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
