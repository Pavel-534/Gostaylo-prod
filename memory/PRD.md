# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-27

### Lazy Realtor (Stage 20.1) Complete ✅
- **Telegram Webhook:** `/api/webhooks/telegram` - полностью реализован
- **Partner Account Linking:** Команда `/link email@example.com` связывает Telegram с платформой
- **Draft Listings via Telegram:** Партнёр отправляет фото + описание → создаётся черновик в БД
- **Price Extraction:** Автоматическое извлечение цены из текста (15000 THB, 15000 бат)
- **Regression Test PASSED:** Уведомления в топики 15, 16, 17 работают корректно

### Logo Redesign & Full Listing Localization (Previous)
- **Stacked Logo:** "Funny" (black) / "Rent" (teal, offset) - compact 2-line design
- **Listing Detail 100% Localized:** Title, Description, Features, Amenities, Buttons all translated
- **Multi-language:** RU, EN, TH, ZH

## Project Overview
**Name:** FunnyRent 2.1 - Phuket Super-App for Rentals
**Super Admin:** Pavel B. (admin-777)
**Stack:** Next.js 14, Tailwind CSS, Lucide Icons, Supabase PostgreSQL
**Telegram Bot:** @FunnyRentBot (Token: 8702569258:...)

## Current Status: Stage 20.1 Complete ✅

### What Was Completed Today (2026-02-27)

#### Lazy Realtor Feature
1. **Telegram Webhook Handler** (`/api/webhooks/telegram`)
   - ✅ `/start` - Приветствие и инструкции
   - ✅ `/help` - Справка по командам
   - ✅ `/link EMAIL` - Привязка Telegram к аккаунту партнёра
   - ✅ Photo + Caption → Draft Listing creation
   
2. **Draft Listing Creation**
   - ✅ Парсинг цены из caption (THB/бат/฿)
   - ✅ Извлечение title из первой строки
   - ✅ Сохранение telegram_file_id в metadata
   - ✅ Статус PENDING + is_draft: true в metadata
   - ✅ available: false до публикации
   
3. **Partner Linking**
   - ✅ Связывание telegram_id с profiles
   - ✅ telegram_linked: true после успешной привязки
   - ✅ Проверка роли PARTNER/ADMIN

4. **Telegram Notifications Regression**
   - ✅ Thread 15 (BOOKINGS) - Работает
   - ✅ Thread 16 (FINANCE) - Работает
   - ✅ Thread 17 (NEW_PARTNERS) - Работает

### Database Status (Supabase)
- ✅ 16 tables created with TEXT IDs
- ✅ profiles.telegram_id - для связи с Telegram
- ✅ profiles.telegram_linked - флаг привязки
- ✅ listings.metadata.is_draft - маркер черновика
- ✅ listings.metadata.telegram_file_id - ID фото из Telegram

### Telegram Bot Commands
| Command | Description |
|---------|-------------|
| /start | Приветствие и инструкции |
| /help | Справка по Lazy Realtor |
| /link EMAIL | Привязать аккаунт партнёра |
| Photo + Caption | Создать черновик объявления |

### v2 API Endpoints (Service-Oriented Architecture)
| Endpoint | Status |
|----------|--------|
| /api/v2/categories | ✅ Working |
| /api/v2/listings | ✅ Working |
| /api/v2/listings/[id] | ✅ Working |
| /api/v2/bookings | ✅ Working |
| /api/v2/auth/login | ✅ Working (MOCK) |
| /api/v2/admin/stats | ✅ Working |
| /api/v2/partner/stats | ✅ Working |
| /api/webhooks/telegram | ✅ NEW - Lazy Realtor |

### Service Layer (/app/lib/services/)
- ✅ pricing.service.js - Seasonal pricing, commission, promo codes
- ✅ booking.service.js - Availability, booking creation, status
- ✅ notification.service.js - Telegram, Email dispatcher
- ✅ payment.service.js - Escrow, crypto, payouts

### Localization System
- **Static UI:** `/app/lib/translations.js` - Central dictionary
- **Dynamic Content:** Supabase `metadata` JSONB column
- **Languages:** RU, EN, TH, ZH
- **Auto-detect:** Browser language preference

## P0/P1/P2 Features Remaining

### P0 (Critical - Security)
- [ ] **Real Authentication** - Current login accepts any password (MOCK)
- [ ] Implement bcrypt password hashing
- [ ] Session management strategy

### P1 (Important)
- [ ] iCal Sync Backend Logic - Parse and block dates
- [ ] Localize 404/error pages
- [ ] Partner dashboard: show draft listings from Telegram

### P2 (Nice to have)
- [ ] Stripe payment integration
- [ ] TRON/USDT verification
- [ ] Resend email integration
- [ ] Deprecate old [[...path]]/route.js

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
RESEND_API_KEY= (not configured)
```

## Architecture Notes
- **K8s Routing:** Avoid client-side fetch to /api/* - use Supabase client directly
- **Telegram Webhook:** Registered via setWebhook API
- **Role System:** ADMIN, PARTNER, RENTER (MODERATOR is ADMIN with frontend restrictions)
