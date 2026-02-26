# FunnyRent 2.1 - Product Requirements Document

## Project Overview
**Name:** FunnyRent 2.1 - Phuket Super-App for Rentals
**Super Admin:** Pavel B. (admin-777)
**Stack:** Next.js 14, Tailwind CSS, Lucide Icons, Supabase PostgreSQL

## Current Status: Stage 16.2 Complete ✅

### What Was Completed (Feb 26, 2025) - Latest

#### Telegram Integration LIVE 🚀
- ✅ Bot configured: @FunnyRent_777_bot
- ✅ Admin Group: FunnyRent HQ (ID: -1003832026983)
- ✅ Created `/lib/telegram.js` with full Telegram Bot API integration
- ✅ Created `/api/v2/telegram/test` for test alerts
- ✅ Created `/api/v2/telegram/link` for partner account linking
- ✅ All 3 test alerts sent successfully to Telegram group

#### Admin Dashboard - Telegram Command Center
- ✅ Added "Telegram Command Center" section
- ✅ 3 colorful test buttons:
  - 🟢 Test Booking Alert → BOOKINGS topic
  - 🟡 Test Finance Alert → FINANCE topic
  - 🔵 Test Partner Alert → NEW_PARTNERS topic
- ✅ Bot/Group info display

#### Partner Dashboard - Connect Telegram
- ✅ "Connect Telegram" button in `/partner/settings`
- ✅ Code generation API for account linking
- ✅ Instructions for linking process

### Previous Updates (Stage 15.5)
- ✅ Admin/Partner Navigation Bar
- ✅ "View on Site" button for partner listings
- ✅ Monolithic API reduced from 3025 → 227 lines

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
