# Soft Launch — Go / No-Go Report (Stage 144)

**Date:** 2026-06-14  
**Decision:** **GO** for controlled first-wave invite (ambassadors + invited hosts)  
**Scope:** Product readiness, not legal/compliance sign-off

---

## Executive summary

Stage 144 closes the last pre-launch gaps for **notification locale** and **booking UI locale snapshot**. Financial ledger remains **THB-only**; smoke suite **28/28 GREEN**. First wave can proceed with the guardrails below.

---

## Completed in Stage 144 (P0)

| Item | Status |
|------|--------|
| Telegram i18n (payment received/confirmed/pending, booking confirmed/cancelled, check-in confirmed, check-in/review reminders, partner new-booking TG) | Done — `notify-telegram-copy.js` |
| `bookings.metadata.ui_locale` on create (cookie / Accept-Language / body `uiLocale`) | Done — `POST /api/v2/bookings` |
| Guest notify locale chain | profile → `metadata.ui_locale` → DB lookup → `ru` |
| Smoke `npm run smoke:full-financial` | 28/28 (verify in CI before deploy) |
| Stage 143.1 UX polish (empty states, onboarding, ambassador guide) | Done |

---

## Key risks (accept or mitigate before scale)

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Real money rails** (ЮKassa, payouts) not fully live | High | Soft launch = invite-only; monitor `/admin/health`; follow `docs/PRE_REAL_PAYMENTS_CHECKLIST.md` before scaling |
| **Email fallbacks** on EmailService failure still RU plain-text | Medium | Rare path; premium HTML emails are localized; fix in P1 |
| **Admin Telegram topics** remain RU/EN mix | Low | Staff-facing; acceptable for wave 1 |
| **Partner calendar** minor RU hints (demo mode, chat deep-link) | Low | P1 i18n pass |
| **FCM push** requires device token registration | Medium | In-app prompt + `POST /api/v2/push`; test on real devices |
| **Referral host activation** depends on first **completed** booking | Medium | Documented in `docs/AMBASSADOR_FIRST_WAVE_GUIDE.md` |
| **KYC / partner verification** optional for wave 1 | Medium | `PartnerHostVerificationBanner` sets expectations |

---

## Go criteria (met)

- [x] Financial smoke 28/28 GREEN
- [x] No changes to ledger currency (THB SSOT)
- [x] Critical user TG notifications localized (RU/EN/ZH/TH)
- [x] Booking locale snapshot for downstream notify
- [x] Welcome / onboarding / ambassador instructions in place (143.1)
- [x] Health dashboard hardened (142)

---

## No-Go triggers (stop invite expansion if any occur)

1. Smoke financial suite fails on production-like env  
2. Payment webhook errors > 5% in 24h  
3. Critical signals (`lib/critical-telemetry.js`) spike on booking/payment paths  
4. Unresolved P0 security/RLS advisor findings on new tables  

---

## First-wave playbook (48h)

1. Invite **5–15 ambassadors** with `docs/AMBASSADOR_FIRST_WAVE_GUIDE.md`  
2. Monitor: `/admin/health`, Telegram FINANCE topic, referral dashboard  
3. Manual E2E once per vertical: ref link → signup → listing → booking → payment (mock/staging) → notification language check  
4. Collect UX feedback on partner onboarding checklist + next-steps card  

---

## P1 backlog (after wave 1)

- Email fallback localization in `booking-events.js` / `payment-events.js`  
- `handleNewMessage` / payout TG+email i18n  
- Partner calendar page remaining RU strings  
- Client explicitly sends `uiLocale` in booking POST body (today: server derives from cookie)  
- Expand visual E2E for payment + dispute paths  

---

*Maintainers: update this doc when go/no-go inputs change (payments live, locale coverage, smoke status).*
