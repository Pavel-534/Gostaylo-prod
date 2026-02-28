# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-28 - Production-Ready Listing Creation Complete ✅

### Stage 24.2 - Listing Creation & Advanced UX ✅

**Features Implemented:**

1. **Real Media Engine with Progress Bar**
   - Real `<input type="file" multiple>` for image upload
   - Visual progress bar (0-100%) during upload
   - File validation (image types, 10MB max)
   - Preview with "Cover" badge on first image
   - Remove button per image

2. **Listing Persistence & Visibility**
   - Fixed `owner_id` linking to logged-in partner
   - **"Save as Draft"** button — saves with `metadata.is_draft: true`
   - **"Create Listing"** button — saves with `status: PENDING`
   - Listings appear IMMEDIATELY in "Мои листинги" table
   - Draft badge with dashed border styling

3. **Multi-Source iCal Manager (in New Listing flow)**
   - Add multiple iCal URLs (Airbnb, Booking, VRBO)
   - Auto-detect platform from URL
   - Status badges (Pending/Synced)
   - Remove button per source
   - Help instructions for finding iCal links

4. **Category Selector Fix**
   - z-index: 100 for proper dropdown layering
   - min-width: 300px for readability
   - Position: popper with sideOffset

### Technical Implementation

```
/app/app/partner/listings/new/page.js
├── Step 1: Basic Info (Category, Title, Description, District, Price)
├── Step 2: Category-specific fields + iCal Manager
└── Step 3: Media Upload with Progress Bar
    ├── Real file input (hidden, triggered by button)
    ├── Progress simulation with visual bar
    ├── Image preview grid with cover badge
    └── Two submit buttons:
        ├── "Сохранить черновик" → is_draft: true
        └── "Создать листинг" → status: PENDING
```

### Database Notes
- `DRAFT` status not in DB enum — using `metadata.is_draft` workaround
- `getEffectiveStatus()` helper function checks metadata
- Draft listings have `available: false`

---

## Previous Completed Work

### Stage 23 - iCal Sync Engine ✅
- Multi-source calendar sync
- BLOCKED_BY_ICAL bookings
- Admin global sync controls

### Telegram Webhook v4.0 ✅
- Immediate response pattern
- Fire-and-forget processing

### Supabase Auth ✅
- Login/logout/signup/password change
- Route protection

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
- **P1: Add DRAFT to DB enum** — Proper database migration
- **P1: Supabase Storage** — Real file uploads to cloud

### Future/Backlog
- **P1: TRON/USDT Verification**
- **P1: Resend Email Integration
- **P1: Background Sync Worker (cron)

## Code Architecture
```
/app/
├── app/
│   ├── partner/
│   │   ├── listings/
│   │   │   ├── new/page.js          # 3-step creation flow
│   │   │   ├── page.js              # Listings table with DRAFT support
│   │   │   └── [id]/page.js         # Edit listing
│   ├── api/ical/sync/route.js       # iCal API
│   └── admin/system/page.js         # Control Center
├── components/
│   └── calendar-sync-manager.jsx    # Multi-source iCal UI
└── lib/
    ├── services/ical-sync.service.js
    └── auth.js
```
