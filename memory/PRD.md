# FunnyRent 2.1 - Product Requirements Document

## Project Overview
**Name:** FunnyRent 2.1 - Phuket Super-App for Rentals
**Super Admin:** Pavel B. (admin-777)
**Stack:** Next.js 14, Tailwind CSS, Lucide Icons, Supabase PostgreSQL

## Current Status: Stage 16.3 Complete ✅

### What Was Completed (Feb 26, 2025) - Latest

#### Telegram Topic Routing LIVE 🚀
- ✅ Created 3 Forum Topics in FunnyRent HQ group:
  - 🏠 **Bookings** (thread_id: 15)
  - 💰 **Finance** (thread_id: 16)
  - 🤝 **Partners** (thread_id: 17)
- ✅ All alerts now route to their respective topics (NOT General)
- ✅ Updated `notification.service.js` with `sendToAdminTopic()` function
- ✅ Test alerts sent and verified in each topic

#### MODERATOR Role Implemented
- ✅ Created via `last_name` marker `[MODERATOR]` (DB enum couldn't be altered)
- ✅ Login API returns `role: "MODERATOR"` and `isModerator: true`
- ✅ Admin layout filters menu based on role:
  - **ADMIN**: Full access (all 9 menu items)
  - **MODERATOR**: Limited access (Dashboard, Moderation, Categories, Test DB only)
  - NO access to: Finances, Users, Marketing, Security, Settings

#### Demo Accounts Created
| Email | Role | Name |
|-------|------|------|
| admin@funnyrent.com | ADMIN | Pavel B. (Super Admin) |
| assistant@test.com | MODERATOR | Anna Assistant |
| partner@funnyrent.com | PARTNER | Ivan Partnerov |
| partner@test.com | PARTNER | Test Partner |
| client@test.com | RENTER | John Client |

### Previous Updates (Stage 16.2)
- ✅ Telegram Command Center with 3 test buttons
- ✅ Partner "Connect Telegram" button

### Database Status (Supabase)
- ✅ 16 tables created with TEXT IDs
- ✅ 2 users (admin-777, partner-1)
- ✅ 4 categories (Property, Vehicles, Tours, Yachts)
- ✅ 4 exchange rates (THB, RUB, USD, USDT)
- ✅ 2 promo codes (SAVE100, WELCOME10)
- ✅ 1 active listing (Luxury Villa Ocean View)
- ✅ 3 system settings

### v2 API Endpoints (Service-Oriented Architecture)
| Endpoint | Status |
|----------|--------|
| /api/v2/categories | ✅ Working |
| /api/v2/listings | ✅ Working |
| /api/v2/listings/[id] | ✅ Working |
| /api/v2/bookings | ✅ Working |
| /api/v2/bookings/[id] | ✅ Working |
| /api/v2/auth/login | ✅ Working |
| /api/v2/auth/register | ✅ Working |
| /api/v2/admin/stats | ✅ Working |
| /api/v2/partner/stats | ✅ Working |
| /api/v2/partner/listings | ✅ Working |
| /api/v2/partner/payouts | ✅ Working |
| /api/v2/promo-codes/validate | ✅ Working |
| /api/v2/districts | ✅ Working |
| /api/v2/exchange-rates | ✅ Working |
| /api/v2/profile | ✅ Working |

### Service Layer (/app/lib/services/)
- ✅ pricing.service.js - Seasonal pricing, commission, promo codes
- ✅ booking.service.js - Availability, booking creation, status
- ✅ notification.service.js - Telegram, Email dispatcher
- ✅ payment.service.js - Escrow, crypto, payouts

### Frontend Updates
- ✅ Homepage uses direct Supabase client (bypasses k8s routing)
- ✅ /admin/test-db uses direct Supabase client  
- ✅ Admin layout responsive with hamburger menu
- ✅ All admin pages mobile-optimized

## Environment Variables Needed
```
RESEND_API_KEY=         # For real email notifications
TELEGRAM_BOT_TOKEN=     # For real Telegram bot
```

## P0/P1/P2 Features Remaining

### P0 (Critical)
- [ ] Get Resend API key from user
- [ ] Get Telegram Bot Token from user
- [ ] Update Partner dashboard to v2 APIs
- [ ] Update Checkout flow to v2 APIs

### P1 (Important)
- [ ] Deprecate old [[...path]]/route.js
- [ ] Stripe payment integration
- [ ] Real password hashing (bcrypt)
- [ ] Row Level Security (RLS)

### P2 (Nice to Have)
- [ ] iCal calendar sync
- [ ] Google OAuth
- [ ] Mobile app (React Native)

---
*Last Updated: 2026-02-26 - Stage 15.3*
