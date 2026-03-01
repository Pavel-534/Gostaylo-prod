# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-03-01 - iCal UI Fix & Manual Sync Complete ✅

### Changes (2026-03-01)

#### CalendarSyncManager UI Overhaul ✅
- **Input Field**: Proper input for iCal URL with placeholder
- **Platform Dropdown**: Select from Airbnb, Booking.com, VRBO, Google Calendar, Custom
- **Auto-Sync Toggle**: Switch to enable/disable automatic sync
- **"Синхронизировать все" Button**: Syncs all sources at once
- **Source List**: Shows added calendars with platform badges, sync status, event count
- **Remove/Sync Buttons**: Per-source actions

#### Database Integration ✅
- Now reads/writes to `sync_settings` JSONB column (not metadata)
- Structure: `{ sources: [], auto_sync: boolean, sync_interval_hours: number, last_sync: timestamp }`
- Backward compatible - falls back to metadata.sync_settings for migration

#### Admin Panel - Manual Sync ✅
- `/admin/system` page has "iCal Синхронизация" section
- "Синхронизировать все" button triggers global sync of all listings
- Shows stats: listings synced, success count, error count, last sync time
- Frequency selector: 15m, 30m, 1h, 2h, 6h

#### API Updates ✅
- Changed from Edge Runtime to Node.js Runtime (for longer timeout)
- `POST /api/ical/sync` with action: 'sync-all' syncs all ACTIVE listings
- Updates sync_settings.last_sync on each listing
- Records global status in system_settings table

---

## Previous Stage 25.2 Changes (2026-02-28)
- Admin Moderation redesign with Photo Carousel
- Chat System activation (conversations + messages tables)
- Reject Flow with Telegram notifications
- Read Receipts (✓ / ✓✓)

---

## Working Features

### iCal Synchronization ✅
- Add multiple iCal sources per listing
- Platform auto-detection (Airbnb, Booking, VRBO, Google)
- Manual sync per listing or global sync
- Auto-sync toggle (for future background job)
- Creates BLOCKED_BY_ICAL bookings for busy dates
- Removes outdated blocks automatically

### Moderation System ✅
- Photo carousel for mobile
- Approve/Reject with feedback
- Telegram notifications
- Admin ↔ Partner messaging

### Chat System ✅
- conversations + messages tables
- Read receipts
- Admin and Partner chat UIs

### Storage & Media ✅
- Supabase Storage
- Client-side compression
- Photo limit: 30

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
├── components/
│   └── calendar-sync-manager.jsx   # REWRITTEN - New iCal UI
├── app/
│   ├── api/
│   │   └── ical/sync/route.js      # UPDATED - Node.js runtime, sync-all
│   ├── admin/
│   │   ├── system/page.js          # UPDATED - Relative API paths
│   │   ├── moderation/page.js      # Carousel + Reject flow
│   │   └── messages/page.js        # Admin chat
│   └── partner/
│       ├── listings/[id]/page.js   # Uses CalendarSyncManager
│       └── messages/[id]/page.js   # Partner chat with receipts
```

---

## Next Priority Tasks

### Upcoming (P1)
- **Background iCal Sync** — Vercel Cron or external service
- **Stripe Integration** — Payment processing
- **Resend Integration** — Email notifications

### Future/Backlog (P2+)
- TRON/USDT Verification
- Advanced Analytics
- 404/Error translations

---

## Preview URL
https://c325362c-1be1-450d-a1ad-cc1fb45ba828.preview.emergentagent.com
