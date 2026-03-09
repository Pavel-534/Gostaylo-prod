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

### Telegram Bot Integration (✅ COMPLETE)
- Lazy Realtor: Send photo + description → Create draft listing
- Account linking via `/link email@example.com`
- Status check via `/status`
- Server-side image compression with Sharp (1920px, WebP, 80% quality)
- Webhook: `/api/webhooks/telegram`

### Partner Dashboard (✅ COMPLETE - 2026-03-09)
- View all own listings including drafts
- Admin can view partner dashboard as Super-Partner
- Publish drafts to moderation
- Edit/delete listings
- API: `/api/v2/partner/listings`

### Admin Panel (✅ COMPLETE)
- User management
- Listing moderation (approve/reject)
- System settings
- Telegram webhook management

### Draft Cleanup Cron (✅ COMPLETE - 2026-03-09)
- Automatic cleanup of abandoned drafts older than 30 days
- Deletes both DB records and Storage files
- Runs daily at 03:00 UTC
- Endpoint: `/api/cron/cleanup-drafts`

## Recent Changes (2026-03-09)

### P0 - Photo Upload Fix
- Added Sharp for server-side image compression
- WebP format, 1920px max, 80% quality
- Detailed logging in webhook
- Photos now upload successfully

### P1 - Partner Dashboard for Admin
- Fixed API to use server-side Supabase client
- Admin can now see all their listings
- Drafts visible with metadata

### Session Improvements
- JWT cookie: `secure: true`, `sameSite: 'lax'`, `path: '/'`
- Login preserves current page for protected routes
- Auth context includes `canAccessPartner` flag

## Database Schema

### Key Tables
- `profiles`: User data (id, email, password_hash, role, telegram_id, is_verified)
- `listings`: Property listings (id, owner_id, status, title, images, metadata)
- `bookings`: Rental bookings
- `messages`: Internal messaging

### Missing Columns (TODO)
- `profiles.email_verified_at` - needs migration

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
- `GET /api/v2/partner/listings` - Get partner's listings

### Webhooks
- `POST /api/webhooks/telegram` - Telegram bot webhook

### Cron
- `POST /api/cron/cleanup-drafts` - Draft garbage collection

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

## Test Credentials
- **Admin:** pavel_534@mail.ru / ChangeMe2025!

## File Structure
```
/app/
├── app/
│   ├── api/
│   │   ├── v2/auth/          # Auth routes
│   │   ├── v2/partner/       # Partner routes
│   │   ├── webhooks/telegram/ # Telegram webhook
│   │   └── cron/             # Cron jobs
│   ├── partner/              # Partner dashboard
│   └── admin/                # Admin panel
├── components/
├── contexts/auth-context.jsx
├── lib/auth.js
└── memory/PRD.md
```
