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

### Partner Dashboard (✅ COMPLETE)
- View all own listings including drafts
- Admin can view partner dashboard as Super-Partner
- Edit drafts with full form
- Publish drafts to moderation
- Delete listings with storage cleanup
- Mobile-optimized UI

### Partner Application Form (✅ COMPLETE - 2026-03-09)
- Mobile keyboard handling with scroll-into-view
- Portfolio field: optional, auto-prepends https://
- Loading spinner on submit button
- Redirect to success page after submission
- Telegram notification with full details
- Profile status set to PENDING_PARTNER

### Draft Cleanup Cron (✅ COMPLETE)
- Automatic cleanup of abandoned drafts older than 30 days
- Deletes both DB records and Storage files
- Runs daily at 03:00 UTC

## Recent Changes (2026-03-09)

### Partner Application Form UX Improvements
- Fixed mobile keyboard covering submit button (scroll-into-view)
- Portfolio field now accepts any text, auto-prepends https://
- Added loading spinner on submit
- Created `/partner-application-success` page with clear messaging
- Added `send_partner_application` action to Telegram admin API
- Profile status set to `verification_status: 'PENDING_PARTNER'`

## API Endpoints

### Auth
- `POST /api/v2/auth/login` - Login
- `POST /api/v2/auth/register` - Register
- `GET /api/v2/auth/verify` - Verify email
- `GET /api/v2/auth/me` - Current user
- `POST /api/v2/auth/logout` - Logout

### Partner
- `GET /api/v2/partner/listings` - Get all partner's listings
- `GET/PATCH/DELETE /api/v2/partner/listings/[id]` - Single listing CRUD

### Admin
- `GET/POST /api/v2/admin/telegram` - Telegram management
  - Actions: setWebhook, deleteWebhook, testMessage, send_moderation_notification, send_partner_application

### Webhooks
- `GET/POST /api/webhooks/telegram` - Telegram bot webhook v7.0

### Cron
- `GET/POST /api/cron/cleanup-drafts` - Draft garbage collection

## Upcoming Tasks

### P1 - Payments
- [ ] Stripe integration
- [ ] MIR card support
- [ ] Full TRON TXID verification

### P2 - Admin
- [ ] Partner application approval UI in admin panel
- [ ] Add `email_verified_at` column migration

### Future
- [ ] Partner analytics dashboard
- [ ] Mobile app (React Native)

## Test Credentials
- **Admin:** pavel_534@mail.ru / ChangeMe2025!

## New Pages
- `/partner-application-success` - Success page after partner application submission
