# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-27

### UI Regression Fix & Deep Localization Complete
- **Mobile Header Fixed:** All elements visible on 390px (Logo FR, 🇬🇧, ฿THB, 👤 Login)
- **Deep Localization:** Footer fully translated (分类/公司/支持), Book button "立即预订", price "/每天"
- **Bedrooms/Bathrooms:** Translation code ready, displays when data exists in listing

## Project Overview
**Name:** FunnyRent 2.1 - Phuket Super-App for Rentals
**Super Admin:** Pavel B. (admin-777)
**Stack:** Next.js 14, Tailwind CSS, Lucide Icons, Supabase PostgreSQL

## Current Status: Stage 17.3 Complete ✅

### What Was Completed (Feb 26, 2025) - Latest

#### Partner Command Center
1. **Telegram Magic Onboarding Block** (`/partner/dashboard`)
   - ✅ Step 1: Connect Bot - "Get My Link Code" button
   - ✅ Step 2: Instant Listing - Photo/description bot instructions
   - ✅ Step 3: Real-time Alerts - Notification types display
   - ✅ Beautiful gradient UI with NEW badge

2. **iCal Synchronization UI** (`/partner/listings/[id]`)
   - ✅ Orange "Sync Calendar (iCal)" section
   - ✅ URL input field with placeholder
   - ✅ Tooltip with explanation
   - ✅ Instructions for Airbnb, Booking.com, VRBO
   - ✅ Green "sync active" indicator when URL is provided
   - ✅ Saves to `metadata.icalUrl` in Supabase

3. **Direct Supabase Integration**
   - ✅ Listing edit page now uses direct Supabase calls
   - ✅ Bypasses k8s routing issues
   - ✅ Full CRUD functionality restored

### Previous Updates (Stage 16.3)
- ✅ Telegram Topic Routing (15/16/17)
- ✅ MODERATOR role implementation
- ✅ Demo accounts created

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
