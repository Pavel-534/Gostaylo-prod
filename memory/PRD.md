# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-28 - Multi-Source iCal Sync Engine Complete ✅

### iCal Sync Engine (Stage 23) ✅
**Features Implemented:**

1. **iCal Parser Service** (`/app/lib/services/ical-sync.service.js`)
   - Parse .ics files (VEVENT extraction)
   - Support for date-only and datetime formats
   - Timezone handling (Asia/Bangkok UTC+7)
   - Auto-detection of source platform (Airbnb, Booking.com, VRBO, Google)

2. **API Endpoint** (`/app/app/api/ical/sync/route.js`)
   - `POST /api/ical/sync` - Sync single listing or global sync
   - `GET /api/ical/sync` - Get sync status and settings
   - Actions: `parse`, `sync`, `sync-all`

3. **Partner UI** - Calendar Sync Manager (`/app/components/calendar-sync-manager.jsx`)
   - Multi-source support (add/remove multiple iCal URLs)
   - Platform auto-detection
   - Real-time sync status per source
   - "Sync Now" button per source or all at once
   - Blocked dates summary view
   - Help instructions for each platform

4. **Admin UI** - System Control Center (`/app/app/admin/system/page.js`)
   - Global sync statistics (listings, success, errors)
   - Frequency setting (15m, 30m, 1h, 2h, 6h)
   - "Sync All" button for manual global sync
   - Last sync timestamp

### Database Schema Updates
- `listings.sync_settings` - JSONB array of iCal sources
- `bookings.status` - Added 'BLOCKED_BY_ICAL' value
- `bookings.metadata` - Stores ical_source, ical_uid, ical_url
- `system_settings` - Keys: ical_sync_status, ical_sync_settings

### Technical Architecture
```
┌─────────────────┐     ┌──────────────────┐
│  Partner UI     │────▶│  API Endpoint    │
│  (Add iCal)     │     │  /api/ical/sync  │
└─────────────────┘     └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  iCal Service    │
                        │  - Fetch .ics    │
                        │  - Parse events  │
                        │  - Create blocks │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  Supabase        │
                        │  - bookings      │
                        │  - listings      │
                        └──────────────────┘
```

### Conflict Management
- Each VEVENT creates a `BLOCKED_BY_ICAL` booking
- Stores: check_in, check_out, ical_uid, ical_source
- Cleanup: Removes blocks no longer in iCal feed
- Updates: Changes dates if event moved

---

## Previous Completed Work

### Telegram Webhook v4.0 ✅
- Immediate response pattern (25ms)
- Fire-and-forget processing

### Supabase Auth ✅
- Login/logout/signup/password change
- Route protection

### Public Registration ✅
- Login/SignUp tabs
- Creates RENTER users

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@funnyrent.com | ChangeMe2025! |
| Partner | partner@test.com | ChangeMe2025! |

## Tech Stack
- **Framework:** Next.js 14.2.3 (App Router)
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth
- **Bot:** Telegram Bot API (Edge Runtime)
- **UI:** Tailwind CSS, Shadcn/UI

## Next Priority Tasks
### Upcoming
- **P1: Stripe Integration** — Payment processing
- **P1: Localize 404 pages** — Error pages translation

### Future/Backlog
- **P1: TRON/USDT Verification** — Blockchain verification
- **P1: Resend Integration** — Email notifications
- **P1: Background Sync Worker** — Automated periodic sync

## Code Architecture
```
/app/
├── app/
│   ├── api/
│   │   ├── ical/sync/route.js         # iCal Sync API
│   │   └── webhooks/telegram/route.js # Telegram webhook
│   ├── admin/system/page.js           # System Control Center
│   └── partner/listings/[id]/page.js  # Listing edit + Calendar Sync
├── components/
│   └── calendar-sync-manager.jsx      # Multi-source iCal UI
├── lib/
│   ├── services/ical-sync.service.js  # iCal parser & sync logic
│   └── auth.js                        # Supabase Auth helpers
└── .env                               # Configuration
```
