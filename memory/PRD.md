# Gostaylo - Product Requirements Document

## Overview
Gostaylo is a rental marketplace platform for properties in Thailand (Phuket). It allows partners to list properties and renters to book them.

**Production URL:** https://www.gostaylo.com

## Tech Stack
- **Frontend:** Next.js 14 (App Router)
- **Backend:** Next.js API Routes + Supabase
- **Database:** PostgreSQL via Supabase
- **Storage:** Supabase Storage (buckets: listings, verification_documents)
- **Auth:** Custom JWT-based (HttpOnly cookies) + bcrypt
- **Email:** Resend
- **Notifications:** Telegram Bot
- **Payments:** TRON (crypto), Stripe (planned)

## Core Features

### Authentication (✅ COMPLETE)
- JWT-based custom auth with HttpOnly cookies
- Password hashing with bcrypt
- Email verification flow with `email_verified_at` timestamp
- Forgot password flow
- Role-based access control (ADMIN, PARTNER, RENTER, MODERATOR)

### Partner Application Flow (✅ COMPLETE & ENHANCED - 2026-03-09)
- **NEW:** Uses dedicated `partner_applications` table (migrated from JSON in profiles)
- **NEW:** KYC Document upload (ID/Passport) to Supabase Storage
- Mobile-optimized form with scroll-into-view
- Server-side API `/api/v2/partner/apply`
- Application status check via `/api/v2/partner/application-status`
- Document upload via `/api/v2/upload`
- Telegram notification to admin
- Redirect to success page
- Supports resubmission after rejection

### Admin Partner Management (✅ COMPLETE - 2026-03-09)
- Dashboard at `/admin/partners`
- Detail page `/admin/partners/[id]` with KYC document preview
- Lists applications from `partner_applications` table
- Approve → role: PARTNER, app status: APPROVED
- Reject → app status: REJECTED with reason
- Email + Telegram notifications on decision
- Tracks reviewer ID and timestamp

### Calendar & Availability (✅ COMPLETE & POLISHED - 2026-03-09)
- **Manual Blocking:** Partners can block dates via `/api/v2/partner/listings/[id]/calendar`
- **iCal Import:** Sync from Airbnb/Booking.com calendars
- **iCal Export:** Generate unique feed for each listing `/api/v2/listings/[id]/ical`
- **Availability Check:** `/api/v2/listings/[id]/availability` checks both manual blocks + iCal blocks
- **Admin Dashboard:** `/admin/system/ical` with:
  - Stats cards (Total/Success/Errors for last 24h)
  - Sync All button with auto-refresh
  - Last sync result display
  - Link to detailed logs page
- **Detailed Logs Page:** `/admin/system/ical/logs` with:
  - Table: Timestamp, Listing Name, Status, Events, Error
  - Errors-only filter
  - CSV export
  - Search by listing/URL/error
- **Telegram Alert:** Auto-sends alert to admin if >5 sync errors
- **Cron Job:** `/api/cron/ical-sync` with timeout safety (55s max)

### Listing Management (✅ COMPLETE)
- Create via Telegram bot with photo compression
- Edit/publish drafts in Partner Dashboard
- **Soft Delete** (status: 'DELETED') to preserve message history
- Listings filtered to exclude DELETED status
- **Availability Calendar** component for manual date blocking

### Access Control (✅ COMPLETE - 2026-03-09)
- Partner pages restricted to PARTNER/ADMIN/MODERATOR roles
- Access denied page with "Стать партнёром" CTA
- Only verified partners can add listings

## Recent Changes (2026-03-09)

### 1. Partner Applications Migration to Dedicated Table
- **NEW TABLE:** `partner_applications` with columns: id, user_id, phone, social_link, experience, portfolio, status, rejection_reason, reviewed_by, reviewed_at
- **Status values:** PENDING, APPROVED, REJECTED
- **Benefits:** Clean data model, audit trail, easier querying
- All APIs migrated: `/api/v2/partner/apply`, `/api/v2/admin/partners`, `/api/v2/partner/application-status`
- **Testing:** 100% pass rate (13/13 backend tests)

### 2. Email Verification Timestamp
- Added `email_verified_at` field to profiles table
- Set automatically when user verifies email via `/api/v2/auth/verify`
- Returned in `/api/v2/auth/me` response

### 3. Soft Delete for Listings
- DELETE endpoint now sets `status: 'DELETED'` instead of physical delete
- Preserves conversation/message history (FK constraint fix)
- Listings filtered to exclude DELETED in queries

### 4. Partner Application Form Fix
- Created server-side API `/api/v2/partner/apply`
- Proper error handling and validation
- Telegram notification with full details
- Redirect to success page

### 5. Admin Partner Management UI
- New page `/admin/partners`
- List pending applications with user details
- Approve/Reject with notifications (Email + Telegram)
- Menu item added to admin sidebar

### 6. Access Control
- Partner layout checks user role
- Shows "Доступ ограничен" for non-partners
- Links to become a partner

## API Endpoints

### Auth
- `POST /api/v2/auth/login`
- `POST /api/v2/auth/register`
- `GET /api/v2/auth/verify` - Sets `email_verified_at` timestamp
- `GET /api/v2/auth/me` - Returns user with `email_verified_at`
- `POST /api/v2/auth/logout`

### Partner
- `POST /api/v2/partner/apply` - Submit partner application (→ partner_applications table)
- `GET /api/v2/partner/application-status` - Check application status
- `GET /api/v2/partner/listings` - Get all listings (excludes DELETED)
- `GET/PATCH/DELETE /api/v2/partner/listings/[id]` - Single listing CRUD (DELETE = soft delete)

### Admin
- `GET /api/v2/admin/partners` - List pending applications (from partner_applications)
- `POST /api/v2/admin/partners` - Approve/reject applications {action, userId, reason}
- `GET/POST /api/v2/admin/telegram` - Telegram management

### Webhooks
- `GET/POST /api/webhooks/telegram` - Bot webhook v7.0

### Cron
- `GET/POST /api/cron/cleanup-drafts` - Draft garbage collection

## Pages

### Partner Pages (Protected)
- `/partner/dashboard` - Overview
- `/partner/listings` - Manage listings
- `/partner/listings/[id]` - Edit listing
- `/partner/bookings` - Manage bookings

### Admin Pages (Protected)
- `/admin/dashboard` - Overview
- `/admin/partners` - Partner applications
- `/admin/moderation` - Listing moderation
- `/admin/users` - User management

### Public Pages
- `/` - Homepage
- `/listings` - Browse listings
- `/profile` - User profile + partner application
- `/partner-application-success` - Application submitted

## User Roles

| Role | Access |
|------|--------|
| RENTER | Browse, book, profile |
| PARTNER | + Partner dashboard, listings |
| MODERATOR | + Moderation, categories |
| ADMIN | Full access |

## Database Tables

### partner_applications (NEW - 2026-03-09)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | TEXT | FK to profiles.id |
| phone | TEXT | Contact phone |
| social_link | TEXT | Telegram/WhatsApp |
| experience | TEXT | Rental experience description |
| portfolio | TEXT | Link to Airbnb/Booking profile |
| verification_doc_url | TEXT | URL to KYC document in Storage |
| status | TEXT | PENDING/APPROVED/REJECTED |
| rejection_reason | TEXT | Reason if rejected |
| reviewed_by | TEXT | Admin who reviewed |
| reviewed_at | TIMESTAMPTZ | Review timestamp |
| created_at | TIMESTAMPTZ | Application submission time |

### calendar_blocks (NEW - 2026-03-09)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| listing_id | TEXT | FK to listings.id |
| start_date | DATE | Block start |
| end_date | DATE | Block end |
| reason | TEXT | Block reason |
| source | TEXT | 'manual' or iCal URL |
| created_at | TIMESTAMPTZ | When created |

### ical_sync_logs (NEW - 2026-03-09)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| listing_id | TEXT | FK to listings.id |
| source_url | TEXT | iCal source URL |
| status | TEXT | 'success' or 'error' |
| events_count | INT | Number of events synced |
| error_message | TEXT | Error details if failed |
| synced_at | TIMESTAMPTZ | Sync timestamp |

## Status Values

### Partner Application Status (partner_applications.status)
- `PENDING` - Awaiting admin review
- `APPROVED` - User is now a partner
- `REJECTED` - Application rejected (can resubmit)

### User verification_status (profiles.verification_status)
- `PENDING` - Email verification pending
- `VERIFIED` - Email verified

### Listing status
- `INACTIVE` - Draft (is_draft: true)
- `PENDING` - Awaiting moderation
- `ACTIVE` - Published
- `REJECTED` - Rejected by moderator

## Upcoming Tasks

### P0 - Immediate (System Stability)
- [x] Partner application flow migrated to dedicated table ✅
- [x] email_verified_at field enabled ✅
- [x] Calendar & Availability system ✅
- [x] KYC document upload ✅
- [x] iCal sync with logging ✅
- [x] Availability check API ✅
- [x] Telegram bot owner_id fix ✅ (2026-03-10)
- [x] Access Denied page UX improvement ✅ (2026-03-10)

### P1 - Complete Core Workflows
- [ ] Renter booking flow (browse → book → pay)
- [ ] Partner booking management (accept/decline requests)
- [ ] Messaging between renter/partner
- [ ] Booking confirmation emails

### P2 - Payments
- [ ] Stripe integration
- [ ] MIR card support
- [ ] Full TRON TXID verification (amount + recipient check)

### Future
- [ ] Partner analytics dashboard
- [ ] Mobile app (React Native)

## Recent Changes (2026-03-10)

### 1. Telegram Bot - Owner ID Fix
- **Issue:** Bot was assigning incorrect `owner_id` to listings created from photos
- **Root Cause:** Not a bug - the bot code was correct. The test user had role `RENTER` instead of `PARTNER`
- **Verification:** Created test listing with correct UUID (`user-mmj8cn2l-qb8`) via Telegram bot
- **Files:** `/app/app/api/webhooks/telegram/route.js` - added detailed logging for debugging

### 2. Access Denied Page Improvements
- Added "Login" button with icon for unauthenticated users
- Different messaging: "Требуется авторизация" vs "Доступ ограничен"
- Implemented redirect flow: saves URL to sessionStorage → redirects to `/profile?login=true` → opens login modal → redirects back after login
- **Files:** `/app/app/partner/layout.js`, `/app/contexts/auth-context.jsx`, `/app/app/profile/page.js`

### 3. Partner Listings API Fix
- Fixed `neq('status', 'DELETED')` query error (DELETED not in enum)
- Changed to `in('status', ['ACTIVE', 'INACTIVE', 'PENDING', 'REJECTED'])`
- **File:** `/app/app/api/v2/partner/listings/route.js`

### 4. Profile Page Suspense Fix (2026-03-10)
- Added Suspense wrapper for `useSearchParams()` to fix Vercel prerendering error
- Renamed main component to `ProfileContent`, wrapped in `<Suspense>` with loading fallback
- **File:** `/app/app/profile/page.js`

### 5. Settings Page Cleanup (2026-03-10)
- Removed redundant Telegram linking blocks (mock code)
- Settings page now loads real user data from localStorage
- Telegram status syncs with profile connection state
- Simplified notification toggles
- **File:** `/app/app/partner/settings/page.js`

### 6. Navigation Overhaul (2026-03-10)
- **Header**: Clean & minimal - Logo, Language, Currency, Avatar/Login
- **User Dropdown**: Profile, My Bookings, Favorites, Partner Dashboard, Logout
- **Mobile Bottom Nav**: Home, Search, Messages, Profile with active states
- **Partner Sidebar**: Professional sidebar with collapsible drawer on mobile
- **Breadcrumbs**: Desktop & mobile navigation trail
- **Languages**: RU, EN, ZH, TH
- Removed all "Hosting/Traveling" toggles from Profile
- **Files:** `/app/components/universal-header.jsx`, `/app/components/mobile-bottom-nav.jsx`, `/app/app/partner/layout.js`, `/app/components/main-content.jsx`

### 7. Stabilization Fixes (2026-03-10)
- Fixed Profile page crash on Bottom Nav click (null checks for openLoginModal, searchParams)
- Fixed Header mobile layout (reduced gaps from gap-4 to gap-1, smaller elements)
- Added Chinese (🇨🇳 ZH) to language selector
- Fixed active states highlighting in Bottom Nav

## RLS Policy Notes
- RLS policies are defined in `/app/database/rls_policies.sql`
- **Important:** RLS uses `auth.uid()` from Supabase Auth, but app uses custom JWT auth
- Backend APIs use `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS
- Authorization is handled at API level via `owner_id` filtering

## Test Credentials
- **Admin:** pavel_534@mail.ru / ChangeMe2025!
- **Partner (Test):** kyc_test_user@test.com / ChangeMe2025! (telegram_id: 888777666)

## Test Reports
- `/app/test_reports/iteration_1.json` - Partner application flow tests (13/13 passed)
