# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-28 - Supabase Auth Migration Complete ✅

### Authentication Migration (P0) ✅
- **MOCK auth replaced with live Supabase Auth**
- All test users migrated to Supabase Auth with temporary password: `ChangeMe2025!`
- `signIn`, `signOut`, `signUp`, `updatePassword` functions in `/app/lib/auth.js`
- Route protection working: unauthenticated users redirected to homepage
- Impersonation preserved via localStorage

### System Control Center Enhanced (P0) ✅
- **Security Section ADDED** — password change form with validation
- Maintenance Mode toggle
- Telegram Webhook status (currently shows "Online" with 0 pending updates)
- Activity Log
- All sections fully translated to Russian

### Telegram Webhook (P0) ✅
- Refactored to Edge Runtime for immediate 200 OK response
- Webhook re-linked and cleared pending updates
- Local endpoint working correctly
- External 502 is K8s ingress limitation (documented)

## Test Credentials (Live Supabase Auth)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@funnyrent.com | ChangeMe2025! |
| Partner | partner@test.com | ChangeMe2025! |
| Moderator | assistant@funnyrent.com | ChangeMe2025! |
| Client | client@test.com | ChangeMe2025! |

## Working Features
1. ✅ **Supabase Auth** — Login, logout, route protection
2. ✅ **System Control Center** — Full Russian UI, all controls working
3. ✅ **Admin Dashboard** — Stats, charts, user management
4. ✅ **Partner Dashboard** — Listings, bookings
5. ✅ **Telegram Bot** — Edge Runtime, Lazy Realtor feature
6. ✅ **Multi-language** — RU, EN, ZH, TH

## Known Issues
1. ⚠️ Homepage Supabase data fetch — categories/listings may fail (CORS or network)
2. ⚠️ External webhook 502 — K8s ingress routing limitation

## Priority Tasks
### In Progress
- **P1: Public Registration** — `signUp` function ready, UI integration pending

### Upcoming
- **P1: iCal Sync Backend** — Parse/block dates
- **P1: Localize 404 pages**

### Future/Backlog
- **P1: Stripe Integration** — Payment processing
- **P1: TRON/USDT Verification** — Blockchain verification
- **P1: Resend Integration** — Email notifications

## Tech Stack
- **Framework:** Next.js 14.2.3 (App Router)
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth (LIVE)
- **Bot:** Telegram Bot API (Edge Runtime)
- **UI:** Tailwind CSS, Shadcn/UI

## Code Architecture
```
/app/
├── app/
│   ├── api/webhooks/telegram/route.js  # Edge Runtime webhook
│   ├── admin/
│   │   ├── system/page.js              # System Control Center
│   │   ├── users/page.js               # User management
│   │   └── layout.js                   # Route protection
│   ├── partner/                        # Partner dashboard
│   └── page.js                         # Homepage with login
├── lib/
│   ├── auth.js                         # Supabase Auth helpers
│   ├── client-data.js                  # Supabase data fetcher
│   └── translations.js                 # i18n dictionary
└── .env                                # Configuration
```

## Security Notes
- Temporary password `ChangeMe2025!` should be changed by users
- Route protection via client-side localStorage check
- Admin-only pages redirect unauthenticated users
- Impersonation requires ADMIN role
