# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-27 - System Control Center Complete ✅

### Admin System Control Center (P0) ✅
- **NEW Route:** `/admin/system` — centralized system management
- **Maintenance Mode:** Toggle with kill switch functionality
- **Telegram Webhook Management:**
  - Status indicator (Online/Offline)
  - Re-link Webhook button
  - Send Test "Aloha!" button
  - Refresh Status button
  - Last error display
  - Pending updates count
- **Recent Activity Log:** Last 10 system events
- **Quick Stats:** System Status, Bot Status, Pending Updates

### Global Translations Fix (P0) ✅
- **Footer:** Removed duplicate Russian footer from layout.js
- **Single localized footer** per page using getUIText()
- **Languages:** RU, EN, ZH, TH

### Bot Reliability Optimization (P0) ✅
- **Edge Runtime:** Webhook converted to Edge for better reliability
- **Direct Supabase API:** No more K8s ingress issues
- **Bot responds "Aloha!"** to /start command

### UI Polish ✅
- **Admin Sidebar:** No overlap in top-left corner
- **Navigation:** System menu item added after Dashboard
- **Consistent Tropical design** across Admin/Partner

## Previous Updates

### Listings Page Data Sync ✅
- Prices display correctly (not ฿0)
- Bedrooms/bathrooms from metadata
- Full localization

### Listing Creation Fix ✅
- Direct Supabase insert
- All required fields populated

## Working Features
1. ✅ **Homepage** - Full localization, single footer
2. ✅ **Listings Page** - Prices, stats, translations
3. ✅ **Admin System Page** - Maintenance + Webhook control
4. ✅ **Admin Sidebar** - Clean, no overlap
5. ✅ **Telegram Bot** - Edge Runtime, "Aloha!" response
6. ✅ **Partner Dashboard** - Welcome banner, drafts

## API & Pages Status
| Route | Status |
|-------|--------|
| / (Homepage) | ✅ Working |
| /listings | ✅ Working |
| /admin/system | ✅ NEW - Control Center |
| /admin/dashboard | ✅ Working |
| /partner/* | ✅ Working |
| /api/webhooks/telegram | ✅ Edge Runtime |

## Next Priority Tasks
1. 🔴 **P0: Real Authentication** - bcrypt + sessions
2. 🟡 **P1: iCal Sync Backend** - Parse/block dates
3. 🟡 **P1: Localize 404 pages**

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@funnyrent.com | any |
| Partner | partner@test.com | any |

## Tech Stack
- **Framework:** Next.js 14.2.3
- **Database:** Supabase PostgreSQL
- **Bot:** Telegram Bot API (Edge Runtime)
- **UI:** Tailwind CSS, Shadcn/UI
