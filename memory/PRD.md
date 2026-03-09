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
- JWT-based custom auth with HttpOnly cookies (30-day expiry)
- Password hashing with bcrypt (auto-upgrade from plain text)
- Email verification flow via Resend
- Forgot password flow
- Role-based access control (ADMIN, PARTNER, RENTER, MODERATOR)
- Session persistence across routes

### Telegram Bot Integration (✅ COMPLETE)
- Lazy Realtor: Send photo + description → Create draft listing
- Account linking via `/link email@example.com`
- Status check via `/status`
- Server-side image compression with Sharp (1920px, WebP, 80% quality)
- Webhook: `/api/webhooks/telegram` v7.0

### Partner Dashboard (✅ COMPLETE - 2026-03-09)
- View all own listings including drafts
- Admin can view partner dashboard as Super-Partner
- Edit drafts with full form (title, description, price, district, photos)
- Publish drafts to moderation (changes status to PENDING)
- Delete listings (removes DB record + Storage images)
- Mobile-optimized UI
- API: `/api/v2/partner/listings` and `/api/v2/partner/listings/[id]`

### Draft Editing (✅ COMPLETE - 2026-03-09)
- Dedicated edit page `/partner/listings/[id]`
- Loads drafts with INACTIVE status + is_draft metadata
- Photo upload with compression
- Seasonal pricing configuration
- "Publish" button sends to moderation with Telegram notification
- Mobile-responsive with fixed footer buttons

### Admin Panel (✅ COMPLETE)
- User management
- Listing moderation (approve/reject)
- System settings
- Telegram webhook management
- Moderation notifications via Telegram

### Draft Cleanup Cron (✅ COMPLETE - 2026-03-09)
- Automatic cleanup of abandoned drafts older than 30 days
- Deletes both DB records and Storage files
- Runs daily at 03:00 UTC
- Endpoint: `/api/cron/cleanup-drafts`

## Recent Changes (2026-03-09)

### Session 1 - Photo Upload Fix
- Added Sharp for server-side image compression
- WebP format, 1920px max, 80% quality
- Photos now upload successfully via Telegram

### Session 2 - Draft Editing & UI Fixes
- Created `/api/v2/partner/listings/[id]` API (GET/PATCH/DELETE)
- Fixed edit page to use server-side API (bypasses RLS)
- Added authentication check with login prompt
- Publish button now properly updates status to PENDING
- Delete function uses server API with storage cleanup
- Mobile UI optimized - all buttons visible

## API Endpoints

### Auth
- `POST /api/v2/auth/login` - Login
- `POST /api/v2/auth/register` - Register
- `GET /api/v2/auth/verify` - Verify email
- `GET /api/v2/auth/me` - Current user
- `POST /api/v2/auth/logout` - Logout
- `POST /api/v2/auth/forgot-password` - Forgot password
- `POST /api/v2/auth/reset-password` - Reset password

### Partner
- `GET /api/v2/partner/listings` - Get all partner's listings
- `GET /api/v2/partner/listings/[id]` - Get single listing
- `PATCH /api/v2/partner/listings/[id]` - Update listing
- `DELETE /api/v2/partner/listings/[id]` - Delete listing + images

### Admin
- `GET/POST /api/v2/admin/telegram` - Telegram management
  - Actions: setWebhook, deleteWebhook, testMessage, send_moderation_notification

### Webhooks
- `GET/POST /api/webhooks/telegram` - Telegram bot webhook v7.0

### Cron
- `GET/POST /api/cron/cleanup-drafts` - Draft garbage collection

## Upcoming Tasks

### P1 - Payments
- [ ] Stripe integration
- [ ] MIR card support
- [ ] Full TRON TXID verification

### P2 - Database
- [ ] Add `email_verified_at` column migration
- [ ] Fix `exchange_rates` enum to TEXT

### Future
- [ ] Partner analytics dashboard
- [ ] Mobile app (React Native)
- [ ] View as User (Admin impersonation)

## Test Credentials
- **Admin:** pavel_534@mail.ru / ChangeMe2025!
