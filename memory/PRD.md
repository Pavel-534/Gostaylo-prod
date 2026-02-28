# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-28 - Database Migration & UX Refactoring Complete ✅

### Critical Fixes Applied

#### 1. Database Fix (P0) ✅
- **Problem**: `sync_settings` column didn't exist in `listings` table
- **Solution**: Store sync_settings inside `metadata` JSONB field
- All services updated: iCal API, Calendar Sync Manager, New Listing form
- Verified: Listings create successfully with metadata.sync_settings

#### 2. Moderation Sync (P0) ✅
- Admin Moderation panel now shows ALL PENDING listings
- Direct Supabase queries (bypasses K8s ingress issues)
- Approve/Reject functions work correctly
- Featured toggle integrated

#### 3. Partner Edit Interface Overhaul (P1) ✅
- **Mobile-First Design** with sticky header
- **Media Management**: 
  - Real file upload with progress bar
  - "Set as Cover" button per image
  - "Delete" button per image  
  - Cover badge on selected image
- **iCal Manager**: Clear input + "+" button, platform dropdown
- **Seasonal Pricing**: Placeholder ready for implementation

#### 4. Listing Creation Final Flow (P0) ✅
- Success redirect only after confirmed DB insert
- Real file selection with Progress Bar
- "Save as Draft" creates with metadata.is_draft: true

### Data Schema (Updated)
```javascript
// listings.metadata structure
{
  "is_draft": boolean,           // True = Draft status
  "created_via": string,         // "partner_dashboard" | "telegram"
  "sync_settings": [             // Moved from separate column
    {
      "id": string,
      "url": string,
      "source": "Airbnb" | "Booking.com" | "VRBO" | "Google",
      "enabled": boolean
    }
  ]
}
```

---

## Working Features Summary

### Partner Portal
- ✅ Create listing (3-step flow with progress)
- ✅ Save as Draft
- ✅ Edit listing (Media + iCal + Basic info)
- ✅ View listings with DRAFT/PENDING/ACTIVE badges
- ✅ Real file upload with visual progress

### Admin Panel  
- ✅ Moderation panel (PENDING listings)
- ✅ Approve/Reject listings
- ✅ Featured toggle
- ✅ System Control Center
- ✅ iCal Global Sync controls

### Core Features
- ✅ Supabase Auth (Login/Logout/SignUp)
- ✅ Route protection
- ✅ Telegram Bot v4.0
- ✅ Multi-language (RU/EN/ZH/TH)

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
- **P1: Supabase Storage** — Real cloud file uploads
- **P2: Seasonal Pricing UI** — Calendar-based price management

### Future/Backlog
- TRON/USDT Verification
- Resend Email Integration
- Background Sync Worker (cron)

## Code Architecture
```
/app/
├── app/
│   ├── partner/
│   │   ├── listings/
│   │   │   ├── new/page.js       # 3-step creation
│   │   │   ├── [id]/page.js      # Edit with media controls
│   │   │   └── page.js           # List with DRAFT support
│   ├── admin/
│   │   ├── moderation/page.js    # PENDING listings
│   │   └── system/page.js        # Control center
│   └── api/ical/sync/route.js    # Uses metadata.sync_settings
├── components/
│   └── calendar-sync-manager.jsx # Multi-source iCal
└── lib/
    └── auth.js                   # Supabase Auth
```
