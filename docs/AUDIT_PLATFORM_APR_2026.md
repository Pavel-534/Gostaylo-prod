# GoStayLo Platform Audit (Apr 2026)

## P0 (critical)
- Unauthenticated check-in confirmation: `app/api/v2/bookings/[id]/check-in/confirm/route.js`
- Unauthenticated booking status update: `app/api/v2/bookings/[id]/route.js`
- Bookings list endpoint without session guard: `app/api/v2/bookings/route.js`
- Single booking endpoint without session guard: `app/api/v2/bookings/[id]/route.js`
- Open DB seed endpoint using service role: `app/api/db/seed/route.js`

## P1 (high)
- Checkout success state ignores `PAID_ESCROW`: `app/checkout/[bookingId]/hooks/useCheckoutPayment.js`
- Client calls secret-protected crypto webhook directly: `app/checkout/[bookingId]/hooks/useCheckoutPayment.js` + `app/api/webhooks/crypto/confirm/route.js`
- Contact reveal logic excludes `PAID_ESCROW` and `THAWED`: `lib/mask-contacts.js`
- Review UI only surfaces `COMPLETED` while API allows post-checkout flows: `app/my-bookings/page.js` + `app/api/v2/reviews/route.js`
- Weak minimum password length (6): `app/api/v2/auth/register/route.js`
- Deprecated listing endpoint still active: `app/api/v2/listings/route.js`

## Heavy / risk concentration areas
- `lib/services/push.service.js`
- `lib/services/booking/inquiry.service.js`
- `app/messages/[id]/UnifiedMessagesClient.jsx`

## Super-app gaps
- No unified dispute center and case lifecycle (SLA, arbitration, claim flow)
- No universal order abstraction across verticals (homes/transport/tours/services)
- Trust signals (ratings/reputation) are weakly used in ranking
- Category-specific trust/safety and quality loops need hardening

## 30 / 60 / 90 days roadmap
- **30 days:** close all P0 access-control gaps, lock seed route, align checkout + crypto verification path
- **60 days:** unify review eligibility UX/API, expose two-sided reputation, add moderation/dispute baseline
- **90 days:** implement universal order model, vertical policies, ranking with trust + reliability signals

