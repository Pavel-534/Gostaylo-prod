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
- Email verification flow
- Forgot password flow
- Role-based access control (ADMIN, PARTNER, RENTER, MODERATOR)

### Partner Application Flow (✅ COMPLETE - 2026-03-09)
- Mobile-optimized form with scroll-into-view
- Server-side API `/api/v2/partner/apply`
- Status set to PENDING_PARTNER
- Telegram notification to admin
- Redirect to success page

### Admin Partner Management (✅ COMPLETE - 2026-03-09)
- Dashboard at `/admin/partners`
- List all PENDING_PARTNER applications
- Approve → role: PARTNER, status: VERIFIED
- Reject → status: REJECTED with reason
- Email + Telegram notifications on decision

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

### 1. Soft Delete for Listings
- DELETE endpoint now sets `status: 'DELETED'` instead of physical delete
- Preserves conversation/message history (FK constraint fix)
- Listings filtered to exclude DELETED in queries

### 2. Partner Application Form Fix
- Created server-side API `/api/v2/partner/apply`
- Proper error handling and validation
- Telegram notification with full details
- Redirect to success page

### 3. Admin Partner Management UI
- New page `/admin/partners`
- List pending applications with user details
- Approve/Reject with notifications (Email + Telegram)
- Menu item added to admin sidebar

### 4. Access Control
- Partner layout checks user role
- Shows "Доступ ограничен" for non-partners
- Links to become a partner

## API Endpoints

### Auth
- `POST /api/v2/auth/login`
- `POST /api/v2/auth/register`
- `GET /api/v2/auth/verify`
- `GET /api/v2/auth/me`
- `POST /api/v2/auth/logout`

### Partner
- `POST /api/v2/partner/apply` - Submit partner application
- `GET /api/v2/partner/listings` - Get all listings (excludes DELETED)
- `GET/PATCH/DELETE /api/v2/partner/listings/[id]` - Single listing CRUD (DELETE = soft delete)

### Admin
- `GET/POST /api/v2/admin/partners` - List/approve/reject partner applications
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

## Status Values

### User verification_status
- `null/RENTER` - Regular user
- `PENDING_PARTNER` - Applied for partnership
- `VERIFIED` - Approved partner
- `REJECTED` - Application rejected

### Listing status
- `INACTIVE` - Draft (is_draft: true)
- `PENDING` - Awaiting moderation
- `ACTIVE` - Published
- `DELETED` - Soft deleted

## Upcoming Tasks

### P1 - Complete Workflows
- [ ] Renter booking flow (browse → book → pay)
- [ ] Partner booking management
- [ ] Messaging between renter/partner

### P2 - Payments
- [ ] Stripe integration
- [ ] MIR card support
- [ ] Full TRON verification

### Future
- [ ] Partner analytics dashboard
- [ ] Mobile app (React Native)

## Test Credentials
- **Admin:** pavel_534@mail.ru / ChangeMe2025!
