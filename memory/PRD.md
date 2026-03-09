# Gostaylo - Product Requirements Document

## Overview
Gostaylo is a rental marketplace platform for properties in Thailand (Phuket). It allows partners to list properties and renters to book them.

**Production URL:** https://www.gostaylo.com

## Tech Stack
- **Frontend:** Next.js 14 (App Router)
- **Backend:** Next.js API Routes + Supabase
- **Database:** PostgreSQL via Supabase
- **Storage:** Supabase Storage
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

### Partner Application Flow (✅ COMPLETE & MIGRATED - 2026-03-09)
- **NEW:** Uses dedicated `partner_applications` table (migrated from JSON in profiles)
- Mobile-optimized form with scroll-into-view
- Server-side API `/api/v2/partner/apply`
- Application status check via `/api/v2/partner/application-status`
- Telegram notification to admin
- Redirect to success page
- Supports resubmission after rejection

### Admin Partner Management (✅ COMPLETE - 2026-03-09)
- Dashboard at `/admin/partners`
- Lists applications from `partner_applications` table
- Approve → role: PARTNER, app status: APPROVED
- Reject → app status: REJECTED with reason
- Email + Telegram notifications on decision
- Tracks reviewer ID and timestamp

### Listing Management (✅ COMPLETE)
- Create via Telegram bot with photo compression
- Edit/publish drafts in Partner Dashboard
- **Soft Delete** (status: 'DELETED') to preserve message history
- Listings filtered to exclude DELETED status

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
| status | TEXT | PENDING/APPROVED/REJECTED |
| rejection_reason | TEXT | Reason if rejected |
| reviewed_by | TEXT | Admin who reviewed |
| reviewed_at | TIMESTAMPTZ | Review timestamp |
| created_at | TIMESTAMPTZ | Application submission time |

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
- `DELETED` - Soft deleted

## Upcoming Tasks

### P0 - Immediate (System Stability)
- [x] Partner application flow migrated to dedicated table ✅
- [x] email_verified_at field enabled ✅
- [ ] Clean up old rejection_reason JSON workaround in profiles table (optional, low priority)

### P1 - Complete Core Workflows
- [ ] Renter booking flow (browse → book → pay)
- [ ] Partner booking management
- [ ] Messaging between renter/partner
- [ ] Calendar availability system

### P2 - Payments
- [ ] Stripe integration
- [ ] MIR card support
- [ ] Full TRON TXID verification (amount + recipient check)

### Future
- [ ] Partner analytics dashboard
- [ ] Mobile app (React Native)

## Test Credentials
- **Admin:** pavel_534@mail.ru / ChangeMe2025!

## Test Reports
- `/app/test_reports/iteration_1.json` - Partner application flow tests (13/13 passed)
