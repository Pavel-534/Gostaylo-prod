# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-28 - Security Infrastructure Complete ✅

### Telegram Webhook v3.0 (P0) ✅
- **502 Fix Applied** — синхронная обработка вместо background promises
- Webhook отвечает мгновенно, затем обрабатывает логику
- Статус: **Online**, 0 pending updates, no errors
- Commands working: /start, /help, /link, photo uploads (Lazy Realtor)

### Public Registration (P1) ✅
- **Sign Up form added** to homepage dialog
- Login/Register tabs with smooth switching
- Creates real users in Supabase Auth + profiles table
- Default role: RENTER

### Impersonation (P0) ✅
- Admin can "Login as" any user from Users page
- Yellow banner shows impersonation mode
- "Return to Admin" button works correctly
- Tested: Admin → Partner → Back to Admin

### Password Change (P0) ✅
- Security section in System Control Center
- Supabase Auth updateUser() integration
- Form validation: min 8 chars, password match

## Test Credentials (Live Supabase Auth)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@funnyrent.com | ChangeMe2025! |
| Partner | partner@test.com | ChangeMe2025! |
| Moderator | assistant@funnyrent.com | ChangeMe2025! |
| Client | client@test.com | ChangeMe2025! |

## Working Features
1. ✅ **Supabase Auth** — Login, logout, signup, password change
2. ✅ **Route Protection** — Redirects unauthenticated users
3. ✅ **Impersonation** — Admin can view as any user
4. ✅ **System Control Center** — All controls working
5. ✅ **Telegram Bot v3.0** — Synchronous processing, no 502
6. ✅ **Public Registration** — Creates real users
7. ✅ **Multi-language** — RU, EN, ZH, TH

## Webhook v3.0 Architecture
```
POST /api/webhooks/telegram
├── Parse JSON (sync)
├── Identify command (sync)
├── Send response to Telegram (sync)
└── Return 200 OK

No background promises = No 502 timeouts
```

## Next Priority Tasks
### Upcoming
- **P1: iCal Sync Backend** — Parse/block dates from external calendars
- **P1: Localize 404 pages**

### Future/Backlog
- **P1: Stripe Integration** — Payment processing
- **P1: TRON/USDT Verification** — Blockchain verification
- **P1: Resend Integration** — Email notifications

## Tech Stack
- **Framework:** Next.js 14.2.3 (App Router)
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth (LIVE)
- **Bot:** Telegram Bot API (Edge Runtime, v3.0)
- **UI:** Tailwind CSS, Shadcn/UI

## Code Architecture
```
/app/
├── app/
│   ├── api/webhooks/telegram/route.js  # v3.0 sync webhook
│   ├── admin/
│   │   ├── system/page.js              # Control Center + Security
│   │   └── users/page.js               # User management + impersonation
│   └── page.js                         # Homepage + Login/Register
├── lib/
│   ├── auth.js                         # Supabase Auth helpers
│   └── translations.js                 # i18n dictionary
└── .env                                # Configuration
```

## Security Notes
- All users have temporary password `ChangeMe2025!` — should be changed
- Route protection via client-side localStorage check
- Impersonation requires ADMIN role
- Password change updates Supabase Auth directly
