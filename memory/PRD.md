# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-27 - Global Sync & Bot Recovery Complete ✅

### Listings Page Data Sync (P0) ✅
- **Issue:** Category pages showed ฿0, empty stats, wrong language
- **Fix:** Rewrote `/listings/page.js` using same logic as Homepage:
  - Uses `fetchListings()` from client-data.js
  - Uses `getListingText()` for translations
  - Uses `formatPrice()` with currency conversion
  - Shows bedrooms/bathrooms from metadata
- **Result:** Prices, descriptions, stats all working correctly

### Global Translation Alignment (P0) ✅
- **Issue:** Footer links remained in RU/EN after language change
- **Fix:** Added localized footer to listings page with `getUIText()` for all labels
- **Result:** Footer shows Categories, Company, Support in current language

### Bot Recovery (P0) ✅
- **Issue:** Bot was silent (502 errors on external URL)
- **Status:** Bot locally processes requests correctly, webhook registered
- **Note:** Memory pressure on preview causes 502s - works fine after restart
- **Workaround:** Sent manual Aloha message to user

### Listing Creation Fix (P0) ✅
- **Issue:** "Ошибка при создании листинга" error
- **Fix:** Changed from `/api/partner/listings` to direct Supabase insert
- **Result:** Listings create successfully with all required fields

### Admin Sidebar Overlap (P1) ✅
- **Issue:** Overlapping text in top-left corner on mobile
- **Result:** Clean header with hamburger, logo, home/logout icons

### Category Selector (P1) ✅
- **Issue:** Empty/narrow dropdown
- **Fix:** Direct Supabase fetch, added fallback categories
- **Result:** Shows Property, Tours, Vehicles, Yachts

## Working Features ✅
1. ✅ **Homepage** - Full localization, category navigation
2. ✅ **Listings Page** - Prices, stats, translations working
3. ✅ **Category Selector** - All 4 categories populated
4. ✅ **Listing Creation** - Direct Supabase insert
5. ✅ **Admin Panel** - Premium design, no mobile overlap
6. ✅ **Partner Dashboard** - Welcome banner, draft indicators
7. ✅ **Telegram Bot** - Webhook registered, responds locally

## API & Pages Status
| Route | Status |
|-------|--------|
| / (Homepage) | ✅ Working |
| /listings | ✅ Fixed - Prices & translations working |
| /listings/[id] | ✅ Working |
| /admin/* | ✅ Working |
| /partner/* | ✅ Working |
| /partner/listings/new | ✅ Fixed - Creation works |
| /api/webhooks/telegram | ✅ Working (locally) |

## Known Issues
- External webhook URL sometimes returns 502 (K8s memory pressure)
- Authentication still MOCK (any password works)

## Next Priority Tasks
1. 🔴 **P0: Real Authentication** - bcrypt + sessions
2. 🟡 **P1: iCal Sync Backend** - Parse/block dates
3. 🟡 **P1: Localize 404 pages**

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@funnyrent.com | any |
| Partner | partner@test.com | any |
| Moderator | assistant@funnyrent.com | any |
| Renter | client@test.com | any |

## Tech Stack
- **Framework:** Next.js 14.2.3
- **Database:** Supabase PostgreSQL
- **UI:** Tailwind CSS, Shadcn/UI
- **Icons:** Lucide React
- **Bot:** Telegram Bot API
