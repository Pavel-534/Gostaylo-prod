# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-28 - Stage 24.4 P0 Bug Fixes Complete ✅

### Stage 24.4 Changes (2026-02-28)

#### Admin Moderation Page (P0) ✅
- Fixed crash caused by `toLocaleString` on null dates
- Added null protection for partner.name, partner.email fields
- Translated buttons: "Approve" → "Одобрить", "Reject" → "Отклонить"
- "Просмотр" button already in Russian

#### Listing Edit Page (P0) ✅
- Full Seasonal Pricing UI implemented with:
  - Name field for season
  - Start/End date pickers
  - Price multiplier input
  - Preview of calculated price
  - "Добавить" button
  - Display of existing seasons with delete option
- Seasons stored in `metadata.seasonal_pricing` array

#### iCal CalendarSyncManager (P0) ✅
- Fixed API calls from `http://localhost:3000` to relative `/api` paths
- URL input field and "+" button work correctly
- Platform auto-detection (Airbnb, Booking, VRBO, Google)

#### Photo Management (P0) ✅
- Increased limit from 10 to 30 photos on both:
  - `/partner/listings/new` (new listing)
  - `/partner/listings/[id]` (edit listing)
- Fixed progress bar formula for accurate upload progress

---

## Professional Media Pipeline ✅

### Supabase Storage
- **Bucket**: `listing-images` with public access
- **File Size Limit**: 10MB
- **Allowed Types**: image/jpeg, image/png, image/webp, image/gif
- **Max Compressed Size**: 1MB after client-side compression

### Client-Side Image Compression
- **Library**: `browser-image-compression`
- **Max Width/Height**: 1920px
- **Quality**: 80%
- **Output Format**: WebP

### Upload Flow
```
1. User selects files → 2. Validate type & size (max 10MB)
3. Compress (max 1920px, 80%, WebP) → 4. Upload to Supabase Storage
5. Save public URL to listings.images array
```

---

## Database Schema Notes
- `sync_settings` → stored in `metadata.sync_settings` (JSONB)
- `seasonal_pricing` → stored in `metadata.seasonal_pricing` (JSONB array)
- `is_draft` → stored in `metadata.is_draft` (boolean)
- Images → URL strings (not base64)

---

## Working Features

### Storage & Media
- ✅ Supabase Storage bucket (`listing-images`)
- ✅ Client-side image compression
- ✅ Progress bar during upload (fixed formula)
- ✅ Delete images from storage
- ✅ Photo limit: 30

### Partner Portal
- ✅ Create listing (3-step flow)
- ✅ Save as Draft
- ✅ Edit listing with media management
- ✅ Real file upload to cloud
- ✅ iCal sync management
- ✅ Seasonal pricing management

### Admin Panel
- ✅ Moderation (PENDING listings) - no crashes
- ✅ Approve/Reject with Russian buttons
- ✅ Featured toggle (is_featured)
- ✅ System Control Center

### Core Features
- ✅ Supabase Auth (login, signup, logout)
- ✅ Telegram Bot v4.0 (fire-and-forget)
- ✅ Multi-language (RU/EN/ZH/TH)
- ✅ iCal Sync Engine

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
- **Bot:** Telegram Bot API (Edge Runtime)
- **UI:** Tailwind CSS, Shadcn/UI
- **Image Processing:** browser-image-compression

---

## Next Priority Tasks

### Upcoming (P1)
- **Stripe Integration** — Real payment processing
- **Email Notifications** — Resend integration
- **is_featured verification** — Ensure toggle doesn't remove from queue

### Future/Backlog (P2+)
- TRON/USDT Verification
- Background iCal Sync (cron)
- Advanced Analytics
- 404/Error page translations
- Proper DB migration for sync_settings column

---

## Code Architecture
```
/app/
├── app/
│   ├── api/
│   │   ├── ical/sync/route.js        # iCal synchronization
│   │   └── webhooks/telegram/route.js # Telegram (fire-and-forget)
│   ├── admin/
│   │   ├── moderation/page.js        # ✅ Fixed P0 crash
│   │   └── system/page.js            # System controls
│   ├── partner/
│   │   ├── listings/
│   │   │   ├── new/page.js           # ✅ 30 photo limit
│   │   │   └── [id]/page.js          # ✅ Seasonal pricing UI
├── components/
│   └── calendar-sync-manager.jsx     # ✅ Fixed API paths
├── lib/
│   └── services/
│       └── image-upload.service.js   # ✅ Fixed progress formula
```

---

## Preview URL
https://c325362c-1be1-450d-a1ad-cc1fb45ba828.preview.emergentagent.com
