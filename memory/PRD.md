# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-28 - Supabase Storage & Image Compression Complete ✅

### Professional Media Pipeline (P0) ✅

#### Supabase Storage
- **Bucket Created**: `listing-images` with public access
- **File Size Limit**: 10MB
- **Allowed Types**: image/jpeg, image/png, image/webp, image/gif
- **Public URL Format**: `https://vtzzcdsjwudkaloxhvnw.supabase.co/storage/v1/object/public/listing-images/{path}`

#### Client-Side Image Compression
- **Library**: `browser-image-compression`
- **Max Width/Height**: 1920px
- **Quality**: 80%
- **Output Format**: WebP (for better compression)
- **Max Compressed Size**: 1MB

#### Upload Service (`/app/lib/services/image-upload.service.js`)
```javascript
// Features:
- compressImage(file, onProgress)     // Client-side compression
- uploadToStorage(file, listingId)    // Supabase Storage upload
- deleteFromStorage(fileUrl)          // Delete from storage
- processAndUploadImages(files, id)   // Full pipeline with progress
```

#### Upload Flow
```
1. User selects files
2. Validate type & size (max 10MB)
3. Compress (max 1920px, 80% quality, WebP)
4. Upload to Supabase Storage
5. Save public URL to listings.images array
```

### Database Schema Notes
- `sync_settings` stored in `metadata.sync_settings` (JSONB)
- Images stored as URL strings (not base64/data URLs)
- Draft status tracked via `metadata.is_draft`

---

## Working Features Summary

### Storage & Media
- ✅ Supabase Storage bucket (`listing-images`)
- ✅ Client-side image compression
- ✅ Progress bar during upload
- ✅ Delete images from storage

### Partner Portal
- ✅ Create listing (3-step flow)
- ✅ Save as Draft
- ✅ Edit listing with media management
- ✅ Real file upload to cloud

### Admin Panel
- ✅ Moderation (PENDING listings)
- ✅ Approve/Reject
- ✅ Featured toggle
- ✅ System Control Center

### Core Features
- ✅ Supabase Auth
- ✅ Telegram Bot v4.0
- ✅ Multi-language (RU/EN/ZH/TH)
- ✅ iCal Sync Engine

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@funnyrent.com | ChangeMe2025! |
| Partner | partner@test.com | ChangeMe2025! |

## Tech Stack
- **Framework:** Next.js 14.2.3 (App Router)
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage
- **Auth:** Supabase Auth
- **Bot:** Telegram Bot API (Edge Runtime)
- **UI:** Tailwind CSS, Shadcn/UI
- **Image Processing:** browser-image-compression

## Next Priority Tasks
### Upcoming
- **P1: Stripe Integration** — Payment processing
- **P1: Seasonal Pricing Calendar** — Price per date range
- **P2: Email Notifications** — Resend integration

### Future/Backlog
- TRON/USDT Verification
- Background iCal Sync (cron)
- Advanced Analytics

## Code Architecture
```
/app/
├── app/
│   ├── partner/
│   │   ├── listings/
│   │   │   ├── new/page.js           # 3-step creation + storage upload
│   │   │   ├── [id]/page.js          # Edit + media management
│   │   │   └── page.js               # List with DRAFT support
│   ├── admin/
│   │   ├── moderation/page.js        # PENDING listings
│   │   └── system/page.js            # Control center + iCal sync
│   └── api/
│       └── ical/sync/route.js        # iCal API
├── components/
│   └── calendar-sync-manager.jsx     # Multi-source iCal
├── lib/
│   ├── services/
│   │   ├── image-upload.service.js   # NEW: Compression + Storage
│   │   └── ical-sync.service.js      # iCal parsing
│   └── auth.js                       # Supabase Auth
└── package.json                      # + browser-image-compression
```
