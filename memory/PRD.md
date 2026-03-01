# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-03-01 - Pricing Integration Complete ✅

### Pricing Service Integration (2026-03-01)

#### pricing.service.js Refactored ✅
- **Fixed Data Source**: Now reads seasonal pricing from `listings.metadata.seasonal_pricing` (JSONB)
- **Removed Broken Query**: No longer queries non-existent `seasonal_prices` table
- **New Method**: Added `calculateBookingPriceSync()` for client-side real-time calculation
- **Multiplier System**: Uses `priceMultiplier` (e.g., 1.3 = +30%, 0.8 = -20%)
- **Season Summary**: Returns breakdown by season type for UI display

#### Listing Detail Page Updated ✅
- **Real-time Price Calculation**: Calculates total when dates are selected
- **Price Breakdown UI**: Shows detailed breakdown in booking modal
- **Season-aware**: Displays which nights fall into which seasons
- **Total Display**: Submit button shows calculated total
- **Date Validation**: Check-out date min is tied to check-in

#### Tests Passed ✅
- Base price calculation (5 nights × ฿35,000 = ฿175,000)
- High season multiplier (5 nights × 1.3 = ฿227,500)
- Mixed seasons (3 High + 2 Low = ฿192,500)
- Invalid date range handling

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
