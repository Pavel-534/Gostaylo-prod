# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-27

### Global UI Refinement & Premium Tropical Branding Complete ✅

**Design System Updates:**
- **Color Palette:** Deep Sea (#0F172A), Crystal Teal (#14B8A6), Sand (#FDE047)
- **Admin Panel:** Premium gradient sidebar, teal-highlighted navigation, backdrop-blur top bar
- **Partner Dashboard:** Tropical welcome banner with palm icon, draft badges, gradient action buttons
- **Mobile:** Fixed overlap/glitch in admin header, proper z-index layering

**Functional Fixes:**
- Admin menu mobile overlap: FIXED ✅
- Telegram bot "Silent Mode": FIXED - Full feedback loop enabled ✅
- Partner Dashboard drafts: Draft badges with amber highlighting ✅

**Telegram Bot Updates:**
- Welcome messages with tropical theme 🌴
- Clear error messages for failed links
- Processing indicator for photo uploads
- Success confirmation with dashboard link

## Previous Updates

### Lazy Realtor (Stage 20.1) Complete ✅
- Telegram Webhook `/api/webhooks/telegram` fully implemented
- Partner Account Linking via `/link email`
- Draft Listings from Telegram photos
- Price Extraction from captions (THB/бат)
- Regression tests PASSED for Threads 15, 16, 17

## Project Overview
**Name:** FunnyRent 2.1 - Phuket Super-App for Rentals
**Super Admin:** Pavel B. (admin-777)
**Stack:** Next.js 14, Tailwind CSS, Lucide Icons, Supabase PostgreSQL
**Telegram Bot:** @FunnyRentBot

## Current Status: Premium Tropical UI Complete ✅

### Telegram Bot Commands
| Command | Description | Response |
|---------|-------------|----------|
| /start | Welcome message | Tropical welcome with instructions |
| /help | Help guide | Commands list and Lazy Realtor info |
| /link EMAIL | Link account | ✅ Account linked! / ❌ Email not found |
| Photo + Caption | Create draft | 🏝 Working... → ✅ Draft Created! |

### Partner Dashboard Features
- **Welcome Banner:** "Welcome to the Island, [Name]! 🌴"
- **Telegram Drafts Section:** Shows draft listings with amber badge
- **Quick Actions:** Premium gradient buttons with hover animations
- **Stats Cards:** Hover effects with shadow transitions

### Admin Panel Design
- **Sidebar:** Deep Sea gradient (#0F172A → #0F172A via #1E293B)
- **Active Menu:** Teal gradient with shadow glow
- **Top Bar:** Glass-morphism with backdrop blur
- **Status Badge:** Green dot + "Admin • Pavel B."

## v2 API Endpoints
| Endpoint | Status |
|----------|--------|
| /api/webhooks/telegram | ✅ Lazy Realtor + Notifications |
| /api/v2/categories | ✅ Working |
| /api/v2/listings | ✅ Working |
| /api/v2/bookings | ✅ Working |
| /api/v2/auth/login | ✅ Working (MOCK) |
| /api/v2/admin/stats | ✅ Working |
| /api/v2/partner/stats | ✅ Working |

## P0/P1/P2 Features Remaining

### P0 (Critical - Security)
- [ ] **Real Authentication** - Current login accepts any password
- [ ] bcrypt password hashing
- [ ] Session management

### P1 (Important)
- [ ] iCal Sync Backend Logic
- [ ] Localize 404/error pages
- [ ] Category selector fixes (dropdown population)

### P2 (Nice to have)
- [ ] Stripe payment integration
- [ ] TRON/USDT verification
- [ ] Resend email integration

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@funnyrent.com | any |
| Partner | partner@test.com | any |
| Moderator | assistant@funnyrent.com | any |
| Renter | client@test.com | any |

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://vtzzcdsjwudkaloxhvnw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TELEGRAM_BOT_TOKEN=8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM
TELEGRAM_ADMIN_GROUP_ID=-1003832026983
```

## Design System
- **Primary:** Crystal Teal #14B8A6
- **Secondary:** Deep Sea #0F172A
- **Accent:** Sand #FDE047
- **Background:** Slate-50 #F8FAFC
- **Rounded corners:** xl (12px), 2xl (16px)
- **Shadows:** shadow-lg, shadow-xl with color glow
