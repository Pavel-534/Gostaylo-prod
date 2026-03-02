# FunnyRent 2.1 - Product Requirements Document

## Documentation

### Source of Truth Documents
1. **`/app/ARCHITECTURAL_PASSPORT.md`** — Complete technical reference (DB schema, APIs, standards)
2. **`/app/memory/PRD.md`** — Product requirements and changelog
3. **`/app/docs/TECHNICAL_MANIFESTO.md`** — Extended technical documentation

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
