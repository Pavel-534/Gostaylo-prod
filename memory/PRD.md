# FunnyRent 2.1 - Product Requirements Document

## Project Overview
**Name:** FunnyRent 2.1 - Phuket Super-App for Rentals
**Super Admin:** Pavel B. (admin-777)
**Stack:** Next.js 14, Tailwind CSS, Lucide Icons, Supabase PostgreSQL

## Original Problem Statement
Build a comprehensive rental platform for Phuket covering:
- Property rentals (Villas, Condos)
- Vehicle rentals (Cars, Bikes)
- Tours & Experiences
- Yacht rentals

## User Personas
1. **Renter** - End user searching and booking rentals
2. **Partner** - Property/vehicle owner managing listings
3. **Admin** - Platform administrator managing users, listings, commissions

## Core Requirements (Static)
- Multi-category rental marketplace
- Seasonal pricing with custom rates
- Promo code system (percentage & fixed discounts)
- Custom commission rates per partner
- Blacklist management (wallet, phone, email, IP)
- Featured listings toggle
- Multi-currency support (THB, RUB, USD, USDT)
- Telegram & Email notifications
- Crypto payment (USDT TRC-20)
- Partner payout system
- Referral program

## Implementation Progress

### Stage 1-14.2 (Previous Agent)
- [x] Complete UI (Admin, Partner, Renter dashboards)
- [x] Mock database with all business logic
- [x] Promo codes, blacklist, seasonal pricing
- [x] Custom commissions, featured listings
- [x] Russian language interface

### Stage 15.1 - Database Setup (2026-02-26)
- [x] Supabase project connected
- [x] SQL migration with 16 tables (TEXT IDs)
- [x] ENUMs for all statuses
- [x] Triggers for auto-updated_at, referral codes
- [x] Seed data (categories, exchange rates, admin, promo codes)

### Stage 15.2 - Service Architecture (2026-02-26)
- [x] PricingService (seasonal, commission, promo validation)
- [x] BookingService (availability, creation, status transitions)
- [x] NotificationService (Telegram, Email dispatcher)
- [x] PaymentService (escrow, crypto verification, payouts)
- [x] Modular v2 API routes with Supabase integration
- [x] Admin stats endpoint working

## Current Database Schema
- profiles, categories, listings, bookings, payments
- conversations, messages, seasonal_prices, promo_codes
- blacklist, payouts, exchange_rates, system_settings
- referrals, activity_log, telegram_link_codes

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://vtzzcdsjwudkaloxhvnw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=(pending)
TELEGRAM_BOT_TOKEN=(pending)
```

## P0/P1/P2 Features Remaining

### P0 (Critical)
- [ ] Migrate all frontend to v2 APIs
- [ ] Real email notifications (Resend)
- [ ] Real Telegram bot integration

### P1 (Important)
- [ ] Stripe payment integration
- [ ] Real TRON verification for crypto
- [ ] Row Level Security (RLS)
- [ ] Password hashing (bcrypt)

### P2 (Nice to Have)
- [ ] iCal calendar sync
- [ ] Google OAuth
- [ ] Mobile app (React Native)

## Next Tasks
1. Create remaining v2 routes (bookings, partner, webhooks)
2. Update frontend components to use v2 APIs
3. Get Resend API key from user
4. Get Telegram Bot Token from user
5. Test full booking flow with real database

---
*Last Updated: 2026-02-26*
